use crate::macros::define_alias_modules;

define_alias_modules!(
    about_me => crate::canonical::domain::about_me::v1,
    contact => crate::canonical::domain::contact::v1,
    education_history => crate::canonical::domain::education_history::v1,
    languages => crate::canonical::domain::languages::v1,
    project => crate::canonical::domain::project::v1,
    resume_download => crate::canonical::domain::resume_download::v1,
    techstack => crate::canonical::domain::techstack::v1,
    work_history => crate::canonical::domain::work_history::v1,
);
