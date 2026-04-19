#[cfg(feature = "bundle_api_read")]
use crate::macros::define_alias_modules;

#[cfg(feature = "bundle_api_read")]
define_alias_modules!(
    about_me => crate::canonical::api::read::about_me::v1,
    contact => crate::canonical::api::read::contact::v1,
    education_history => crate::canonical::api::read::education_history::v1,
    languages => crate::canonical::api::read::languages::v1,
    project => crate::canonical::api::read::project::v1,
    resume_download => crate::canonical::api::read::resume_download::v1,
    techstack => crate::canonical::api::read::techstack::v1,
    work_history => crate::canonical::api::read::work_history::v1,
);
