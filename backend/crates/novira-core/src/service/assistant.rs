//! The AI assistant: which tool is chosen, signing in, a request and the answers to its tool calls.
use super::*;
use std::sync::atomic::{AtomicU64, Ordering};

/// Numbers the requests, so a request that ends clears only its own state.
static NEXT_RUN: AtomicU64 = AtomicU64::new(1);

impl Backend {
    /// Which assistant tool is selected and whether it is installed and signed in.
    pub async fn agent_status(&self) -> agent::AgentStatus {
        agent::status(&self.inner.data_dir, None).await
    }

    /// Selects the tool and always runs its sign-in (it opens the browser), even when the tool is already
    /// signed in, so the user signs in on purpose. Reports the state afterwards.
    pub async fn agent_login(&self, provider: agent::AgentProvider) -> Result<agent::AgentStatus> {
        if provider == agent::AgentProvider::Openai {
            return Err(BackendError::Invalid(
                "A server has no sign-in: enter its address and model instead".into(),
            ));
        }
        if !agent::status_of(provider, None).await.installed {
            return Err(BackendError::Invalid(format!(
                "{provider:?} is not installed on this PC"
            )));
        }
        agent::save_provider(&self.inner.data_dir, provider).map_err(BackendError::Internal)?;
        agent::login(provider, None)
            .await
            .map_err(BackendError::Internal)?;
        Ok(agent::status_of(provider, None).await)
    }

    /// The assistant's fact look-up: up to three Wikipedia articles (`ja` or `en`) about a short query. The words leave
    /// the PC, so the window asks the user first; the host, the language and the limits are fixed in `agent::reference`.
    pub async fn lookup_reference(
        &self,
        language: &str,
        query: &str,
    ) -> Result<Vec<agent::reference::ReferenceHit>> {
        agent::reference::lookup(language, query)
            .await
            .map_err(BackendError::Invalid)
    }

    /// Runs one request. Its tool calls go to the window as `agent_tool_call` events and wait for `agent_tool_result`.
    /// One request runs at a time.
    pub async fn agent_chat(&self, request: agent::AgentRequest) -> Result<agent::AgentReply> {
        let provider = agent::load_provider(&self.inner.data_dir).ok_or_else(|| {
            BackendError::Invalid("Choose Claude, Codex or a server first".into())
        })?;
        self.agent_chat_with(provider, None, request).await
    }

    /// `agent_chat` with the tool's program given (tests run a fake one).
    pub async fn agent_chat_with(
        &self,
        provider: agent::AgentProvider,
        exe: Option<&Path>,
        mut request: agent::AgentRequest,
    ) -> Result<agent::AgentReply> {
        request.attached = self.agent_attachments(&request.images).await?;
        let sink = self.inner.events.read_safe().clone();
        // A tool that shows the model a picture names a stored picture; it is read here, as an attachment is.
        let inner = self.inner.clone();
        let pictures: agent::relay::PictureReader = Arc::new(move |name: &str| {
            if !images::is_valid_name(name) || images::is_video(name) || images::is_audio(name) {
                return Err(format!("{name} is not a picture of the gallery"));
            }
            let bytes = inner
                .files
                .read_original(name)
                .ok_or_else(|| format!("{name} is no longer in the gallery"))?;
            agent::attach::prepare(&bytes)
        });
        let relay = Arc::new(
            agent::Relay::new(move |call| {
                if let Some(sink) = &sink {
                    sink(BackendEvent::AgentToolCall { call });
                }
            })
            .with_pictures(pictures),
        );
        let id = NEXT_RUN.fetch_add(1, Ordering::Relaxed);
        let cancel = CancellationToken::new();
        {
            let mut running = self.inner.agent_run.lock_safe();
            if running.is_some() {
                return Err(BackendError::Invalid(
                    "The assistant is already working on a request".into(),
                ));
            }
            *running = Some(AgentRun {
                id,
                cancel: cancel.clone(),
                relay: relay.clone(),
            });
        }
        let result = tokio::select! {
            r = self.run_agent(provider, exe, &request, relay) => r,
            _ = cancel.cancelled() => Err(BackendError::Invalid("Stopped".into())),
        };
        // The relay goes with the request: a late answer finds nothing waiting.
        let mut running = self.inner.agent_run.lock_safe();
        if running.as_ref().is_some_and(|r| r.id == id) {
            *running = None;
        }
        result
    }

