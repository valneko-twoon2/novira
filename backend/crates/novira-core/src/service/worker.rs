//! The worker that runs queued jobs through the engine and stores what comes out.
use super::*;
use crate::sync::LockExt;
use futures_util::FutureExt;

/// Text of a caught panic, as shown on the failed queue item.
pub(crate) fn panic_message(payload: &(dyn std::any::Any + Send)) -> String {
    let what = payload
        .downcast_ref::<&str>()
        .map(|s| s.to_string())
        .or_else(|| payload.downcast_ref::<String>().cloned())
        .unwrap_or_else(|| "unknown error".into());
    format!("Internal error: {what}")
}

impl Backend {
    /// Runs queued jobs one at a time until shutdown. Spawn it once on the async runtime.
    pub async fn run_worker(self) {
        loop {
            let next = {
                let mut s = self.state();
                if s.paused || s.running.is_some() {
                    None
                } else if let Some(item) = s
                    .queue
                    .iter()
                    .find(|q| q.status == QueueItemStatus::Pending)
                    .cloned()
                {
                    let token = self.inner.shutdown.child_token();
                    s.running = Some((item.id, token.clone()));
                    Some((item, token))
                } else {
                    None
                }
            };
            let Some((item, token)) = next else {
                tokio::select! {
                    _ = self.inner.wake.notified() => continue,
                    _ = self.inner.shutdown.cancelled() => return,
                }
            };
            self.set_status(item.id, QueueItemStatus::InProgress, |q| {
                q.started_at = Some(now())
            });
            // A panic inside one job fails that job; it must not end the worker (the queue would stall for good).
            let result = std::panic::AssertUnwindSafe(self.process(&item, &token))
                .catch_unwind()
                .await
                .unwrap_or_else(|panic| Err(EngineError::Failed(panic_message(panic.as_ref()))));
            self.state().running = None;
            match result {
                Ok(()) => {}
                Err(EngineError::Cancelled) => {
                    // Cancelled by the user (already marked) or by shutdown (mark it now).
                    let still_running = self
                        .state()
                        .queue
                        .iter()
                        .any(|q| q.id == item.id && q.status == QueueItemStatus::InProgress);
                    if still_running {
                        let msg = if self.inner.shutdown.is_cancelled() {
                            Some(INTERRUPTED.to_string())
                        } else {
                            None
                        };
                        self.set_status(item.id, QueueItemStatus::Canceled, |q| {
                            q.completed_at = Some(now());
                            q.error = msg;
                        });
                    }
                }
                Err(EngineError::Failed(msg)) => {
                    crate::applog::error("queue", format!("job {} failed: {msg}", item.id));
                    if !token.is_cancelled() {
                        let kind = crate::engine::is_out_of_memory(&msg)
                            .then_some(QueueErrorKind::OutOfMemory);
                        self.set_status(item.id, QueueItemStatus::Failed, |q| {
                            q.completed_at = Some(now());
                            q.error = Some(msg);
                            q.error_kind = kind;
                        });
                    }
                }
            }
            if self.inner.shutdown.is_cancelled() {
                return;
            }
        }
    }

    fn resolve_model(&self, key: &str, what: &str) -> std::result::Result<ComfyRef, EngineError> {
        let s = self.state();
        let model = s
            .models
            .iter()
            .find(|m| m.key == key)
            .ok_or_else(|| EngineError::Failed(format!("{what} model not found: {key}")))?;
        model.comfy.clone().ok_or_else(|| {
            EngineError::Failed(format!("{} cannot be used with ComfyUI", model.name))
        })
    }

