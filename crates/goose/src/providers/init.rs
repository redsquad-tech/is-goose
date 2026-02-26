use std::sync::{Arc, RwLock};

use super::{
    base::{Provider, ProviderMetadata},
    openai::OpenAiProvider,
    provider_registry::{ProviderEntry, ProviderRegistry},
};
use crate::config::ExtensionConfig;
use crate::model::ModelConfig;
use crate::providers::base::ProviderType;
use anyhow::Result;
use tokio::sync::OnceCell;

static REGISTRY: OnceCell<RwLock<ProviderRegistry>> = OnceCell::const_new();

async fn init_registry() -> RwLock<ProviderRegistry> {
    let mut registry = ProviderRegistry::new();
    registry.register::<OpenAiProvider>(true);
    RwLock::new(registry)
}

async fn get_registry() -> &'static RwLock<ProviderRegistry> {
    REGISTRY.get_or_init(init_registry).await
}

pub async fn providers() -> Vec<(ProviderMetadata, ProviderType)> {
    get_registry()
        .await
        .read()
        .unwrap()
        .all_metadata_with_types()
}

pub async fn refresh_custom_providers() -> Result<()> {
    Err(anyhow::anyhow!(
        "custom providers are not supported in this OpenAI-only build"
    ))
}

async fn get_from_registry(name: &str) -> Result<ProviderEntry> {
    if name != "openai" {
        return Err(anyhow::anyhow!(
            "Unsupported provider '{}'. This build supports only 'openai'",
            name
        ));
    }

    let guard = get_registry().await.read().unwrap();
    guard
        .entries
        .get(name)
        .ok_or_else(|| anyhow::anyhow!("Unknown provider: {}", name))
        .cloned()
}

pub async fn create(
    name: &str,
    model: ModelConfig,
    extensions: Vec<ExtensionConfig>,
) -> Result<Arc<dyn Provider>> {
    let constructor = get_from_registry(name).await?.constructor.clone();
    constructor(model, extensions).await
}

pub async fn create_with_default_model(
    name: impl AsRef<str>,
    extensions: Vec<ExtensionConfig>,
) -> Result<Arc<dyn Provider>> {
    get_from_registry(name.as_ref())
        .await?
        .create_with_default_model(extensions)
        .await
}

pub async fn create_with_named_model(
    provider_name: &str,
    model_name: &str,
    extensions: Vec<ExtensionConfig>,
) -> Result<Arc<dyn Provider>> {
    if provider_name != "openai" {
        return Err(anyhow::anyhow!(
            "Unsupported provider '{}'. This build supports only 'openai'",
            provider_name
        ));
    }

    let config = ModelConfig::new(model_name)?.with_canonical_limits(provider_name);
    create(provider_name, config, extensions).await
}
