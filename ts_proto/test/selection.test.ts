import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { just, nothing } from 'true-myth/maybe';
import type { Result } from 'true-myth/result';
import type { Unit } from 'true-myth/unit';
import type { GenerationError } from '../scripts/generator/errors.js';
import type {
  ProtoFeatureEntry,
  ProtoFeaturesManifest,
  SelectedFeaturesByLayer,
  TsFeatureSelection
} from '../scripts/generator/models.js';
import {
  resolveSelectedFeaturesByLayer,
  selectProtoPaths,
  validateManifestContractPaths
} from '../scripts/generator/selection.js';

function createTempProtoRoot(): string {
  return mkdtempSync(join(tmpdir(), 'ts-proto-selection-'));
}

function writeProtoFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

describe('selection', (): void => {
  test('resolves selected layers with deterministic sorting', (): void => {
    const selection: TsFeatureSelection = {
      version: 'v1',
      features: {
        zeta: {
          domain: true,
          read_api: false,
          write_api: true
        },
        alpha: {
          domain: true,
          read_api: true,
          write_api: false
        }
      }
    };

    const manifestFeatures: Readonly<Record<string, ProtoFeatureEntry>> = {
      alpha: {
        domain: just(['dev/namlit/domain/alpha/v1/alpha.proto']),
        read_api: just(['dev/namlit/api/read/alpha/v1/alpha_service.proto']),
        write_api: nothing()
      },
      zeta: {
        domain: just(['dev/namlit/domain/zeta/v1/zeta.proto']),
        read_api: nothing(),
        write_api: just(['dev/namlit/api/write/zeta/v1/zeta_service.proto'])
      }
    };

    const selectedResult: Result<SelectedFeaturesByLayer, GenerationError> =
      resolveSelectedFeaturesByLayer(selection, manifestFeatures, 'ts_proto/features.yaml', 'proto/features.yaml');

    expect(selectedResult.isOk).toBe(true);
    if (selectedResult.isErr) {
      return;
    }

    expect(selectedResult.value.domain).toEqual(['alpha', 'zeta']);
    expect(selectedResult.value.read_api).toEqual(['alpha']);
    expect(selectedResult.value.write_api).toEqual(['zeta']);
  });

  test('selects proto paths and includes common protos for selected domain features', (): void => {
    const protoRoot: string = createTempProtoRoot();

    const commonProtoPath: string = join(protoRoot, 'dev', 'namlit', 'common', 'v1', 'pagination.proto');
    writeProtoFile(commonProtoPath, 'syntax = "proto3";\n');

    const manifest: ProtoFeaturesManifest = {
      version: 'v1',
      features: {
        about_me: {
          domain: just(['dev/namlit/domain/about_me/v1/about_me.proto']),
          read_api: just(['dev/namlit/api/read/about_me/v1/about_me_service.proto']),
          write_api: nothing()
        }
      }
    };

    const selectedFeaturesByLayer: SelectedFeaturesByLayer = {
      domain: ['about_me'],
      read_api: ['about_me'],
      write_api: []
    };

    const selectedPathsResult: Result<ReadonlySet<string>, GenerationError> = selectProtoPaths(
      manifest,
      selectedFeaturesByLayer,
      protoRoot,
      'proto/features.yaml'
    );

    rmSync(protoRoot, { recursive: true, force: true });

    expect(selectedPathsResult.isOk).toBe(true);
    if (selectedPathsResult.isErr) {
      return;
    }

    const sortedPaths: string[] = [...selectedPathsResult.value.values()].sort(
      (left: string, right: string): number => left.localeCompare(right)
    );

    expect(sortedPaths).toEqual([
      'dev/namlit/api/read/about_me/v1/about_me_service.proto',
      'dev/namlit/common/v1/pagination.proto',
      'dev/namlit/domain/about_me/v1/about_me.proto'
    ]);
  });

  test('validates manifest contract paths and aggregates missing/non-file path issues', (): void => {
    const protoRoot: string = createTempProtoRoot();

    const existingRelativePath: string = 'dev/namlit/domain/about_me/v1/about_me.proto';
    const missingRelativePath: string = 'dev/namlit/domain/about_me/v1/missing.proto';
    const directoryRelativePath: string = 'dev/namlit/domain/about_me/v1/not_a_file';

    writeProtoFile(join(protoRoot, existingRelativePath), 'syntax = "proto3";\n');
    mkdirSync(join(protoRoot, directoryRelativePath), { recursive: true });

    const manifest: ProtoFeaturesManifest = {
      version: 'v1',
      features: {
        about_me: {
          domain: just([existingRelativePath, missingRelativePath, directoryRelativePath]),
          read_api: nothing(),
          write_api: nothing()
        }
      }
    };

    const validationResult: Result<Unit, GenerationError> = validateManifestContractPaths(
      manifest,
      protoRoot,
      'proto/features.yaml'
    );

    rmSync(protoRoot, { recursive: true, force: true });

    expect(validationResult.isErr).toBe(true);
    if (validationResult.isOk) {
      return;
    }

    expect(validationResult.error.code).toBe('VALIDATION');
    if (validationResult.error.code !== 'VALIDATION') {
      return;
    }

    const issueFieldPaths: readonly string[] = validationResult.error.issues.map(
      (issue: { readonly fieldPath: string }): string => issue.fieldPath
    );

    expect(issueFieldPaths).toEqual([
      'features.about_me.domain[1]',
      'features.about_me.domain[2]'
    ]);
  });
});