    /// A `graph` job: the editor's prompt with the models resolved and the pictures read.
    fn graph_job(
        &self,
        item: &QueueItem,
    ) -> std::result::Result<(EngineJob, Vec<crate::comfy::user_graph::Speech>), EngineError> {
        let graph = item
            .comfy_graph
            .as_ref()
            .ok_or_else(|| EngineError::Failed("The graph to run is missing".into()))?;
        let prepared = crate::comfy::user_graph::prepare(
            graph,
            item.params.seed,
            |key| self.resolve_model(key, "Graph").map_err(|e| e.to_string()),
            |size| {
                self.clip_vision_model(size, "Graph")
                    .map_err(|e| e.to_string())
            },
        )
        .map_err(EngineError::Failed)?;
        let mut images = Vec::new();
        for name in &prepared.images {
            let bytes =
                self.inner.files.read_original(name).ok_or_else(|| {
                    EngineError::Failed(format!("The picture {name} was deleted"))
                })?;
            images.push((name.clone(), bytes));
        }
        let job = EngineJob {
            split: None,
            params: item.params.clone(),
            checkpoint: ComfyRef {
                folder: String::new(),
                name: String::new(),
            },
            vae: None,
            loras: Vec::new(),
            upscale_model: None,
            tile_controlnet: None,
            post_processing_model: None,
            text_encoder: None,
            init_image: None,
            guidance: Default::default(),
            graph: Some(GraphJob {
                prompt: prepared.prompt,
                outputs: prepared.outputs,
                thumbnail: prepared.thumbnail,
                no_result: false,
                models: prepared.models,
                images,
            }),
        };
        Ok((job, prepared.speeches))
    }

    fn engine_job(&self, item: &QueueItem) -> std::result::Result<EngineJob, EngineError> {
        let p = &item.params;
        {
            let s = self.state();
            if let Some(m) = s.models.iter().find(|m| {
                m.key == p.model_key
                    && !matches!(
                        p.generation_mode,
                        GenerationMode::Video | GenerationMode::Music | GenerationMode::Logo
                    )
            }) {
                let split_family = matches!(m.kind, ModelType::DiffusionModel | ModelType::Main)
                    && crate::comfy::split::Family::of(m.base).is_some();
                if !split_family
                    && !matches!(
                        m.base,
                        BaseModel::Sd1
                            | BaseModel::Sd2
                            | BaseModel::Sdxl
                            | BaseModel::HunyuanDit
                            | BaseModel::Any
                    )
                {
                    return Err(EngineError::Failed(format!(
                        "{} models are not supported by the ComfyUI backend yet",
                        serde_json::to_value(m.base)
                            .unwrap_or_default()
                            .as_str()
                            .unwrap_or("This")
                    )));
                }
            }
        }
        let is_video = p.generation_mode == GenerationMode::Video;
        let is_music = p.generation_mode == GenerationMode::Music;
        let is_logo = p.generation_mode == GenerationMode::Logo;
        let turbo = is_video && p.model_key == packs::TURBO_KEY;
        // A video model the user installed (Wan 2.1, HunyuanVideo, LTX-Video...) is named by its key; no key, or the
        // Turbo key, is the pack's own model.
        let own_video = if is_video && !turbo && !p.model_key.is_empty() {
            self.split_job(&p.model_key)?
        } else {
            None
        };
        let video_pack = if turbo {
            PackKind::Turbo
        } else {
            PackKind::Video
        };
        if is_video && own_video.is_none() && !packs::is_installed_in(&self.inner.roots, video_pack)
        {
            return Err(EngineError::Failed(
                "The video models are not installed yet. Install them on the Video screen first"
                    .into(),
            ));
        }
        if is_logo && !packs::is_installed_in(&self.inner.roots, PackKind::Logo) {
            return Err(EngineError::Failed(
                "The logo model is not installed yet. Install it on the Logo screen first".into(),
            ));
        }
        if is_music && !packs::is_installed_in(&self.inner.roots, PackKind::Music) {
            return Err(EngineError::Failed(
                "The music model is not installed yet. Install it on the Music screen first".into(),
            ));
        }
        let checkpoint = if own_video.is_some() {
            self.resolve_model(&p.model_key, "Video")?
        } else if turbo {
            packs::video_turbo_unet_ref()
        } else if is_video {
            packs::video_unet_ref()
        } else if is_music {
            packs::music_checkpoint_ref()
        } else if is_logo {
            packs::logo_unet_ref()
        } else {
            self.resolve_model(&p.model_key, "Main")?
        };
        let split = if own_video.is_some() {
            own_video
        } else if is_video || is_music || is_logo {
            None
        } else {
            self.split_job(&p.model_key)?
        };
        let vae = if is_video && split.is_none() {
            Some(packs::video_vae_ref())
        } else if is_logo {
            Some(packs::logo_vae_ref())
        } else if is_music {
            None
        } else if let Some(key) = p.vae_key.as_deref() {
            Some(self.resolve_model(key, "VAE")?)
        } else if let Some(split) = split.as_ref().filter(|s| {
            !matches!(
                s.loader,
                crate::comfy::split::Loader::Checkpoint { vae: true, .. }
            )
        }) {
            Some(self.split_vae(split.family, split.wan)?)
        } else {
            None
        };
        let text_encoder = if is_video && split.is_none() {
            Some(packs::video_text_encoder_ref())
        } else if is_logo {
            Some(packs::logo_text_encoder_ref())
        } else {
            None
        };
        let mut loras = Vec::new();
        for l in p
            .loras
            .iter()
            .filter(|l| l.is_enabled && !is_video && !is_music && !is_logo)
        {
            loras.push((self.resolve_model(&l.key, "LoRA")?, l.weight));
        }
        // Upscaling, or the second pass of a text-to-image or image-to-image job that enlarges with a model.
        let upscale_key = match p.generation_mode {
            GenerationMode::Upscale => p.upscale_model_key.as_deref(),
            GenerationMode::Txt2img | GenerationMode::Img2img => p
                .hires_fix
                .as_ref()
                .and_then(|h| h.upscale_model_key.as_deref()),
            _ => None,
        };
        let upscale_model = upscale_key
            .map(|k| self.resolve_model(k, "Upscale"))
            .transpose()?;
        // The tile ControlNet of an upscale, which keeps the picture's structure while it is redrawn.
        let tile_controlnet = match (p.generation_mode, p.tile_controlnet_model_key.as_deref()) {
            (GenerationMode::Upscale, Some(key)) => Some(self.resolve_model(key, "ControlNet")?),
            _ => None,
        };
        // The post-processing model of an upscale, which finishes the drawn picture.
        let post_processing_model =
            match (p.generation_mode, p.post_processing_model_key.as_deref()) {
                (GenerationMode::Upscale, Some(key)) => Some(self.resolve_model(key, "Upscale")?),
                _ => None,
            };
        let init_image = match &item.init_image_url {
            Some(url) => {
                let name = self.image_name_from_url(url).ok_or_else(|| {
                    EngineError::Failed("Source image is not a stored image".into())
                })?;
                if images::is_video(&name) {
                    return Err(EngineError::Failed(
                        "A video cannot be a source image".into(),
                    ));
                }
                Some(
                    self.inner
                        .files
                        .read_original(&name)
                        .ok_or_else(|| EngineError::Failed("Source image was deleted".into()))?,
                )
            }
            None => None,
        };
        let guidance = self.job_guidance(item)?;
        Ok(EngineJob {
            split,
            params: p.clone(),
            checkpoint,
            vae,
            loras,
            upscale_model,
            tile_controlnet,
            post_processing_model,
            text_encoder,
            init_image,
            graph: None,
            guidance,
        })
    }

