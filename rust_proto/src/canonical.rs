// Internal package-aligned module tree. Consumers should import from public alias modules.
pub(crate) mod api;
#[cfg(feature = "bundle_domain")]
pub(crate) mod common;
// Domain DTOs are also required when read/write bundles are enabled.
#[cfg(feature = "bundle_domain")]
pub(crate) mod domain;
