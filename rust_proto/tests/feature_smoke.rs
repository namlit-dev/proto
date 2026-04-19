#![allow(dead_code)]

#[cfg(feature = "bundle_db_api_server")]
mod db_server_smoke {
    struct DummyAboutMeReadService;
    struct DummyAboutMeWriteService;

    #[tonic::async_trait]
    impl rust_proto::api::read::about_me::v1::about_me_read_service_server::AboutMeReadService
        for DummyAboutMeReadService
    {
        async fn get_about_me(
            &self,
            _request: tonic::Request<rust_proto::api::read::about_me::v1::GetAboutMeRequest>,
        ) -> Result<
            tonic::Response<rust_proto::api::read::about_me::v1::GetAboutMeResponse>,
            tonic::Status,
        > {
            Err(tonic::Status::unimplemented("smoke"))
        }
    }

    #[tonic::async_trait]
    impl rust_proto::api::write::about_me::v1::about_me_write_service_server::AboutMeWriteService
        for DummyAboutMeWriteService
    {
        async fn upsert_about_me(
            &self,
            _request: tonic::Request<rust_proto::api::write::about_me::v1::UpsertAboutMeRequest>,
        ) -> Result<
            tonic::Response<rust_proto::api::write::about_me::v1::UpsertAboutMeResponse>,
            tonic::Status,
        > {
            Err(tonic::Status::unimplemented("smoke"))
        }

        async fn upsert_about_me_the_basics(
            &self,
            _request: tonic::Request<
                rust_proto::api::write::about_me::v1::UpsertAboutMeTheBasicsRequest,
            >,
        ) -> Result<
            tonic::Response<rust_proto::api::write::about_me::v1::UpsertAboutMeTheBasicsResponse>,
            tonic::Status,
        > {
            Err(tonic::Status::unimplemented("smoke"))
        }

        async fn upsert_about_me_beyond_code(
            &self,
            _request: tonic::Request<
                rust_proto::api::write::about_me::v1::UpsertAboutMeBeyondCodeRequest,
            >,
        ) -> Result<
            tonic::Response<rust_proto::api::write::about_me::v1::UpsertAboutMeBeyondCodeResponse>,
            tonic::Status,
        > {
            Err(tonic::Status::unimplemented("smoke"))
        }

        async fn upsert_about_me_work_style(
            &self,
            _request: tonic::Request<
                rust_proto::api::write::about_me::v1::UpsertAboutMeWorkStyleRequest,
            >,
        ) -> Result<
            tonic::Response<rust_proto::api::write::about_me::v1::UpsertAboutMeWorkStyleResponse>,
            tonic::Status,
        > {
            Err(tonic::Status::unimplemented("smoke"))
        }
    }

    #[test]
    fn db_api_server_trait_symbols_resolve() {
        let _ = std::any::type_name::<
            rust_proto::api::read::about_me::v1::about_me_read_service_server::AboutMeReadServiceServer<
                DummyAboutMeReadService,
            >,
        >();

        let _ = std::any::type_name::<
            rust_proto::api::write::about_me::v1::about_me_write_service_server::AboutMeWriteServiceServer<
                DummyAboutMeWriteService,
            >,
        >();
    }
}

#[cfg(feature = "bundle_db_api_client")]
#[test]
fn db_api_client_symbols_resolve() {
    let _read_client: Option<
        rust_proto::api::read::project::v1::project_read_service_client::ProjectReadServiceClient<
            tonic::transport::Channel,
        >,
    > = None;

    let _write_client: Option<
        rust_proto::api::write::project::v1::project_write_service_client::ProjectWriteServiceClient<
            tonic::transport::Channel,
        >,
    > = None;
}

#[cfg(feature = "bundle_cache_api_server")]
mod cache_server_smoke {
    struct DummyAboutMeReadService;

    #[tonic::async_trait]
    impl rust_proto::api::read::about_me::v1::about_me_read_service_server::AboutMeReadService
        for DummyAboutMeReadService
    {
        async fn get_about_me(
            &self,
            _request: tonic::Request<rust_proto::api::read::about_me::v1::GetAboutMeRequest>,
        ) -> Result<
            tonic::Response<rust_proto::api::read::about_me::v1::GetAboutMeResponse>,
            tonic::Status,
        > {
            Err(tonic::Status::unimplemented("smoke"))
        }
    }

    #[test]
    fn cache_api_server_trait_symbols_resolve() {
        let _ = std::any::type_name::<
            rust_proto::api::read::about_me::v1::about_me_read_service_server::AboutMeReadServiceServer<
                DummyAboutMeReadService,
            >,
        >();
    }
}

#[cfg(feature = "bundle_cache_to_db_client")]
#[test]
fn cache_to_db_client_symbol_resolves() {
    let _client: Option<
        rust_proto::api::read::work_history::v1::work_history_read_service_client::WorkHistoryReadServiceClient<
            tonic::transport::Channel,
        >,
    > = None;
}

#[cfg(feature = "bundle_cache_invalidation")]
#[test]
fn cache_invalidation_bundle_symbols_resolve() {
    let _event: Option<rust_proto::api::write::cache_invalidation::v1::CacheInvalidationEventDto> =
        None;
    let _descriptor: &[u8] = rust_proto::FILE_DESCRIPTOR_SET;
}

#[cfg(feature = "bundle_domain")]
#[test]
fn domain_bundle_symbols_resolve() {
    let _timeframe: Option<rust_proto::common::v1::TimeframeDto> = None;
    let _project: Option<rust_proto::domain::project::v1::ProjectDto> = None;
    let _descriptor: &[u8] = rust_proto::FILE_DESCRIPTOR_SET;
}
