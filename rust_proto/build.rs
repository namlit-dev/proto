use serde::Deserialize;
use std::collections::{BTreeSet, HashMap};
use std::env;
use std::error::Error;
use std::fs;
use std::path::{Path, PathBuf};
use tonic_prost_build::Config;

const FEATURES_MANIFEST_RELATIVE_PATH: &str = "features.yaml";
const PROTO_ROOT_RELATIVE_PATH: &str = "../proto";
const CACHE_INVALIDATION_FEATURE_KEY: &str = "cache_invalidation";

#[derive(Debug, Deserialize)]
struct ProtoFeaturesManifest {
    features: HashMap<String, ProtoFeatureEntry>,
}

#[derive(Debug, Deserialize)]
struct ProtoFeatureEntry {
    domain: Option<Vec<String>>,
    read_api: Option<Vec<String>>,
    write_api: Option<Vec<String>>,
}

fn main() -> Result<(), Box<dyn Error>> {
    println!("cargo:rerun-if-changed={}", PROTO_ROOT_RELATIVE_PATH);

    let proto_root: PathBuf = PathBuf::from(PROTO_ROOT_RELATIVE_PATH);
    let features_manifest_path: PathBuf = proto_root.join(FEATURES_MANIFEST_RELATIVE_PATH);

    let manifest: ProtoFeaturesManifest = load_manifest(&features_manifest_path)?;
    let enabled_features: BTreeSet<String> = enabled_cargo_features();
    let selected_protos: Vec<PathBuf> =
        resolve_selected_protos(&manifest, &enabled_features, &proto_root)?;

    if selected_protos.is_empty() {
        println!(
            "cargo:warning=No rust_proto schema bundle selected; skipping proto generation"
        );
        return Ok(());
    }

    tonic_prost_build::configure()
        .build_server(enabled_features.contains("grpc_server"))
        .build_client(enabled_features.contains("grpc_client"))
        .file_descriptor_set_path(descriptor_set_path()?)
        .compile_with_config(get_config(), &selected_protos, &[proto_root])?;

    Ok(())
}

fn load_manifest(path: &Path) -> Result<ProtoFeaturesManifest, Box<dyn Error>> {
    let raw: String = fs::read_to_string(path)?;
    let manifest: ProtoFeaturesManifest = serde_yaml::from_str(&raw)?;
    Ok(manifest)
}

fn enabled_cargo_features() -> BTreeSet<String> {
    env::vars()
        .filter_map(|(key, _value)| {
            key.strip_prefix("CARGO_FEATURE_")
                .map(|feature| feature.to_ascii_lowercase())
        })
        .collect()
}

fn resolve_selected_protos(
    manifest: &ProtoFeaturesManifest,
    enabled_features: &BTreeSet<String>,
    proto_root: &Path,
) -> Result<Vec<PathBuf>, Box<dyn Error>> {
    // API bundles depend on domain/common messages, so enabling read/write implies domain selection.
    let include_domain: bool = enabled_features.contains("bundle_domain")
        || enabled_features.contains("bundle_api_read")
        || enabled_features.contains("bundle_api_write");

    let include_read_api: bool = enabled_features.contains("bundle_api_read");
    let include_write_api: bool = enabled_features.contains("bundle_api_write");
    let include_cache_invalidation_api: bool =
        enabled_features.contains("bundle_cache_invalidation");

    let mut selected_paths: BTreeSet<String> = BTreeSet::new();

    if include_domain {
        for common_proto in list_common_protos(proto_root)? {
            selected_paths.insert(common_proto);
        }

        extend_with_all_domains(manifest, &mut selected_paths);
    }

    if include_read_api {
        extend_with_manifest_layer(manifest, &mut selected_paths, ManifestLayer::ReadApi);
    }

    if include_write_api {
        extend_with_manifest_layer(manifest, &mut selected_paths, ManifestLayer::WriteApi);
    }

    if include_cache_invalidation_api {
        // Cache invalidation is modeled as an isolated write contract bundle.
        extend_with_feature_layer(
            manifest,
            CACHE_INVALIDATION_FEATURE_KEY,
            &mut selected_paths,
            ManifestLayer::WriteApi,
        );
    }

    if selected_paths.is_empty() {
        return Ok(Vec::new());
    }

    let expanded_paths: BTreeSet<String> =
        expand_with_transitive_imports(&selected_paths, proto_root)?;

    let proto_paths: Vec<PathBuf> = expanded_paths
        .into_iter()
        .map(|relative_path| proto_root.join(relative_path))
        .collect();

    Ok(proto_paths)
}

