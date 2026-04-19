//! `rust_proto` exposes generated protobuf and gRPC Rust types from the shared `proto` repo.
//!
//! # Public API Surface
//! This crate exposes feature-gated alias namespaces:
//! - `rust_proto::common::v1::*`
//! - `rust_proto::domain::<feature>::v1::*`
//! - `rust_proto::api::read::<feature>::v1::*`
//! - `rust_proto::api::write::<feature>::v1::*`
//! - `rust_proto::api::write::cache_invalidation::v1::*`
//!
//! # gRPC Constructs
//! With `grpc_server`, each service module includes a server trait and wrapper, for example:
//! - `project_read_service_server::ProjectReadService`
//! - `project_read_service_server::ProjectReadServiceServer<T>`
//!
//! With `grpc_client`, typed clients are generated, for example:
//! - `project_read_service_client::ProjectReadServiceClient<T>`

// The canonical layer owns all `include_proto!` calls so each package is included exactly once.
pub(crate) mod canonical;
mod descriptor_set;
mod macros;

#[cfg(any(
    feature = "bundle_domain",
    feature = "bundle_api_read",
    feature = "bundle_api_write",
    feature = "bundle_cache_invalidation"
))]
pub use descriptor_set::FILE_DESCRIPTOR_SET;

pub mod api;
#[cfg(feature = "bundle_domain")]
pub mod common;
#[cfg(feature = "bundle_domain")]
pub mod domain;