    /// The pictures the user attached, read from the gallery by name and made ready for the model. Only stored
    /// pictures are taken (no video or sound), at most `attach::MAX_ATTACHMENTS`.
    async fn agent_attachments(&self, names: &[String]) -> Result<Vec<agent::AgentImage>> {
        if names.len() > agent::attach::MAX_ATTACHMENTS {
            return Err(BackendError::Invalid(format!(
                "At most {} pictures can go with one message",
                agent::attach::MAX_ATTACHMENTS
            )));
        }
        let mut pictures = Vec::with_capacity(names.len());
        for name in names {
            if !images::is_valid_name(name) || images::is_video(name) || images::is_audio(name) {
                return Err(BackendError::Invalid(format!(
                    "{name} is not a picture of the gallery"
                )));
            }
            let bytes = self.inner.files.read_original(name).ok_or_else(|| {
                BackendError::Invalid(format!(
                    "The attached picture {name} is no longer in the gallery"
                ))
            })?;
            let picture = tokio::task::spawn_blocking(move || agent::attach::prepare(&bytes))
                .await
                .map_err(|e| BackendError::Internal(e.to_string()))?
                .map_err(BackendError::Invalid)?;
            pictures.push(picture);
        }
        Ok(pictures)
    }

    /// The request on the selected provider: a command-line tool with the app's MCP server, or the saved server with the
    /// app's own tool loop. Both send the model's calls to `relay`.
    async fn run_agent(
        &self,
        provider: agent::AgentProvider,
        exe: Option<&Path>,
        request: &agent::AgentRequest,
        relay: Arc<agent::Relay>,
    ) -> Result<agent::AgentReply> {
        if provider != agent::AgentProvider::Openai {
            return agent::chat(provider, exe, request, relay)
                .await
                .map_err(BackendError::Internal);
        }
        let dir = &self.inner.data_dir;
        let config = agent::load_endpoint(dir)
            .ok_or_else(|| BackendError::Invalid("Connect a server first".into()))?;
        if config.tools == agent::AgentToolsState::Unsupported {
            // Said by an earlier test or request; changing the server or the model clears it.
            let reason = config.tools_reason.clone().unwrap_or_default();
            return Err(BackendError::Invalid(
                agent::toolloop::EndpointError::NoTools(reason).to_string(),
            ));
        }
        let key = agent::load_endpoint_key(dir).map_err(BackendError::Internal)?;
        let endpoint =
            agent::Endpoint::new(&config.base_url, key).map_err(BackendError::Invalid)?;
        match agent::toolloop::run(&endpoint, &config.model, request, relay).await {
            Ok(reply) => Ok(reply),
            Err(agent::toolloop::EndpointError::NoTools(reason)) => {
                let _ = agent::record_tools(
                    dir,
                    &config.base_url,
                    &config.model,
                    agent::AgentToolsState::Unsupported,
                    Some(reason.clone()),
                );
                Err(BackendError::Invalid(
                    agent::toolloop::EndpointError::NoTools(reason).to_string(),
                ))
            }
            Err(e) => Err(BackendError::Internal(e.to_string())),
        }
    }

