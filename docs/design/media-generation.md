---
covers:
  - backend/crates/novira-core/src/comfy/video.rs
  - backend/crates/novira-core/src/comfy/music.rs
  - backend/crates/novira-core/src/comfy/logo.rs
  - backend/crates/novira-core/src/comfy/client.rs
  - backend/crates/novira-core/src/voice/**
  - backend/crates/novira-core/src/packs.rs
  - backend/crates/novira-core/src/service/pack_store.rs
  - backend/crates/novira-core/src/service/worker.rs
  - backend/crates/novira-core/src/media/audio.rs
  - backend/crates/novira-core/src/child_job.rs
  - frontend/src/state/media/**
  - frontend/src/features/video/buildRequest.ts
  - frontend/src/features/music/buildRequest.ts
  - frontend/src/features/voice/buildRequest.ts
  - frontend/src/features/logo/buildRequest.ts
---
# Media generation: video, music, logo and voice

The generation modes besides pictures. Video makes a clip from text or animates a gallery picture (Wan 2.2 TI2V 5B, or its 4-step Turbo model). Music makes a song from style tags and lyrics (ACE-Step 1.5 turbo). Logo draws lettering with Z-Image-Turbo. Voice reads text aloud with Qwen3-TTS. Video, music and logo are ComfyUI jobs built from core nodes; voice runs in its own Python worker process, started with ComfyUI's Python. Their model files are model packs downloaded on request (see models.md).

## Behaviour

### Shared

- The modes are the `GenerationMode` values `video`, `music`, `logo` and `voice` (`backend/crates/novira-core/src/types.rs`). The queue worker sends `voice` to `process_voice` (`backend/crates/novira-core/src/service/worker.rs`). `comfy::graph::build` (`backend/crates/novira-core/src/comfy/graph.rs`) hands the other three to their own graph files.
- Every job takes the GPU lock when one is configured, voice included (`gpu_guard`). An out-of-memory failure is marked on the queue item for every engine, the voice worker included.
- Packs are defined in `backend/crates/novira-core/src/packs.rs`. A ComfyUI pack lives under `<data>/models/<kind>/` (it is also found under `<root>/<kind>/` of any `modelRoots` folder, read only; see model-packs.md), and ComfyUI reads it through the `novira_<kind>` sections of `extra_model_paths.yaml`. The voice pack is not a ComfyUI pack. Pack downloads use the fixed Hugging Face and GitHub addresses in that file and send no token.
- `install_pack` (`backend/crates/novira-core/src/service/pack_store.rs`) starts a download in the background; a second request for a running pack is ignored. Cancelling resets the status to what is on disk. Progress arrives as `pack` events and in `bootstrap`.
- Results are gallery entries (`save_result` in `backend/crates/novira-core/src/service/worker.rs`). Video and audio files are stored as they are under `<data>/outputs/`; their settings live only in the database row, and the thumbnail is a still picture. The `novira-image` scheme answers `Range` requests, so audio and video can seek.
- Audio files are `mp3`, `wav` or `flac` (`backend/crates/novira-core/src/media/audio.rs`). A file is stored only when its first bytes are WAV, FLAC or MP3.
- The Video and Music tabs are not the only way: the workflow editor offers ComfyUI's own nodes, and its ready-made graphs make a song or a video on the same model packs (the files these tabs download), saved to the gallery the same way. That path is in [workflow-graphs.md](workflow-graphs.md).

### Video

- Model pack: Wan 2.2 TI2V 5B, about 18 GB. Files: the diffusion model `wan2.2_ti2v_5B_fp16.safetensors`, the text encoder `umt5_xxl_fp8_e4m3fn_scaled.safetensors` and the VAE `wan2.2_vae.safetensors` (`VIDEO_FILES`).
- Turbo: the 4-step distilled model, about 10 GB, one diffusion file. Its text encoder and VAE are the video pack's files. The model key `video-turbo` (`TURBO_KEY`) selects it. The sampling shift is 5 for Turbo and 8 otherwise (`ModelSamplingSD3`).
- Graph (`backend/crates/novira-core/src/comfy/video.rs`): UNETLoader (`fp8_e4m3fn` weights when `videoFp8` is set), CLIPLoader of type `wan`, VAELoader, two CLIPTextEncode, Wan22ImageToVideoLatent (a `LoadImage` start image when a source picture is given), KSampler (sampler and scheduler from `sampler_for`, denoise 1), VAEDecode or, with `videoTiledDecode`, VAEDecodeTiled (tile 512, overlap 64, temporal 64 and 8), CreateVideo, and SaveVideo (MP4, prefix `video/novira`). The first frame goes through ImageFromBatch and PreviewImage as the thumbnail.
- Frames: `frames_for` clamps the request to 5 to 241 and rounds down to 4n+1 (default 49). The form turns seconds and fps into frames the same way (`framesFor` in `frontend/src/state/media/video.ts`).
- Frame rate: clamped to 1 to 60, default 24.
- Size: rounded to the nearest multiple of 32, at least 64. The backend sets no maximum. The form offers seven sizes, the largest 1024x576.
- Steps: at least 1 in the backend. The form allows 4 to 50 steps and CFG 1 to 12. The standard preset is 20 steps and CFG 5; the Turbo preset is 4 steps and CFG 1.
- A video cannot be a source picture: the worker refuses it when the job starts, and the form refuses it first.
- `validate` requires the Wan22ImageToVideoLatent node (`backend/crates/novira-core/src/comfy/client.rs`).
- Installed video models (Wan 2.1, the Wan 2.2 A14B pair, HunyuanVideo, LTX-Video) use their own graphs and need no pack: see model-families.md.
- Result: `EngineOutput::Video`, stored as `<uuid>.mp4` with `mediaType: video`.
- Measured once on an RTX 4070 Ti: a 2 s clip of 704x704 at 20 steps, made from a picture, in about 74 s. The pack installed in about 18 minutes.

### Music

- Model pack: ACE-Step 1.5 turbo, one all-in-one checkpoint `ace_step_1.5_turbo_aio.safetensors`, about 10 GB, in the `checkpoints` folder (`MUSIC_FILES`).
- Graph (`backend/crates/novira-core/src/comfy/music.rs`): CheckpointLoaderSimple, TextEncodeAceStepAudio1.5 (the style tags are the positive prompt; lyrics, seed, bpm, duration, time signature, language and key; CFG 2.0 fixed), ConditioningZeroOut as the negative, ModelSamplingAuraFlow (shift 3), EmptyAceStep1.5LatentAudio, KSampler (euler, simple; steps and CFG from the request), VAEDecodeAudio, and SaveAudioAdvanced (FLAC).
- Checks before the graph: the tags must not be empty; length is clamped to 10 to 240 s; bpm to 10 to 300; a key must be `<root> major` or `<root> minor`, else C major; the time signature is 2, 3, 4 or 6, else 4; a language not in ACE-Step's list becomes `unknown`; instrumental or empty lyrics become `[Instrumental]`.
- `validate` requires the TextEncodeAceStepAudio1.5 node.
- The form allows 10 to 240 s, bpm 40 to 220, 4 to 50 steps and CFG 1 to 8, and offers 12 lyric languages.
- LoRAs and the base-model check do not apply.
- Result: `EngineOutput::Audio`, read from the history's `audio` output and stored as `<uuid>.flac` with `mediaType: audio`. Only WAV is decoded for its thumbnail; for FLAC the waveform picture is drawn from the file's bytes.
- Measured once on an RTX 4070 Ti: a 30 s instrumental in about 26 s.

### Logo

- Model pack: Z-Image-Turbo, 8-bit build, about 12 GB. Files: `z-image-turbo-fp8-e4m3fn.safetensors` (diffusion, a T5B repack), `qwen_3_4b_fp8_mixed.safetensors` (text encoder) and `ae.safetensors` (VAE) (`LOGO_FILES`). The user installs it with the button on the Logo screen.
- Graph (`backend/crates/novira-core/src/comfy/logo.rs`): UNETLoader, ModelSamplingAuraFlow (shift 3), CLIPLoader of type `lumina2`, VAELoader, CLIPTextEncode, ConditioningZeroOut as the negative, EmptySD3LatentImage, KSampler (res_multistep, simple), VAEDecode and SaveImage (prefix `logo/novira`). No custom node pack is used.
- Steps are capped at 30, CFG is clamped to 1 to 5, and width and height are rounded to multiples of 16 within 256 to 2048. A prompt is required. LoRAs and the base-model check do not apply.
- The form sends 8 steps and CFG 1, offers the sizes 1024x1024, 1536x768 and 768x1536, 1 to 4 candidates per press, and up to 60 characters of lettering. It writes an English prompt around the lettering in double quotes (`buildLogoPrompt` in `frontend/src/features/logo/buildRequest.ts`).
- Result: a PNG stored through the picture path with `category: other`, so it is listed among the gallery's assets.
- Run on a real ComfyUI on 2026-10-06 with the 8-bit files: English lettering was correct and Japanese came out garbled. The Logo screen says so.

### Voice

- Model: Qwen3-TTS, Apache-2.0 according to `backend/crates/novira-core/src/voice/mod.rs`. Two 1.7B repositories are downloaded: `Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice` for preset mode (built-in speakers; the form lists nine) and `Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign` for design mode (a voice described in words; the form requires the description). The form offers 10 languages besides `Auto`.
- Runtime: `QwenVoice` starts `backend/crates/novira-core/src/voice/worker.py` (copied to `<data>/voice/worker.py`) with the Python from `comfyuiPython` or, when that is unset, the one in ComfyUI's folder. Requests and answers are JSON lines; each answer carries a marker, so library output on stdout is ignored. Library logs go to `<data>/logs/voice.log`. The worker sets `HF_HUB_OFFLINE=1`, keeps one model at a time, loads it in bfloat16 on `cuda:0`, and writes WAV.
- The libraries come from `<data>/voice/site`. The voice path does not call ComfyUI's server and is not checked by `validate`. It takes the GPU lock like the other jobs. A workflow graph with a Read Aloud node uses the same engine before its ComfyUI run (see [workflow-graphs.md](workflow-graphs.md)); the worker is stopped after the speech so ComfyUI has the GPU's memory.
- Lifetime: the worker starts on the first request and waits for its ready line. It is kept between requests and stopped after 300 s without one; the idle check runs every 30 s. Debug builds may shorten the idle time with `NOVIRA_TEST_VOICE_IDLE_MS`. Waiting for one answer gives up after 900 s. On Windows the worker is bound to a job object (`backend/crates/novira-core/src/child_job.rs`), and `Backend::shutdown` stops it first.
- Cancelling a running request kills the process; the next request starts a new one.
- Empty text is refused. The WAV is written to `<data>/cache/temp`, read, and the temporary file is removed before the gallery entry is saved. It is stored as `<uuid>.wav` with `mediaType: audio`; the thumbnail is the real waveform, because WAV is decoded.
- Install (`voice::install`): needs the same Python. Runs `pip install --dry-run --report` for `qwen-tts`, takes the libraries that would be added minus the demo-only ones (`SKIPPED_LIBRARIES`), and installs them pinned with `pip --target <data>/voice/site --no-deps`; then writes `.ready`. It then lists the model repositories through the Hugging Face tree API, downloads only model files (no READMEs, pictures, markdown, dot files or asset folders) to `.downloads/<n>.part`, renames each when complete, and writes `.complete` per model. Finished files are skipped on a rerun. The Hugging Face token is sent when one is set.
- Caches (Hugging Face, Torch, pip, temporary files) are redirected into `<data>/cache/` for the voice processes.
- Measured once on an RTX 4070 Ti: a Japanese sentence in about 12 s with the 0.6B model, which the code does not install. A later run after the end-to-end install took about 19 s.
- `backend/crates/novira-core/tests/media_live.rs` runs voice, music and video end to end. Its tests are ignored by default and use the GPU and large downloads.

## Not implemented

Absent from the current code:

- A sound track for video (the Wan graph has no audio node).
- An end frame or a second picture for video (only a start image).
- Using a video as a source picture.
- Continuing, covering or editing an existing song (the music graph takes no audio input).
- Voice cloning from a recording (only the two models above).
- Voice on the CPU or on other GPUs (the worker uses `cuda:0`), and streamed speech (each request returns the whole clip).
- LoRAs for video, music or logo.