enum ManifestLayer {
    ReadApi,
    WriteApi,
}

fn extend_with_all_domains(manifest: &ProtoFeaturesManifest, selected: &mut BTreeSet<String>) {
    for entry in manifest.features.values() {
        extend_with_paths(selected, entry.domain.as_ref());
    }
}

fn extend_with_manifest_layer(
    manifest: &ProtoFeaturesManifest,
    selected: &mut BTreeSet<String>,
    layer: ManifestLayer,
) {
    for entry in manifest.features.values() {
        match layer {
            ManifestLayer::ReadApi => extend_with_paths(selected, entry.read_api.as_ref()),
            ManifestLayer::WriteApi => extend_with_paths(selected, entry.write_api.as_ref()),
        }
    }
}

fn extend_with_feature_layer(
    manifest: &ProtoFeaturesManifest,
    feature_key: &str,
    selected: &mut BTreeSet<String>,
    layer: ManifestLayer,
) {
    if let Some(entry) = manifest.features.get(feature_key) {
        match layer {
            ManifestLayer::ReadApi => extend_with_paths(selected, entry.read_api.as_ref()),
            ManifestLayer::WriteApi => extend_with_paths(selected, entry.write_api.as_ref()),
        }
    }
}

fn extend_with_paths(selected: &mut BTreeSet<String>, paths: Option<&Vec<String>>) {
    if let Some(paths) = paths {
        for path in paths {
            selected.insert(path.to_owned());
        }
    }
}

fn list_common_protos(proto_root: &Path) -> Result<Vec<String>, Box<dyn Error>> {
    let common_root: PathBuf = proto_root.join("dev/namlit/common/v1");
    let mut common_paths: Vec<String> = Vec::new();

    for entry in fs::read_dir(common_root)? {
        let entry = entry?;
        let path: PathBuf = entry.path();

        if path.extension().and_then(|ext| ext.to_str()) != Some("proto") {
            continue;
        }

        let relative_path: PathBuf = path.strip_prefix(proto_root)?.to_path_buf();
        common_paths.push(relative_path.to_string_lossy().to_string());
    }

    common_paths.sort();
    Ok(common_paths)
}

fn expand_with_transitive_imports(
    initial_paths: &BTreeSet<String>,
    proto_root: &Path,
) -> Result<BTreeSet<String>, Box<dyn Error>> {
    // Compile roots are feature-selected, then expanded to the full local import closure.
    let mut queue: Vec<String> = initial_paths.iter().cloned().collect();
    let mut expanded: BTreeSet<String> = BTreeSet::new();

    while let Some(relative_path) = queue.pop() {
        if expanded.contains(&relative_path) {
            continue;
        }

        let absolute_path: PathBuf = proto_root.join(&relative_path);
        let imports: Vec<String> = parse_imports(&absolute_path)?;

        expanded.insert(relative_path);

        for import in imports {
            if import.starts_with("google/protobuf/") {
                continue;
            }

            if !expanded.contains(&import) {
                queue.push(import);
            }
        }
    }

    Ok(expanded)
}

fn parse_imports(proto_path: &Path) -> Result<Vec<String>, Box<dyn Error>> {
    let mut imports: Vec<String> = Vec::new();
    let raw: String = fs::read_to_string(proto_path)?;

    // Proto imports are simple quoted statements in this repo; a lightweight scan is sufficient.
    for line in raw.lines() {
        let trimmed: &str = line.trim();

        if !trimmed.starts_with("import ") {
            continue;
        }

        if let Some(start_index) = trimmed.find('"') {
            let after_start: &str = &trimmed[start_index + 1..];

            if let Some(end_index) = after_start.find('"') {
                imports.push(after_start[..end_index].to_string());
            }
        }
    }

    Ok(imports)
}

fn descriptor_set_path() -> Result<PathBuf, Box<dyn Error>> {
    let out_dir: PathBuf = PathBuf::from(env::var("OUT_DIR")?);
    Ok(out_dir.join("rust_proto_descriptor_set.bin"))
}

fn get_config() -> Config {
    let mut config: Config = Config::new();

    config.type_attribute(
        ".".to_string(),
        "#[derive(serde::Serialize, serde::Deserialize)]".to_string(),
    );

    config.type_attribute(
        ".".to_string(),
        "#[serde(rename_all = \"camelCase\")]".to_string(),
    );

    config.compile_well_known_types();
    config.extern_path(".google.protobuf", "::prost_wkt_types");

    config
}
