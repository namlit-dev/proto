#[cfg(any(
    feature = "bundle_domain",
    feature = "bundle_api_read",
    feature = "bundle_api_write"
))]
// Helper to keep include tree explicit but avoid repeating identical module shells.
macro_rules! define_proto_modules {
    ($visibility:vis, $( $module:ident => $package:literal ),+ $(,)?) => {
        $(
            $visibility mod $module {
                $visibility mod v1 {
                    tonic::include_proto!($package);
                }
            }
        )+
    };
}

#[cfg(any(
    feature = "bundle_domain",
    feature = "bundle_api_read",
    feature = "bundle_api_write"
))]
// Keep macro/export cfg in sync so cache-invalidation-only builds do not emit unused warnings.
pub(crate) use define_proto_modules;

#[cfg(any(
    feature = "bundle_domain",
    feature = "bundle_api_read",
    feature = "bundle_api_write"
))]
// Re-export helper mirroring the canonical include tree under the public alias API.
macro_rules! define_alias_modules {
    ($( $module:ident => $source:path ),+ $(,)?) => {
        $(
            pub mod $module {
                pub mod v1 {
                    pub use $source::*;
                }
            }
        )+
    };
}

#[cfg(any(
    feature = "bundle_domain",
    feature = "bundle_api_read",
    feature = "bundle_api_write"
))]
pub(crate) use define_alias_modules;
