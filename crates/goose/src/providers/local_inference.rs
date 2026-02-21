pub mod hf_models;
#[cfg(not(target_os = "windows"))]
mod inference_emulated_tools;
#[cfg(not(target_os = "windows"))]
mod inference_engine;
#[cfg(not(target_os = "windows"))]
mod inference_native_tools;
pub mod local_model_registry;
#[cfg(not(target_os = "windows"))]
mod tool_parsing;

#[cfg(not(target_os = "windows"))]
include!("local_inference/non_windows_impl.rs");

#[cfg(target_os = "windows")]
include!("local_inference/windows_stub.rs");