    /// The parts of a model of the newer families (Anima, Flux, Wan...): how it loads, its text encoders found among
    /// the installed ones by the words in their names, and for Wan what it is made for. A checkpoint that carries its
    /// own encoders needs none; which parts it carries is read from its header. `None` for a model of the SD family.
    fn split_job(
        &self,
        model_key: &str,
    ) -> std::result::Result<Option<crate::comfy::split::SplitJob>, EngineError> {
        use crate::comfy::split::{pick, Family, Loader, SplitJob, WanKind};
        use crate::models::classify;
        let s = self.state();
        let Some(m) = s.models.iter().find(|m| m.key == model_key) else {
            return Ok(None);
        };
        if !matches!(m.kind, ModelType::DiffusionModel | ModelType::Main) {
            return Ok(None);
        }
        let Some(family) = Family::of(m.base).or_else(|| Family::of_video(m.base)) else {
            return Ok(None);
        };
        let header = classify::read_header(std::path::Path::new(&m.path));
        let loader = crate::models::parts::loader_of(m.kind, m.base, header.as_ref());
        let name = m.comfy.as_ref().map(|c| c.name.clone()).unwrap_or_default();
        let variant = classify::detect_variant(m.base, header.as_ref(), &name);
        let mut text_encoders = Vec::new();
        if !matches!(loader, Loader::Checkpoint { clip: true, .. }) {
            for need in family.encoders_for(variant) {
                let found = pick(&s.models, ModelType::TextEncoder, need)
                    .and_then(|e| e.comfy.clone())
                    .ok_or_else(|| {
                        EngineError::Failed(format!(
                            "{} needs {}. Install it from the Models screen first",
                            family.label(),
                            need.what
                        ))
                    })?;
                text_encoders.push(found);
            }
        }
        let mut job = SplitJob::new(family, loader, text_encoders);
        job.variant = variant;
        if variant == classify::Variant::HyI2v {
            job.clip_vision = Some(
                pick(&s.models, ModelType::ClipVision, &crate::comfy::split::LLAVA_VISION)
                    .and_then(|c| c.comfy.clone())
                    .ok_or_else(|| {
                        EngineError::Failed(format!(
                            "HunyuanVideo image to video needs {}. Install it from the Models screen first",
                            crate::comfy::split::LLAVA_VISION.what
                        ))
                    })?,
            );
        }
        if variant == classify::Variant::Hy15I2v {
            job.clip_vision = Some(
                pick(&s.models, ModelType::ClipVision, &crate::comfy::split::SIGCLIP_VISION)
                    .and_then(|c| c.comfy.clone())
                    .ok_or_else(|| {
                        EngineError::Failed(format!(
                            "HunyuanVideo 1.5 image to video needs {}. Install it from the Models screen first",
                            crate::comfy::split::SIGCLIP_VISION.what
                        ))
                    })?,
            );
        }
        if family == Family::Wan {
            // A file with a header says what it is made for by its tensors; a GGUF file only by its name.
            let kind = match &header {
                Some(h) => classify::wan_in_channels(h).and_then(WanKind::from_channels),
                None => WanKind::from_name(&name),
            };
            job.wan = Some(kind.ok_or_else(|| {
                    EngineError::Failed(format!(
                        "Cannot tell what {} is made for (it is not a Wan text-to-video, image-to-video or 5B model)",
                        m.name
                    ))
                })?);
            // Wan 2.1 image to video carries an image embedding that wants the CLIP-vision encoding of the picture
            // (a GGUF file without a header: any image-to-video file that is not Wan 2.2's).
            let lower = name.to_ascii_lowercase();
            let embeds = match &header {
                Some(h) => classify::wan_has_image_embedding(h),
                None => !(lower.contains("2.2") || lower.contains("2_2")),
            };
            if job.wan == Some(WanKind::I2v) && embeds {
                job.clip_vision = Some(
                        pick(&s.models, ModelType::ClipVision, &crate::comfy::split::CLIP_VISION_H)
                            .and_then(|c| c.comfy.clone())
                            .ok_or_else(|| {
                                EngineError::Failed(format!(
                                    "Wan 2.1 image to video needs {}. Install it from the Models screen first",
                                    crate::comfy::split::CLIP_VISION_H.what
                                ))
                            })?,
                    );
            }
            if lower.contains("low_noise") {
                return Err(EngineError::Failed(
                        "Pick the high-noise file of the Wan 2.2 pair; its low-noise partner is used with it".into(),
                    ));
            }
            if lower.contains("high_noise") {
                let partner = lower.replace("high_noise", "low_noise");
                job.low_noise = s
                    .models
                    .iter()
                    .filter_map(|o| o.comfy.as_ref())
                    .find(|c| {
                        c.folder == "diffusion_models" && c.name.to_ascii_lowercase() == partner
                    })
                    .cloned();
                if job.low_noise.is_none() {
                    return Err(EngineError::Failed(format!(
                            "{name} needs its low-noise partner (the file named like it with low_noise). Install it from the Models screen first"
                        )));
                }
            }
        }
        Ok(Some(job))
    }

