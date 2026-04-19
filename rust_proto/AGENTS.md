# `rust_proto/` AGENTS Guide

## Role

`rust_proto` is the Rust adapter crate that compiles schemas from `../proto` via `tonic-prost-build` in `build.rs`.

## Current Generation Behavior

The build pipeline supports feature-driven code generation:

- gRPC toggles:
  - `grpc_server`
  - `grpc_client`
- bundle selection from `proto/features.yaml`:
  - `bundle_domain`
  - `bundle_api_read`
  - `bundle_api_write`
  - `bundle_cache_invalidation`

Convenience bundles:

- `bundle_db_api_server`
- `bundle_db_api_client`
- `bundle_cache_api_server`
- `bundle_cache_to_db_client`

## Namespace and Export Model

Public namespaces are alias-only and exposed under:

- `rust_proto::common::v1`
- `rust_proto::domain::<feature>::v1`
- `rust_proto::api::read::<feature>::v1`
- `rust_proto::api::write::<feature>::v1`
- `rust_proto::api::write::cache_invalidation::v1`

The package-aligned include tree is internal-only and not part of the public API.

## Rust Module Style

- Do not use `mod.rs` files.
- Always use named module files (`foo.rs`) and optional same-name module directories (`foo/`).
- Keep `src/lib.rs` thin as the crate root orchestrator.
- Keep `src/canonical.rs` + `src/canonical/` as the private include layer.
- Keep alias re-exports in named files (`src/common.rs`, `src/domain.rs`, `src/api.rs`).

## Internal Layering Rules

- `tonic::include_proto!` calls must live only in the private canonical layer.
- Each proto package should be included once, then re-exported through alias modules.
- Keep canonical module visibility crate-scoped (`pub(crate)`) and avoid exposing internal paths.

## Source of Truth and Tracked Files

Tracked in this repository:

- `Cargo.toml`
- `build.rs`
- module wrapper file(s) in `src/`
- helper scripts such as `clean_and_rebuild.sh`

Not tracked in this repository:

- `target/` build outputs
- `OUT_DIR`-generated Rust artifacts
- any other generated compilation artifacts

## Consumer Expectations

This crate is intended to be consumed externally by Rust services (`cache_api`, `db_api`, and optionally `cache_sync_service` for invalidation contracts).
Consumers generate/use artifacts during their own build/install flow.

## Maintenance Checklist

When adding or removing a feature/proto package:

1. Update `proto/features.yaml` as needed.
2. Update `build.rs` selection logic only if bundle semantics change.
3. Update canonical includes in `src/canonical/domain.rs` or `src/canonical/api/{read,write}.rs`.
4. Update alias re-exports in `src/domain.rs` or `src/api/{read,write}.rs`.
5. Ensure feature gates remain aligned (`bundle_domain`, `bundle_api_read`, `bundle_api_write`, `bundle_cache_invalidation`).
6. Run feature smoke and compile/test matrix coverage before finishing.

## Artifact Policy

- Generator setup code MUST stay committed here.
- Generated outputs MUST NOT be committed here.
