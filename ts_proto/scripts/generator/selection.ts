import { join } from 'node:path';
import type { Maybe } from 'true-myth/maybe';
import { just, nothing } from 'true-myth/maybe';
import type { Result } from 'true-myth/result';
import { err, ok } from 'true-myth/result';
import Unit from 'true-myth/unit';
import type { GenerationError, ValidationIssue } from './errors.js';
import { createValidationError, validationResultFromIssues } from './errors.js';
import { getPathStats, getPathStatsIfExists, readDirectory } from './boundary/filesystem.js';
import type {
  ManifestLayer,
  ProtoFeatureEntry,
  ProtoFeaturesManifest,
  SelectedFeaturesByLayer,
  TsFeatureSelection
} from './models.js';
import { SUPPORTED_LAYERS } from './models.js';
import { toPosixRelativePath } from './utilities.js';

function makeIssue(sourcePath: string, fieldPath: string, message: string): ValidationIssue {
  return {
    sourcePath,
    fieldPath,
    message
  };
}

function getFeatureEntry(
  features: Readonly<Record<string, ProtoFeatureEntry>>,
  featureName: string
): Maybe<ProtoFeatureEntry> {
  const hasFeatureEntry: boolean = Object.prototype.hasOwnProperty.call(features, featureName);
  if (!hasFeatureEntry) {
    return nothing();
  }

  const featureEntry: ProtoFeatureEntry = features[featureName] as ProtoFeatureEntry;
  return just(featureEntry);
}

function getEnabledLayers(layerSelection: {
  readonly domain: boolean;
  readonly read_api: boolean;
  readonly write_api: boolean;
}): readonly ManifestLayer[] {
  // Iterate from shared layer constant so selection + validation stay aligned when layers evolve.
  const enabledLayers: ManifestLayer[] = [];

  for (const layer of SUPPORTED_LAYERS) {
    if (layerSelection[layer]) {
      enabledLayers.push(layer);
    }
  }

  return enabledLayers;
}

export function resolveSelectedFeaturesByLayer(
  selection: TsFeatureSelection,
  manifestFeatures: Readonly<Record<string, ProtoFeatureEntry>>,
  selectionSourcePath: string,
  manifestSourcePath: string
): Result<SelectedFeaturesByLayer, GenerationError> {
  const issues: ValidationIssue[] = [];

  const selectedDomainFeatures: string[] = [];
  const selectedReadFeatures: string[] = [];
  const selectedWriteFeatures: string[] = [];

  for (const [featureNameBoundary, layerSelection] of Object.entries(selection.features)) {
    const featureName: string = featureNameBoundary.trim();

    if (featureName.length === 0) {
      issues.push(makeIssue(selectionSourcePath, 'features.<empty>', 'Feature key must not be empty.'));
      continue;
    }

    const featureEntry: Maybe<ProtoFeatureEntry> = getFeatureEntry(manifestFeatures, featureName);
    if (featureEntry.isNothing) {
      issues.push(
        makeIssue(
          selectionSourcePath,
          `features.${featureName}`,
          `Feature '${featureName}' is not defined in ${manifestSourcePath}.`
        )
      );
      continue;
    }

    const enabledLayers: readonly ManifestLayer[] = getEnabledLayers(layerSelection);
    if (enabledLayers.length === 0) {
      issues.push(
        makeIssue(
          selectionSourcePath,
          `features.${featureName}`,
          'At least one layer must be enabled.'
        )
      );
      continue;
    }

    for (const layer of enabledLayers) {
      if (layer === 'domain') {
        selectedDomainFeatures.push(featureName);
      }

      if (layer === 'read_api') {
        selectedReadFeatures.push(featureName);
      }

      if (layer === 'write_api') {
        selectedWriteFeatures.push(featureName);
      }
    }
  }

  const selectedFeaturesByLayer: SelectedFeaturesByLayer = {
    domain: [...selectedDomainFeatures].sort((left: string, right: string): number => left.localeCompare(right)),
    read_api: [...selectedReadFeatures].sort((left: string, right: string): number => left.localeCompare(right)),
    write_api: [...selectedWriteFeatures].sort((left: string, right: string): number => left.localeCompare(right))
  };

  return validationResultFromIssues(
    selectedFeaturesByLayer,
    issues,
    'Failed to resolve selected features by layer.'
  );
}

function listCommonProtos(protoRoot: string): Result<readonly string[], GenerationError> {
  const commonRoot: string = join(protoRoot, 'dev', 'namlit', 'common', 'v1');
  const entriesResult: Result<readonly string[], GenerationError> = readDirectory(commonRoot);
  if (entriesResult.isErr) {
    return err(entriesResult.error);
  }

  const commonProtos: string[] = [];

  for (const entry of entriesResult.value) {
    if (!entry.endsWith('.proto')) {
      continue;
    }

    const absolutePath: string = join(commonRoot, entry);
    const pathStatsResult: Result<{ readonly isFile: boolean; readonly isDirectory: boolean }, GenerationError> =
      getPathStats(absolutePath);
    if (pathStatsResult.isErr) {
      return err(pathStatsResult.error);
    }

    if (!pathStatsResult.value.isFile) {
      continue;
    }

    commonProtos.push(toPosixRelativePath(protoRoot, absolutePath));
  }

  return ok(commonProtos.sort((left: string, right: string): number => left.localeCompare(right)));
}