    /// The VAE of a model that loads in parts, when the job names none.
    fn split_vae(
        &self,
        family: crate::comfy::split::Family,
        wan: Option<crate::comfy::split::WanKind>,
    ) -> std::result::Result<ComfyRef, EngineError> {
        let s = self.state();
        let need = family.vae_for(wan);
        crate::comfy::split::pick(&s.models, ModelType::Vae, &need)
            .and_then(|v| v.comfy.clone())
            .ok_or_else(|| {
                EngineError::Failed(format!(
                    "{} needs {}. Install it from the Models screen first",
                    family.label(),
                    need.what
                ))
            })
    }

    /// Takes the GPU lock (waiting for it, with progress messages) when one is configured; `None` when cancelled while waiting.
    pub(super) async fn gpu_guard(
        &self,
        item: &QueueItem,
        token: &CancellationToken,
    ) -> std::result::Result<Option<Option<gpu_lock::GpuLockGuard>>, EngineError> {
        let total = item.params.steps.max(1);
        let Some(path) = &self.inner.gpu_lock else {
            return Ok(Some(None));
        };
        let on_wait = || {
            self.emit(BackendEvent::InvocationProgress {
                progress: ProgressEvent {
                    item_id: item.id,
                    step: 0,
                    total_steps: total,
                    progress_image_url: None,
                    message: "waiting for GPU lock".into(),
                },
            })
        };
        match gpu_lock::acquire(path, token, on_wait).await {
            Ok(Some(g)) => Ok(Some(Some(g))),
            Ok(None) => Ok(None),
            Err(e) => Err(EngineError::Failed(format!(
                "Cannot take the GPU lock {}: {e}",
                path.display()
            ))),
        }
    }

