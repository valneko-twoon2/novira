//! The generation queue: enqueue, cancel, pause, retry and the status it reports.
use super::*;

/// The most images one request may queue (the Invoke box's iterations field stops at the same number).
pub const MAX_ITERATIONS: u32 = 1000;

impl Backend {
    pub fn enqueue(&self, req: EnqueueRequest) -> Result<Vec<QueueItem>> {
        if req.iterations > MAX_ITERATIONS {
            return Err(BackendError::Invalid(format!(
                "At most {MAX_ITERATIONS} iterations can be queued at once"
            )));
        }
        if let Some(url) = &req.init_image_url {
            if self.image_name_from_url(url).is_none() {
                return Err(BackendError::Invalid(
                    "The source image must be an image stored in the gallery".into(),
                ));
            }
        }
        guidance::check(&req.guidance, &req.params, req.init_image_url.is_some())
            .map_err(BackendError::Invalid)?;
        let urls = req
            .guidance
            .mask_image_url
            .iter()
            .chain(req.guidance.control_layers.iter().map(|c| &c.image_url))
            .chain(req.guidance.regional_layers.iter().map(|r| &r.image_url))
            .chain(req.guidance.ref_images.iter().map(|r| &r.image_url))
            .chain(req.guidance.reference_pictures.iter());
        for url in urls {
            if self.image_name_from_url(url).is_none() {
                return Err(BackendError::Invalid(
                    "Masks, control images and reference images must be images stored in the gallery".into(),
                ));
            }
        }
        let mut s = self.state();
        let batch_id = new_id("batch");
        let t = now();
        let mut items = Vec::new();
        for i in 0..req.iterations.max(1) {
            let seed = if req.randomize_seed {
                random_seed()
            } else {
                batch_seed(req.params.seed, i)
            };
            let id = s.next_item_id;
            s.next_item_id += 1;
            items.push(QueueItem {
                id,
                batch_id: batch_id.clone(),
                status: QueueItemStatus::Pending,
                origin: req.origin,
                destination: req.destination,
                params: GenerationMetadata {
                    seed,
                    ref_images: (!req.guidance.ref_images.is_empty())
                        .then(|| req.guidance.ref_images.clone()),
                    control_layers: (!req.guidance.control_layers.is_empty())
                        .then(|| req.guidance.control_layers.clone()),
                    regional_layers: (!req.guidance.regional_layers.is_empty())
                        .then(|| req.guidance.regional_layers.clone()),
                    reference_pictures: (!req.guidance.reference_pictures.is_empty())
                        .then(|| req.guidance.reference_pictures.clone()),
                    ..req.params.clone()
                },
                board_id: req.board_id.clone(),
                init_image_url: req.init_image_url.clone(),
                workflow: req.workflow.clone(),
                comfy_graph: req.comfy_graph.clone(),
                guidance: req.guidance.clone(),
                created_at: t,
                started_at: None,
                completed_at: None,
                image_name: None,
                error: None,
                error_kind: None,
                result_text: None,
            });
        }
        if req.prepend {
            let at = s
                .queue
                .iter()
                .position(|q| q.status == QueueItemStatus::Pending)
                .unwrap_or(s.queue.len());
            s.queue.splice(at..at, items.iter().cloned());
        } else {
            s.queue.extend(items.iter().cloned());
        }
        drop(s);
        if let Err(e) = self.persist_items(&items) {
            // A job that could not be saved is refused as a whole: leaving it in the queue would run it although the caller was told it failed.
            let mut s = self.state();
            s.queue.retain(|q| !items.iter().any(|i| i.id == q.id));
            return Err(e);
        }
        for item in &items {
            self.emit(BackendEvent::QueueItemStatusChanged { item: item.clone() });
        }
        self.inner.wake.notify_one();
        Ok(items)
    }

    fn persist_items(&self, items: &[QueueItem]) -> Result<()> {
        let ids: Vec<String> = items.iter().map(|q| q.id.to_string()).collect();
        self.db().put_many(
            Table::Queue,
            items
                .iter()
                .zip(&ids)
                .map(|(q, id)| (id.as_str(), q.id as i64, q)),
        )?;
        Ok(())
    }

    /// Updates an item, persists it and tells the frontend. `None` when the item is gone (e.g. queue cleared).
    pub(super) fn set_status(
        &self,
        id: u64,
        status: QueueItemStatus,
        f: impl FnOnce(&mut QueueItem),
    ) -> Option<QueueItem> {
        let mut s = self.state();
        let item = s.queue.iter_mut().find(|q| q.id == id)?;
        item.status = status;
        f(item);
        let item = item.clone();
        drop(s);
        if let Err(e) = self.persist_items(std::slice::from_ref(&item)) {
            crate::applog::warn("queue", e.to_string());
        }
        self.emit(BackendEvent::QueueItemStatusChanged { item: item.clone() });
        Some(item)
    }

