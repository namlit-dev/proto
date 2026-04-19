use crate::macros::define_proto_modules;

define_proto_modules!(
    pub(crate),
    about_me => "dev.namlit.domain.about_me.v1",
    contact => "dev.namlit.domain.contact.v1",
    education_history => "dev.namlit.domain.education_history.v1",
    languages => "dev.namlit.domain.languages.v1",
    project => "dev.namlit.domain.project.v1",
    resume_download => "dev.namlit.domain.resume_download.v1",
    techstack => "dev.namlit.domain.techstack.v1",
    work_history => "dev.namlit.domain.work_history.v1",
);