    async fn process(
        &self,
        item: &QueueItem,
        token: &CancellationToken,
    ) -> std::result::Result<(), EngineError> {
        if item.params.generation_mode == GenerationMode::Voice {
            return self.process_voice(item, token).await;
        }
        let (mut job, speeches) = if item.params.generation_mode == GenerationMode::Graph {
            self.graph_job(item)?
        } else {
            (self.engine_job(item)?, Vec::new())
        };
        tokio::select! {
            _ = token.cancelled() => return Err(EngineError::Cancelled),
            r = self.inner.engine.validate(&job) => r?,
        }
        let Some(_lock) = self.gpu_guard(item, token).await? else {
            return Err(EngineError::Cancelled);
        };
        if !speeches.is_empty() {
            self.speak_for_graph(item, &speeches, &mut job, token)
                .await?;
        }
        let this = self.clone();
        let item_id = item.id;
        let progress = move |p: EngineProgress| {
            this.emit(BackendEvent::InvocationProgress {
                progress: ProgressEvent {
                    item_id,
                    step: p.step,
                    total_steps: p.total_steps,
                    progress_image_url: p.preview,
                    message: p.message,
                },
            });
        };
        let output = self.inner.engine.generate(&job, &progress, token).await?;
        drop(_lock);
        if token.is_cancelled() {
            return Err(EngineError::Cancelled);
        }
        self.save_result(item, output).await
    }

    /// Reading text aloud: not a ComfyUI job, the voice engine does it.
    async fn process_voice(
        &self,
        item: &QueueItem,
        token: &CancellationToken,
    ) -> std::result::Result<(), EngineError> {
        let voice = item
            .params
            .voice
            .clone()
            .ok_or_else(|| EngineError::Failed("The voice settings are missing".into()))?;
        if voice.text.trim().is_empty() {
            return Err(EngineError::Failed("There is no text to read".into()));
        }
        let Some(_lock) = self.gpu_guard(item, token).await? else {
            return Err(EngineError::Cancelled);
        };
        self.emit(BackendEvent::InvocationProgress {
            progress: ProgressEvent {
                item_id: item.id,
                step: 0,
                total_steps: 1,
                progress_image_url: None,
                message: "reading aloud".into(),
            },
        });
        let bytes = self.synthesize(&voice, token).await;
        drop(_lock);
        let bytes = bytes?;
        if token.is_cancelled() {
            return Err(EngineError::Cancelled);
        }
        self.save_result(item, EngineOutput::Audio { bytes, ext: "wav" })
            .await
    }

