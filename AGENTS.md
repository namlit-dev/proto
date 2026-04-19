# `proto` Repository AGENTS Guide

## Purpose

This repository is the shared Protocol Buffers source for multiple sibling projects.
It also contains language-specific generator adapters for Rust and TypeScript.

## Repository Ownership

- `proto/`: canonical `.proto` schema source of truth.
- `rust_proto/`: Rust generation adapter crate (build tooling + module wrappers).
- `ts_proto/`: TypeScript generation adapter package (build tooling + generation scripts).

## Consumers

This repository is imported as an external dependency by sibling projects:

- `frontend` uses `ts_proto`.
- `cache_api` uses `rust_proto`.
- `db_api` uses `rust_proto`.
- `cache_sync_service` can consume shared invalidation contracts via `rust_proto`.

## Non-Negotiable Rules

- Generated outputs MUST NOT be committed to this repository.
- Generator source/config files MUST be committed in this repository.
- This repository MUST stay slim and source-focused (schemas + generation setup).
- Generation of consumable artifacts MUST happen during install/build in consuming projects.

## Current Workspace Model

- `buf.work.yaml` defines the workspace with `proto` as the schema directory.
- `rust_proto` compiles from `proto/features.yaml` feature selection.
- `ts_proto` resolves canonical paths from `proto/features.yaml` and selects generated TS scope from
  `ts_proto/features.yaml`.
- Canonical API contracts are feature-scoped `read` and `write` packages.
- Cache invalidation is a shared message contract under `api/write/cache_invalidation/v1`.
- The generated files are expected to exist in consumer build contexts, not as tracked files here.

## gRPC Status

- gRPC service/client code generation is supported in `rust_proto` via Cargo features.
- `ts_proto` generates TypeScript message/schema/service descriptor contracts (no transport runtime wrappers).

## Public Release Automation

- Public snapshot publishing is centrally managed via the `ci-public-release-components` project.
- This repository consumes the shared GitLab CI component using `include: component` with an exact version pin.
- Release publication remains tag-driven (`vX.Y.Z`) with manual publish approval in pipeline.
