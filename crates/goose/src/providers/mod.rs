pub mod api_client;
pub mod auto_detect;
pub mod base;
pub mod canonical;
pub mod embedding;
pub mod errors;
pub mod formats;
mod init;
pub mod oauth;
pub mod ollama;
pub mod openai;
pub mod openai_compatible;
pub mod provider_registry;
pub mod provider_test;
mod retry;
pub mod testprovider;
pub mod toolshim;
pub mod usage_estimator;
pub mod utils;

pub use init::{
    create, create_with_default_model, create_with_named_model, providers, refresh_custom_providers,
};
pub use retry::{retry_operation, RetryConfig};