    pub fn cancel_queue_item(&self, id: u64) {
        let token = {
            let s = self.state();
            let Some(item) = s.queue.iter().find(|q| q.id == id) else {
                return;
            };
            if !matches!(
                item.status,
                QueueItemStatus::Pending | QueueItemStatus::InProgress
            ) {
                return;
            }
            s.running
                .as_ref()
                .filter(|(rid, _)| *rid == id)
                .map(|(_, t)| t.clone())
        };
        if let Some(t) = token {
            t.cancel();
        }
        self.set_status(id, QueueItemStatus::Canceled, |q| {
            q.completed_at = Some(now())
        });
    }

    pub fn cancel_batch(&self, batch_id: &str) {
        let ids: Vec<u64> = self
            .state()
            .queue
            .iter()
            .filter(|q| q.batch_id == batch_id)
            .map(|q| q.id)
            .collect();
        for id in ids {
            self.cancel_queue_item(id);
        }
    }

    pub fn clear_queue(&self) -> Result<()> {
        let mut s = self.state();
        if let Some((_, t)) = &s.running {
            t.cancel();
        }
        s.queue.clear();
        drop(s);
        self.db().clear(Table::Queue)?;
        self.emit(BackendEvent::QueueCleared { items: Vec::new() });
        Ok(())
    }

    pub fn prune_queue(&self) -> Result<()> {
        let mut s = self.state();
        let removed: Vec<String> = s
            .queue
            .iter()
            .filter(|q| {
                !matches!(
                    q.status,
                    QueueItemStatus::Pending | QueueItemStatus::InProgress
                )
            })
            .map(|q| q.id.to_string())
            .collect();
        s.queue.retain(|q| {
            matches!(
                q.status,
                QueueItemStatus::Pending | QueueItemStatus::InProgress
            )
        });
        let items = s.queue.clone();
        drop(s);
        self.db().delete(
            Table::Queue,
            &removed.iter().map(String::as_str).collect::<Vec<_>>(),
        )?;
        self.emit(BackendEvent::QueueCleared { items });
        Ok(())
    }

    pub fn pause_processor(&self) {
        self.state().paused = true;
        self.emit(BackendEvent::ProcessorState { is_paused: true });
    }

    pub fn resume_processor(&self) {
        self.state().paused = false;
        self.emit(BackendEvent::ProcessorState { is_paused: false });
        self.inner.wake.notify_one();
    }

    /// Queues a failed or cancelled item again, with the same seed. `size` makes it smaller (after running out of
    /// memory): multiples of 8, at least 64, and not larger than before on either side.
    pub fn retry_queue_item(&self, id: u64, size: Option<RetrySize>) -> Result<Option<QueueItem>> {
        let item = {
            let s = self.state();
            match s.queue.iter().find(|q| q.id == id) {
                Some(q)
                    if matches!(
                        q.status,
                        QueueItemStatus::Failed | QueueItemStatus::Canceled
                    ) =>
                {
                    q.clone()
                }
                _ => return Ok(None),
            }
        };
        let mut params = item.params;
        if let Some(size) = size {
            check_retry_size(size, &params)?;
            params.width = size.width;
            params.height = size.height;
        }
        let items = self.enqueue(EnqueueRequest {
            origin: item.origin,
            destination: item.destination,
            params,
            iterations: 1,
            randomize_seed: false,
            prepend: false,
            board_id: item.board_id,
            init_image_url: item.init_image_url,
            workflow: item.workflow,
            comfy_graph: item.comfy_graph,
            guidance: item.guidance,
        })?;
        Ok(items.into_iter().next())
    }

    pub fn queue_snapshot(&self) -> QueueSnapshot {
        let s = self.state();
        QueueSnapshot {
            items: s.queue.clone(),
            status: queue_status(&s),
        }
    }
}

/// A smaller size is only for a picture made at a size (not a graph, an upscale or audio), and must stay a size the
/// graphs can use.
fn check_retry_size(size: RetrySize, params: &GenerationMetadata) -> Result<()> {
    if !matches!(
        params.generation_mode,
        GenerationMode::Txt2img
            | GenerationMode::Img2img
            | GenerationMode::Inpaint
            | GenerationMode::Outpaint
    ) {
        return Err(BackendError::Invalid(
            "Only pictures made from a prompt can be retried at another size".into(),
        ));
    }
    let fits = |v: u32, before: u32| v >= 64 && v.is_multiple_of(8) && v <= before.max(64);
    if !fits(size.width, params.width) || !fits(size.height, params.height) {
        return Err(BackendError::Invalid(format!(
            "A retry size must be multiples of 8 from 64 up to the size before ({}x{}), not {}x{}",
            params.width, params.height, size.width, size.height
        )));
    }
    Ok(())
}
