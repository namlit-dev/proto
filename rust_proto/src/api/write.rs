#[cfg(feature = "bundle_api_write")]
use crate::macros::define_alias_modules;

#[cfg(feature = "bundle_api_write")]
define_alias_modules!(
    about_me => crate::canonical::api::write::about_me::v1,
    contact => crate::canonical::api::write::contact::v1,
    education_history => crate::canonical::api::write::education_history::v1,
    languages => crate::canonical::api::write::languages::v1,
    project => crate::canonical::api::write::project::v1,
    resume_download => crate::canonical::api::write::resume_download::v1,
    techstack => crate::canonical::api::write::techstack::v1,
    work_history => crate::canonical::api::write::work_history::v1,
);

#[cfg(any(feature = "bundle_api_write", feature = "bundle_cache_invalidation"))]
pub mod cache_invalidation {
    pub mod v1 {
        pub use crate::canonical::api::write::cache_invalidation::v1::*;
    }
}
