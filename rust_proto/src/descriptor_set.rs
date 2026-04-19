#[cfg(any(
    feature = "bundle_domain",
    feature = "bundle_api_read",
    feature = "bundle_api_write",
    feature = "bundle_cache_invalidation"
))]
pub const FILE_DESCRIPTOR_SET: &[u8] =
    tonic::include_file_descriptor_set!("rust_proto_descriptor_set");
