# `proto/` AGENTS Guide

## Role

`proto/` is the canonical source of truth for all schema definitions in this repository.

## Conventions

- All files use `syntax = "proto3";`.
- Package naming MUST follow folder hierarchy (for example: `dev.namlit.api.read.project.v1`).
- Imports MUST be repo-relative from `proto/` roots (for example: `dev/namlit/api/read/project/v1/project_service.proto`).
- Messages are DTO-focused and intended for shared transport contracts.

## Contract Model

- Canonical API surface is feature-scoped:
  - `dev.namlit.api.read.<feature>.v1`
  - `dev.namlit.api.write.<feature>.v1`
- Shared cache invalidation contract is message-only and lives at:
  - `dev.namlit.api.write.cache_invalidation.v1`
- `control`/`cache_admin` API namespaces are not part of the canonical surface.

## Change Flow

When adding or changing `.proto` modules:

- Update schema files in `proto/`.
- Update `proto/features.yaml` so Rust bundle selection and TS canonical feature-path mapping stay in sync.
- Update `ts_proto/features.yaml` when TypeScript feature/layer generation scope changes.
- If Rust bundle semantics change, update `rust_proto/build.rs`.
- If TS selection semantics change, update `ts_proto/scripts/generate.ts`.
- Validate both Rust and TS generation pipelines after schema changes.

## Compatibility Expectations

These schemas are shared across sibling consumers.
Breaking changes SHOULD NOT be introduced without coordinated updates across dependent projects (`frontend`, `cache_api`, `db_api`, `cache_sync_service`).

## Artifact Policy

- `.proto` sources MUST be committed.
- Generated language artifacts MUST NOT be committed in this repository.
