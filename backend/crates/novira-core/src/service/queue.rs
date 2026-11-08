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
        // Held until the items are saved and announced: the worker may pick one up as soon as it is in the state, and its
        // moves must come after the item's own "pending" event and save.
        let _transition = self.transition();
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
        #[cfg(test)]
        {
            let hook = self.inner.persist_hook.lock_safe().clone();
            if let Some(hook) = hook {
                hook();
            }
        }
        let ids: Vec<String> = items.iter().map(|q| q.id.to_string()).collect();
        let mut db = self.db();
        db.put_many(
            Table::Queue,
            items
                .iter()
                .zip(&ids)
                .map(|(q, id)| (id.as_str(), q.id as i64, q)),
        )?;
        // The next id is kept apart from the rows: clearing or pruning the queue must not let an id be given twice, since
        // draft groups and other stored references name the items by id.
        if let Some(last) = items.iter().map(|q| q.id).max() {
            db.set_meta(NEXT_QUEUE_ID_META, &(last + 1).to_string())?;
        }
        Ok(())
    }

    /// The lock that orders the queue's changes (see `Inner::queue_transition`).
    fn transition(&self) -> std::sync::MutexGuard<'_, ()> {
        self.inner.queue_transition.lock_safe()
    }

    /// Moves an item from a status in `from` to `status`, persists it and tells the frontend, all under the transition
    /// lock: the events of an item follow its states, and a removed item is never written back. `None` when nothing
    /// moved: the item is gone (queue cleared) or its status is not in `from`, so a finished item never moves again.
    fn move_item(
        &self,
        id: u64,
        from: &[QueueItemStatus],
        status: QueueItemStatus,
        f: impl FnOnce(&mut QueueItem),
    ) -> Option<QueueItem> {
        let _transition = self.transition();
        self.move_item_locked(id, from, status, f)
    }

    fn move_item_locked(
        &self,
        id: u64,
        from: &[QueueItemStatus],
        status: QueueItemStatus,
        f: impl FnOnce(&mut QueueItem),
    ) -> Option<QueueItem> {
        let item = {
            let mut s = self.state();
            let item = s.queue.iter_mut().find(|q| q.id == id)?;
            if !from.contains(&item.status) {
                return None;
            }
            item.status = status;
            f(item);
            item.clone()
        };
        if let Err(e) = self.persist_items(std::slice::from_ref(&item)) {
            crate::applog::warn("queue", e.to_string());
        }
        self.emit(BackendEvent::QueueItemStatusChanged { item: item.clone() });
        Some(item)
    }

    /// The worker takes a pending item: pending to in progress, only if it is still pending (a cancel or a clear may have
    /// come first, then the job must not run).
    pub(super) fn start_item(&self, id: u64) -> Option<QueueItem> {
        self.move_item(
            id,
            &[QueueItemStatus::Pending],
            QueueItemStatus::InProgress,
            |q| q.started_at = Some(now()),
        )
    }

    /// Ends an unfinished item (`status` is completed, failed or canceled). `None` when it was already ended or removed.
    pub(super) fn set_status(
        &self,
        id: u64,
        status: QueueItemStatus,
        f: impl FnOnce(&mut QueueItem),
    ) -> Option<QueueItem> {
        self.move_item(
            id,
            &[QueueItemStatus::Pending, QueueItemStatus::InProgress],
            status,
            f,
        )
    }

    pub fn cancel_queue_item(&self, id: u64) {
        // One step under the lock: the check, the token and the move, so the worker cannot start the item in between.
        let _transition = self.transition();
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
        self.move_item_locked(
            id,
            &[QueueItemStatus::Pending, QueueItemStatus::InProgress],
            QueueItemStatus::Canceled,
            |q| q.completed_at = Some(now()),
        );
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

    /// Cancels every item that is still waiting, in one step under the transition lock (the running one is left alone, and an
    /// item the worker takes meanwhile is not cancelled half way: the move only leaves Pending).
    pub fn cancel_pending(&self) {
        let _transition = self.transition();
        let ids: Vec<u64> = self
            .state()
            .queue
            .iter()
            .filter(|q| q.status == QueueItemStatus::Pending)
            .map(|q| q.id)
            .collect();
        for id in ids {
            self.move_item_locked(
                id,
                &[QueueItemStatus::Pending],
                QueueItemStatus::Canceled,
                |q| q.completed_at = Some(now()),
            );
        }
    }

    pub fn clear_queue(&self) -> Result<()> {
        let _transition = self.transition();
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
        let _transition = self.transition();
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
        // A job of the removed logo mode fails every time, so a retry is refused rather than queued.
        if item.params.generation_mode == GenerationMode::Logo {
            return Err(BackendError::Invalid(
                crate::comfy::graph::LOGO_REMOVED.into(),
            ));
        }
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::ProgressFn;
    use std::sync::mpsc;
    use std::time::Duration;

    /// An engine that never runs anything: these tests move items by hand, with no worker.
    struct NoEngine;

    #[async_trait::async_trait]
    impl Engine for NoEngine {
        async fn generate(
            &self,
            _job: &EngineJob,
            _progress: ProgressFn<'_>,
            _cancel: &CancellationToken,
        ) -> std::result::Result<EngineOutput, EngineError> {
            Err(EngineError::Cancelled)
        }
    }

    fn open(dir: &std::path::Path) -> Backend {
        Backend::open_with_engine(
            BackendConfig {
                data_dir: dir.to_path_buf(),
                image_url_base: "http://novira-image.localhost".into(),
                settings: Settings {
                    gpu_lock: String::new(),
                    ..Settings::default()
                },
            },
            Arc::new(NoEngine),
        )
        .unwrap()
    }

    fn one_item(b: &Backend) -> u64 {
        let req: EnqueueRequest = serde_json::from_value(serde_json::json!({
            "origin": "generate", "destination": "gallery", "iterations": 1, "randomizeSeed": false,
            "prepend": false, "boardId": null,
            "params": {
                "generationMode": "txt2img", "positivePrompt": "p", "negativePrompt": "", "modelKey": "none",
                "modelName": "Base", "vaeKey": null, "seed": 10, "steps": 3, "cfgScale": 7, "cfgRescale": 0,
                "scheduler": "euler", "width": 512, "height": 512, "clipSkip": 0, "seamlessX": false,
                "seamlessY": false, "loras": []
            }
        }))
        .unwrap();
        b.enqueue(req).unwrap()[0].id
    }

    /// The statuses announced for an item, in the order the listener got them.
    fn record(b: &Backend) -> Arc<Mutex<Vec<QueueItemStatus>>> {
        let seen = Arc::new(Mutex::new(Vec::new()));
        let sink = seen.clone();
        b.set_event_sink(Arc::new(move |e| {
            if let BackendEvent::QueueItemStatusChanged { item } = e {
                sink.lock().unwrap().push(item.status);
            }
        }));
        seen
    }

    fn status_of(b: &Backend, id: u64) -> Option<QueueItemStatus> {
        b.queue_snapshot()
            .items
            .iter()
            .find(|q| q.id == id)
            .map(|q| q.status)
    }

    /// Holds the thread named `mover` inside the queue's save until `go` is sent; `reached` says it is there.
    fn hold_mover(b: &Backend) -> (mpsc::Receiver<()>, mpsc::Sender<()>) {
        let (reached_tx, reached_rx) = mpsc::channel::<()>();
        let (go_tx, go_rx) = mpsc::channel::<()>();
        let (reached_tx, go_rx) = (Mutex::new(reached_tx), Mutex::new(go_rx));
        *b.inner.persist_hook.lock().unwrap() = Some(Arc::new(move || {
            if std::thread::current().name() == Some("mover") {
                reached_tx.lock().unwrap().send(()).unwrap();
                go_rx.lock().unwrap().recv().unwrap();
            }
        }));
        (reached_rx, go_tx)
    }

    fn mover<T: Send + 'static>(
        f: impl FnOnce() -> T + Send + 'static,
    ) -> std::thread::JoinHandle<T> {
        std::thread::Builder::new()
            .name("mover".into())
            .spawn(f)
            .unwrap()
    }

    #[test]
    fn events_of_an_item_follow_its_states_when_a_cancel_overtakes_a_start() {
        let dir = tempfile::tempdir().unwrap();
        let b = open(dir.path());
        let id = one_item(&b);
        let seen = record(&b);
        let (reached, go) = hold_mover(&b);
        // The start is held after it changed the state and before it saved and announced.
        let start = {
            let b = b.clone();
            mover(move || b.set_status(id, QueueItemStatus::InProgress, |_| {}))
        };
        reached.recv().unwrap();
        let cancel = {
            let b = b.clone();
            std::thread::spawn(move || b.cancel_queue_item(id))
        };
        // The cancel must wait for the start's announcement (it cannot finish first); give it time to show if it does.
        std::thread::sleep(Duration::from_millis(200));
        go.send(()).unwrap();
        start.join().unwrap();
        cancel.join().unwrap();
        assert_eq!(status_of(&b, id), Some(QueueItemStatus::Canceled));
        assert_eq!(
            *seen.lock().unwrap(),
            vec![QueueItemStatus::InProgress, QueueItemStatus::Canceled],
            "the last event must be the final status"
        );
    }

    #[test]
    fn a_clear_during_a_save_is_not_undone_by_the_late_save() {
        let dir = tempfile::tempdir().unwrap();
        let b = open(dir.path());
        let id = one_item(&b);
        let (reached, go) = hold_mover(&b);
        let cancel = {
            let b = b.clone();
            mover(move || b.cancel_queue_item(id))
        };
        reached.recv().unwrap();
        let (done_tx, done_rx) = mpsc::channel();
        let clear = {
            let b = b.clone();
            std::thread::spawn(move || {
                b.clear_queue().unwrap();
                done_tx.send(()).unwrap();
            })
        };
        // A clear that is not ordered after the held save finishes at once; one that waits for it does not.
        let _ = done_rx.recv_timeout(Duration::from_millis(300));
        go.send(()).unwrap();
        cancel.join().unwrap();
        clear.join().unwrap();
        assert!(b.queue_snapshot().items.is_empty());
        drop(b);
        let again = open(dir.path());
        assert!(
            again.queue_snapshot().items.is_empty(),
            "the cleared item came back after a restart"
        );
    }

    #[test]
    fn a_finished_item_never_moves_again_and_announces_nothing_more() {
        let dir = tempfile::tempdir().unwrap();
        let b = open(dir.path());
        let id = one_item(&b);
        let seen = record(&b);
        b.cancel_queue_item(id);
        // The worker took the item just before the cancel: its start and its end must not change the canceled item.
        assert!(b
            .set_status(id, QueueItemStatus::InProgress, |_| {})
            .is_none());
        assert!(b
            .set_status(id, QueueItemStatus::Completed, |_| {})
            .is_none());
        b.cancel_queue_item(id);
        assert_eq!(status_of(&b, id), Some(QueueItemStatus::Canceled));
        assert_eq!(*seen.lock().unwrap(), vec![QueueItemStatus::Canceled]);
    }

    /// A job cancelled while it finished (the cancel came after the worker's last look at its token): the item stays
    /// canceled, the picture is kept, and the picture is announced with the item as the state holds it.
    #[test]
    fn a_picture_saved_after_a_cancel_is_announced_with_the_canceled_item() {
        let dir = tempfile::tempdir().unwrap();
        let b = open(dir.path());
        let id = one_item(&b);
        let item = b.queue_snapshot().items[0].clone();
        let log = Arc::new(Mutex::new(Vec::new()));
        let sink = log.clone();
        b.set_event_sink(Arc::new(move |e| {
            if let BackendEvent::ImageAdded { item, .. } = e {
                sink.lock().unwrap().push(item);
            }
        }));
        b.cancel_queue_item(id);
        let mut png = std::io::Cursor::new(Vec::new());
        image::DynamicImage::ImageRgb8(image::RgbImage::new(8, 8))
            .write_to(&mut png, image::ImageFormat::Png)
            .unwrap();
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        rt.block_on(b.save_result(&item, EngineOutput::Image(png.into_inner())))
            .unwrap();
        assert_eq!(b.bootstrap().images.len(), 1, "the picture is kept");
        let announced = log.lock().unwrap()[0]
            .clone()
            .expect("the item is still in the queue");
        assert_eq!(announced.status, QueueItemStatus::Canceled);
        assert_eq!(announced.image_name, None);
        assert_eq!(status_of(&b, id), Some(QueueItemStatus::Canceled));
        // The text of a cancelled job is dropped: the item stays as it is.
        rt.block_on(b.save_result(&item, EngineOutput::Text("t".into())))
            .unwrap();
        assert_eq!(b.queue_snapshot().items[0].result_text, None);
        // A cleared item has no snapshot to announce.
        b.clear_queue().unwrap();
        let mut png = std::io::Cursor::new(Vec::new());
        image::DynamicImage::ImageRgb8(image::RgbImage::new(8, 8))
            .write_to(&mut png, image::ImageFormat::Png)
            .unwrap();
        rt.block_on(b.save_result(&item, EngineOutput::Image(png.into_inner())))
            .unwrap();
        assert_eq!(log.lock().unwrap().len(), 2);
        assert!(log.lock().unwrap()[1].is_none());
    }
}