    /// The server of a form that has not been saved: its address checked, and its key (the one typed, none when the
    /// field was emptied, or the saved one when the address is the saved server's).
    fn draft_endpoint(
        &self,
        input: &agent::AgentEndpointInput,
    ) -> Result<(agent::Endpoint, String)> {
        let dir = &self.inner.data_dir;
        let base =
            agent::endpoint::normalize_base_url(&input.base_url).map_err(BackendError::Invalid)?;
        let key = match input.api_key.as_deref() {
            Some(typed) => agent::endpoint::ApiKey::new(typed),
            None => match agent::load_endpoint(dir) {
                Some(saved) if saved.base_url == base => {
                    agent::load_endpoint_key(dir).map_err(BackendError::Internal)?
                }
                _ => None,
            },
        };
        let endpoint = agent::Endpoint::new(&base, key).map_err(BackendError::Invalid)?;
        Ok((endpoint, base))
    }

    /// Saves the OpenAI-compatible server (address, model, key) and selects it. What was known about its tools is kept
    /// only when the address and model are the saved ones; a key is never carried over to another address.
    pub async fn agent_endpoint_save(
        &self,
        input: agent::AgentEndpointInput,
    ) -> Result<agent::AgentStatus> {
        let dir = &self.inner.data_dir;
        let (_, base) = self.draft_endpoint(&input)?;
        let model = agent::endpoint::valid_model(&input.model).map_err(BackendError::Invalid)?;
        let previous = agent::load_endpoint(dir);
        let same_server = previous.as_ref().is_some_and(|p| p.base_url == base);
        match input.api_key.as_deref() {
            Some(typed) => agent::save_endpoint_key(dir, Some(typed)),
            None if !same_server => agent::save_endpoint_key(dir, None),
            None => Ok(()),
        }
        .map_err(BackendError::Internal)?;
        let kept = previous.filter(|p| p.base_url == base && p.model == model);
        agent::save_endpoint(
            dir,
            agent::EndpointConfig {
                base_url: base,
                model,
                tools: kept.as_ref().map_or_else(Default::default, |p| p.tools),
                tools_reason: kept.and_then(|p| p.tools_reason),
            },
        )
        .map_err(BackendError::Internal)?;
        Ok(self.agent_status().await)
    }

    /// The models the server offers (`GET /models`). A server that does not list them is an error, and the window lets
    /// the user type the name.
    pub async fn agent_endpoint_models(
        &self,
        input: agent::AgentEndpointInput,
    ) -> Result<Vec<String>> {
        let (endpoint, _) = self.draft_endpoint(&input)?;
        endpoint
            .list_models()
            .await
            .map_err(|e| BackendError::Invalid(e.to_string()))
    }

    /// Checks the server, the model and a tool-call round trip. When it is the saved server and model, the outcome
    /// about tools is kept, so the settings and the picker show it.
    pub async fn agent_endpoint_test(
        &self,
        input: agent::AgentEndpointInput,
    ) -> Result<agent::AgentEndpointTest> {
        let (endpoint, base) = self.draft_endpoint(&input)?;
        let model = input.model.trim().to_string();
        let result = endpoint.test(&model).await;
        if result.tools != agent::AgentToolsState::Unknown {
            let _ = agent::record_tools(
                &self.inner.data_dir,
                &base,
                &model,
                result.tools,
                result.tools_reason.clone(),
            );
        }
        Ok(result)
    }

    /// The frontend's answer to a tool call of the running request. The id must be one the relay made.
    pub fn agent_tool_result(&self, answer: agent::AgentToolAnswer) -> Result<()> {
        if !agent::relay::is_call_id(&answer.call_id) {
            return Err(BackendError::Invalid("not a tool call id".into()));
        }
        let relay = self
            .inner
            .agent_run
            .lock_safe()
            .as_ref()
            .map(|r| r.relay.clone())
            .ok_or_else(|| BackendError::Invalid("no assistant request is running".into()))?;
        relay.answer(answer).map_err(BackendError::Invalid)
    }

    /// Stops the request that is running, if any (its tool's process is killed and its waiting tool calls end).
    pub fn agent_cancel(&self) {
        if let Some(run) = self.inner.agent_run.lock_safe().as_ref() {
            run.cancel.cancel();
        }
    }
}
