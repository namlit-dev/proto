#[cfg(feature = "bundle_api_write")]
use crate::macros::define_proto_modules;

#[cfg(feature = "bundle_api_write")]
define_proto_modules!(
    pub(crate),
    about_me => "dev.namlit.api.write.about_me.v1",
    contact => "dev.namlit.api.write.contact.v1",
    education_history => "dev.namlit.api.write.education_history.v1",
    languages => "dev.namlit.api.write.languages.v1",
    project => "dev.namlit.api.write.project.v1",
    resume_download => "dev.namlit.api.write.resume_download.v1",
    techstack => "dev.namlit.api.write.techstack.v1",
    work_history => "dev.namlit.api.write.work_history.v1",
);

#[cfg(any(feature = "bundle_api_write", feature = "bundle_cache_invalidation"))]
pub(crate) mod cache_invalidation {
    pub(crate) mod v1 {
        tonic::include_proto!("dev.namlit.api.write.cache_invalidation.v1");
    }
}
