#[cfg(feature = "bundle_api_read")]
use crate::macros::define_proto_modules;

#[cfg(feature = "bundle_api_read")]
define_proto_modules!(
    pub(crate),
    about_me => "dev.namlit.api.read.about_me.v1",
    contact => "dev.namlit.api.read.contact.v1",
    education_history => "dev.namlit.api.read.education_history.v1",
    languages => "dev.namlit.api.read.languages.v1",
    project => "dev.namlit.api.read.project.v1",
    resume_download => "dev.namlit.api.read.resume_download.v1",
    techstack => "dev.namlit.api.read.techstack.v1",
    work_history => "dev.namlit.api.read.work_history.v1",
);
