use crate::config::ExtensionConfig;
use crate::model::ModelConfig;
use crate::providers::base::{
    MessageStream, Provider, ProviderDef, ProviderMetadata, ProviderUsage,
};
use crate::providers::errors::ProviderError;
use anyhow::Result;
use async_trait::async_trait;
use futures::future::BoxFuture;
use futures::stream;
use rmcp::model::Tool;
use std::path::PathBuf;
use std::sync::Arc;

const PROVIDER_NAME: &str = "local";
const DEFAULT_MODEL: &str = "bartowski/Llama-3.2-1B-Instruct-GGUF:Q4_K_M";

pub const LOCAL_LLM_MODEL_CONFIG_KEY: &str = "LOCAL_LLM_MODEL";

pub struct InferenceRuntime;

impl InferenceRuntime {
    pub fn get_or_init() -> Arc<Self> {
        Arc::new(Self)
    }
}

pub fn resolve_model_path(
    model_id: &str,
) -> Option<(PathBuf, usize, crate::providers::local_inference::local_model_registry::ModelSettings)> {
    use crate::providers::local_inference::local_model_registry::get_registry;

    if let Ok(registry) = get_registry().lock() {
        if let Some(entry) = registry.get_model(model_id) {
            let ctx = entry.settings.context_size.unwrap_or(0) as usize;
            return Some((entry.local_path.clone(), ctx, entry.settings.clone()));
        }
    }

    None
}

pub fn available_inference_memory_bytes(_runtime: &InferenceRuntime) -> u64 {
    0
}

pub fn recommend_local_model(_runtime: &InferenceRuntime) -> String {
    use crate::providers::local_inference::local_model_registry::FEATURED_MODELS;
    FEATURED_MODELS[0].to_string()
}

pub struct LocalInferenceProvider {
    model: ModelConfig,
}

impl LocalInferenceProvider {
    fn unsupported_error() -> ProviderError {
        ProviderError::NotImplemented(
            "Local inference is not available in Windows builds yet".to_string(),
        )
    }
}

impl ProviderDef for LocalInferenceProvider {
    type Provider = Self;

    fn metadata() -> ProviderMetadata {
        ProviderMetadata::new(
            PROVIDER_NAME,
            "Local Inference",
            "Run local LLMs directly on your machine",
            DEFAULT_MODEL,
            vec![],
            "https://github.com/utilityai/llama-cpp-rs",
            vec![],
        )
    }

    fn from_env(
        model: ModelConfig,
        _extensions: Vec<ExtensionConfig>,
    ) -> BoxFuture<'static, Result<Self::Provider>> {
        Box::pin(async move { Ok(Self { model }) })
    }
}

#[async_trait]
impl Provider for LocalInferenceProvider {
    fn get_name(&self) -> &str {
        PROVIDER_NAME
    }

    fn get_model_config(&self) -> ModelConfig {
        self.model.clone()
    }

    async fn stream(
        &self,
        _model_config: &ModelConfig,
        _session_id: &str,
        _system: &str,
        _messages: &[crate::conversation::message::Message],
        _tools: &[Tool],
    ) -> Result<MessageStream, ProviderError> {
        let err = Self::unsupported_error();
        Ok(Box::pin(stream::once(async move { Err(err) })))
    }

    async fn complete(
        &self,
        _model_config: &ModelConfig,
        _session_id: &str,
        _system: &str,
        _messages: &[crate::conversation::message::Message],
        _tools: &[Tool],
    ) -> Result<(crate::conversation::message::Message, ProviderUsage), ProviderError> {
        Err(Self::unsupported_error())
    }
}
