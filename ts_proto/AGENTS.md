# `ts_proto/` AGENTS Guide

## Role

`ts_proto` is the TypeScript adapter package that generates shared protobuf contracts from `../proto` using `buf generate` and `protoc-gen-es`.

## Generation Inputs and Lifecycle

Primary generation inputs:

- `../proto/features.yaml` for canonical feature-to-proto-path mapping
- `features.yaml` for TypeScript feature/layer selection
- `buf.gen.yaml` for plugin/options configuration
- `scripts/generate.ts` for orchestration and index generation

Selection model:

- `ts_proto/features.yaml` is keyed by feature and each feature declares explicit boolean toggles:
  - `domain`
  - `read_api`
  - `write_api`
- `ts_proto` generates only the enabled layers per configured feature.

Lifecycle commands (from `package.json`):

- `clean`
- `generate`
- `typecheck`
- `build` (`clean` + `generate` + `typecheck`)
- `prepare` (`build`)

## Output Model

The configured output directory is `generated/`, but generated output is runtime/build-time artifact material and is not repository source.

Tracked in this repository:

- package metadata and scripts (`package.json`, lockfiles)
- generation config/scripts (`buf.gen.yaml`, `features.yaml`, `scripts/generate.ts`, `build.sh`, `tsconfig.json`)

Not tracked in this repository:

- `generated/` output
- dependency install output (`node_modules/`)

## Consumer Expectations

This package is consumed by sibling projects (currently `frontend`).
Generated artifacts are expected to be produced during install/build in the consumer context.

## Artifact Policy

- Generation setup files MUST stay committed here.
- Generated TypeScript output MUST NOT be committed here.

## Scope

`ts_proto` is contracts-only. It generates message types and service descriptors, but does not provide transport/client runtime wrappers.