    /// The WAV the voice engine makes of `voice`.
    async fn synthesize(
        &self,
        voice: &VoiceParams,
        token: &CancellationToken,
    ) -> std::result::Result<Vec<u8>, EngineError> {
        let temp = self.inner.data_dir.join("cache").join("temp");
        std::fs::create_dir_all(&temp).map_err(|e| EngineError::Failed(e.to_string()))?;
        let out = temp.join(format!("{}.wav", uuid::Uuid::new_v4().simple()));
        let spoken = self.inner.voice.speak(voice, &out, token).await;
        let bytes = match spoken {
            Ok(_) => std::fs::read(&out)
                .map_err(|e| EngineError::Failed(format!("No audio was made: {e}"))),
            Err(m) if m == "cancelled" => Err(EngineError::Cancelled),
            Err(m) => Err(EngineError::Failed(m)),
        };
        let _ = std::fs::remove_file(&out);
        bytes
    }

    /// Makes the speech a graph reads aloud and adds each sound to what is uploaded before the run. The voice worker is
    /// stopped afterwards: it holds its model in the GPU's memory, which the ComfyUI run that follows needs.
    async fn speak_for_graph(
        &self,
        item: &QueueItem,
        speeches: &[crate::comfy::user_graph::Speech],
        job: &mut EngineJob,
        token: &CancellationToken,
    ) -> std::result::Result<(), EngineError> {
        for (i, speech) in speeches.iter().enumerate() {
            self.emit(BackendEvent::InvocationProgress {
                progress: ProgressEvent {
                    item_id: item.id,
                    step: i as u32,
                    total_steps: speeches.len() as u32,
                    progress_image_url: None,
                    message: "reading aloud".into(),
                },
            });
            let bytes = self.synthesize(&speech.voice, token).await;
            if bytes.is_err() {
                self.inner.voice.shutdown();
            }
            let bytes = bytes?;
            if let Some(graph) = job.graph.as_mut() {
                graph.images.push((speech.name.clone(), bytes));
            }
        }
        self.inner.voice.shutdown();
        if token.is_cancelled() {
            return Err(EngineError::Cancelled);
        }
        Ok(())
    }