function readLayerPaths(featureEntry: ProtoFeatureEntry, layer: ManifestLayer): Maybe<readonly string[]> {
  if (layer === 'domain') {
    return featureEntry.domain;
  }

  if (layer === 'read_api') {
    return featureEntry.read_api;
  }

  return featureEntry.write_api;
}

export function validateManifestContractPaths(
  manifest: ProtoFeaturesManifest,
  protoRoot: string,
  manifestSourcePath: string
): Result<Unit, GenerationError> {
  const issues: ValidationIssue[] = [];
  const sortedFeatures: readonly string[] = Object.keys(manifest.features).sort(
    (left: string, right: string): number => left.localeCompare(right)
  );

  for (const featureName of sortedFeatures) {
    const featureEntry: Maybe<ProtoFeatureEntry> = getFeatureEntry(manifest.features, featureName);
    if (featureEntry.isNothing) {
      continue;
    }

    for (const layer of SUPPORTED_LAYERS) {
      const layerPaths: Maybe<readonly string[]> = readLayerPaths(featureEntry.value, layer);
      if (layerPaths.isNothing) {
        continue;
      }

      let index: number = 0;
      for (const relativeProtoPath of layerPaths.value) {
        const fieldPath: string = `features.${featureName}.${layer}[${index}]`;
        const normalizedRelativeProtoPath: string = relativeProtoPath.trim();
        if (normalizedRelativeProtoPath.length === 0) {
          issues.push(
            makeIssue(
              manifestSourcePath,
              fieldPath,
              'Proto path must not be empty.'
            )
          );
          index += 1;
          continue;
        }

        const absoluteProtoPath: string = join(protoRoot, normalizedRelativeProtoPath);
        const optionalStatsResult = getPathStatsIfExists(absoluteProtoPath);
        if (optionalStatsResult.isErr) {
          return err(optionalStatsResult.error);
        }

        if (optionalStatsResult.value.isNothing) {
          issues.push(
            makeIssue(
              manifestSourcePath,
              fieldPath,
              `Proto path '${normalizedRelativeProtoPath}' does not exist.`
            )
          );
          index += 1;
          continue;
        }

        if (!optionalStatsResult.value.value.isFile) {
          issues.push(
            makeIssue(
              manifestSourcePath,
              fieldPath,
              `Proto path '${normalizedRelativeProtoPath}' must point to a file.`
            )
          );
        }

        index += 1;
      }
    }
  }

  return validationResultFromIssues(
    Unit,
    issues,
    'Manifest contract validation failed for proto/features.yaml.'
  );
}

export function selectProtoPaths(
  manifest: ProtoFeaturesManifest,
  selectedFeaturesByLayer: SelectedFeaturesByLayer,
  protoRoot: string,
  manifestSourcePath: string
): Result<ReadonlySet<string>, GenerationError> {
  const issues: ValidationIssue[] = [];
  const selectedPaths: Set<string> = new Set<string>();

  if (selectedFeaturesByLayer.domain.length > 0) {
    // Domain selections always include common DTO contracts shared across feature packages.
    const commonPathsResult: Result<readonly string[], GenerationError> = listCommonProtos(protoRoot);
    if (commonPathsResult.isErr) {
      return err(commonPathsResult.error);
    }

    for (const commonProtoPath of commonPathsResult.value) {
      selectedPaths.add(commonProtoPath);
    }
  }

  for (const layer of SUPPORTED_LAYERS) {
    const selectedFeatureNames: readonly string[] = selectedFeaturesByLayer[layer];

    for (const featureName of selectedFeatureNames) {
      const featureEntry: Maybe<ProtoFeatureEntry> = getFeatureEntry(manifest.features, featureName);
      if (featureEntry.isNothing) {
        issues.push(
          makeIssue(
            manifestSourcePath,
            `features.${featureName}`,
            `Feature '${featureName}' is not defined in proto manifest.`
          )
        );
        continue;
      }

      const layerPaths: Maybe<readonly string[]> = readLayerPaths(featureEntry.value, layer);
      if (layerPaths.isNothing) {
        issues.push(
          makeIssue(
            manifestSourcePath,
            `features.${featureName}.${layer}`,
            'Selected layer is missing in proto manifest.'
          )
        );
        continue;
      }

      if (layerPaths.value.length === 0) {
        issues.push(
          makeIssue(
            manifestSourcePath,
            `features.${featureName}.${layer}`,
            'Selected layer must have at least one proto path.'
          )
        );
        continue;
      }

      for (const path of layerPaths.value) {
        selectedPaths.add(path);
      }
    }
  }

  if (selectedPaths.size === 0) {
    issues.push(
      makeIssue(
        manifestSourcePath,
        'features',
        'No proto files were selected from ts_proto/features.yaml configuration.'
      )
    );
  }

  if (issues.length > 0) {
    return err(createValidationError('Failed to resolve proto paths for selected features.', issues));
  }

  return ok(selectedPaths);
}