    async fn save_result(
        &self,
        item: &QueueItem,
        output: EngineOutput,
    ) -> std::result::Result<(), EngineError> {
        if matches!(output, EngineOutput::Nothing) {
            return Err(EngineError::Failed(
                "ComfyUI finished without a result".into(),
            ));
        }
        if let EngineOutput::Text(text) = output {
            // Text (a picture described as a prompt) is handed to the frontend; nothing goes to the gallery.
            self.set_status(item.id, QueueItemStatus::Completed, |q| {
                q.completed_at = Some(now());
                q.result_text = Some(text);
            });
            return Ok(());
        }
        // What ran, recorded with the picture: a model of the newer families ignores the scheduler setting.
        let sampling = self
            .state()
            .models
            .iter()
            .find(|m| m.key == item.params.model_key)
            .and_then(|m| crate::comfy::split::fixed_sampling(m, item.params.generation_mode));
        let this = self.clone();
        let item = item.clone();
        let image =
            tokio::task::spawn_blocking(move || -> std::result::Result<ImageDTO, String> {
                if let EngineOutput::Audio { bytes, ext } = &output {
                    // Music and speech keep their settings in the database row only; a sound a workflow made also keeps
                    // the graph it came from.
                    let name = images::new_audio_name(ext);
                    let (width, height) = this
                        .inner
                        .files
                        .store_audio(&name, bytes)
                        .map_err(|e| e.to_string())?;
                    return Ok(this.image_dto(ImageDTO {
                        name,
                        media_type: MediaType::Audio,
                        url: String::new(),
                        thumbnail_url: String::new(),
                        width,
                        height,
                        created_at: now(),
                        board_id: item.board_id.clone(),
                        starred: false,
                        is_intermediate: false,
                        category: ImageCategory::General,
                        metadata: Some(item.params.clone()),
                        workflow: item.workflow.clone(),
                    }));
                }
                let (png, video) = match output {
                    EngineOutput::Image(png) => (png, None),
                    EngineOutput::Video { mp4, frame_png } => (frame_png, Some(mp4)),
                    EngineOutput::Audio { .. } | EngineOutput::Text(_) | EngineOutput::Nothing => {
                        unreachable!("handled above")
                    }
                };
                let png = images::to_png(&png).map_err(|e| e.to_string())?;
                let size = image::ImageReader::new(std::io::Cursor::new(&png))
                    .with_guessed_format()
                    .map_err(|e| e.to_string())?
                    .into_dimensions()
                    .map_err(|e| e.to_string())?;
                // With the high-resolution fix the stored size stays the first pass's (the setting the scale applies
                // to), so "use all" and derive do not enlarge twice; the picture's own size is in the image record.
                let mut metadata = if item.params.hires_fix.is_some() {
                    item.params.clone()
                } else {
                    GenerationMetadata {
                        width: size.0,
                        height: size.1,
                        ..item.params.clone()
                    }
                };
                metadata.sampling = sampling;
                if let Some(mp4) = video {
                    // A video carries its settings in the database row only.
                    let name = images::new_video_name();
                    let (width, height) = this
                        .inner
                        .files
                        .store_video(&name, &mp4, &png)
                        .map_err(|e| e.to_string())?;
                    return Ok(this.image_dto(ImageDTO {
                        name,
                        media_type: MediaType::Video,
                        url: String::new(),
                        thumbnail_url: String::new(),
                        width,
                        height,
                        created_at: now(),
                        board_id: item.board_id.clone(),
                        starred: false,
                        is_intermediate: false,
                        category: ImageCategory::General,
                        metadata: Some(metadata),
                        workflow: item.workflow.clone(),
                    }));
                }
                let mut tagged = images::with_text(
                    &png,
                    images::METADATA_KEY,
                    &serde_json::to_string(&metadata).map_err(|e| e.to_string())?,
                )
                .ok_or("broken PNG")?;
                if let Some(w) = &item.workflow {
                    tagged = images::with_text(&tagged, images::WORKFLOW_KEY, &w.to_string())
                        .ok_or("broken PNG")?;
                }
                let name = images::new_name();
                let (width, height) = this
                    .inner
                    .files
                    .store(&name, &tagged)
                    .map_err(|e| e.to_string())?;
                let to_canvas = item.destination == QueueDestination::Canvas;
                Ok(this.image_dto(ImageDTO {
                    name,
                    media_type: MediaType::Image,
                    url: String::new(),
                    thumbnail_url: String::new(),
                    width,
                    height,
                    created_at: now(),
                    board_id: if to_canvas {
                        None
                    } else {
                        item.board_id.clone()
                    },
                    starred: false,
                    is_intermediate: to_canvas
                        || item.destination == QueueDestination::Intermediate
                        || item.params.draft_at.is_some(),
                    // Logos are kept with the assets, not among the generated pictures.
                    category: if item.params.generation_mode == GenerationMode::Logo {
                        ImageCategory::Other
                    } else {
                        ImageCategory::General
                    },
                    metadata: Some(metadata),
                    workflow: item.workflow.clone(),
                }))
            })
            .await
            .map_err(|e| EngineError::Failed(e.to_string()))?
            .map_err(|e| EngineError::Failed(format!("Cannot save the result: {e}")))?;
        self.insert_image(&image)
            .map_err(|e| EngineError::Failed(e.to_string()))?;
        let done = self.set_status(item.id, QueueItemStatus::Completed, |q| {
            q.completed_at = Some(now());
            q.image_name = Some(image.name.clone());
        });
        self.emit(BackendEvent::ImageAdded { image, item: done });
        Ok(())
    }

    pub fn shutdown(&self) {
        self.inner.shutdown.cancel();
        for i in self.inner.installs.lock_safe().iter() {
            i.cancel.cancel();
        }
        self.inner.engine.shutdown();
        self.inner.voice.shutdown();
    }
}

#[cfg(test)]
mod tests {
    use super::panic_message;

    #[test]
    fn a_caught_panic_reads_as_an_internal_error() {
        let caught = std::panic::catch_unwind(|| panic!("graph broke")).unwrap_err();
        assert_eq!(
            panic_message(caught.as_ref()),
            "Internal error: graph broke"
        );
        let caught = std::panic::catch_unwind(|| std::panic::panic_any(42)).unwrap_err();
        assert_eq!(
            panic_message(caught.as_ref()),
            "Internal error: unknown error"
        );
    }
}
