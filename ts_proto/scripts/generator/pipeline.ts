import type { Result } from 'true-myth/result';
import { err, ok } from 'true-myth/result';
import { fromResult, type Task } from 'true-myth/task';
import Unit from 'true-myth/unit';
import type { GenerationError } from './errors.js';
import { cleanDirectory } from './boundary/filesystem.js';
import { runBufGenerate } from './buf_generate.js';
import { writeIndexFiles } from './index_generation.js';
import { loadProtoFeaturesManifest, loadTsFeatureSelection } from './manifests.js';
import type { GenerationPaths, GenerationSummary, PreparedGeneration } from './models.js';
import { expandWithTransitiveImports } from './proto_graph.js';
import {
  resolveSelectedFeaturesByLayer,
  selectProtoPaths,
  validateManifestContractPaths
} from './selection.js';
import { collectSelectedFeatureNames } from './utilities.js';

export interface GenerationRuntimeInput {
  readonly paths: GenerationPaths;
}

function prepareGeneration(input: GenerationRuntimeInput): Result<PreparedGeneration, GenerationError> {
  // Keep all validation and graph resolution upfront so side-effect steps can assume sound inputs.
  const manifestResult = loadProtoFeaturesManifest(input.paths.featuresManifestPath);
  if (manifestResult.isErr) {
    return err(manifestResult.error);
  }

  const manifestContractValidationResult: Result<Unit, GenerationError> = validateManifestContractPaths(
    manifestResult.value,
    input.paths.protoRoot,
    input.paths.featuresManifestPath
  );
  if (manifestContractValidationResult.isErr) {
    return err(manifestContractValidationResult.error);
  }

  const selectionResult = loadTsFeatureSelection(input.paths.tsFeatureSelectionPath);
  if (selectionResult.isErr) {
    return err(selectionResult.error);
  }

  const selectedFeaturesByLayerResult = resolveSelectedFeaturesByLayer(
    selectionResult.value,
    manifestResult.value.features,
    input.paths.tsFeatureSelectionPath,
    input.paths.featuresManifestPath
  );
  if (selectedFeaturesByLayerResult.isErr) {
    return err(selectedFeaturesByLayerResult.error);
  }

  const selectedProtoPathsResult = selectProtoPaths(
    manifestResult.value,
    selectedFeaturesByLayerResult.value,
    input.paths.protoRoot,
    input.paths.featuresManifestPath
  );
  if (selectedProtoPathsResult.isErr) {
    return err(selectedProtoPathsResult.error);
  }

  const expandedProtoPathsResult = expandWithTransitiveImports(
    selectedProtoPathsResult.value,
    input.paths.protoRoot
  );
  if (expandedProtoPathsResult.isErr) {
    return err(expandedProtoPathsResult.error);
  }

  return ok({
    manifest: manifestResult.value,
    selection: selectionResult.value,
    selectedFeaturesByLayer: selectedFeaturesByLayerResult.value,
    selectedProtoPaths: selectedProtoPathsResult.value,
    expandedProtoPaths: expandedProtoPathsResult.value
  });
}

function createGenerationSummary(
  generatedRoot: string,
  preparedGeneration: PreparedGeneration
): GenerationSummary {
  const selectedFeatureCount: number = collectSelectedFeatureNames(
    preparedGeneration.selectedFeaturesByLayer
  ).length;

  return {
    expandedProtoFileCount: preparedGeneration.expandedProtoPaths.size,
    selectedFeatureCount,
    generatedRoot
  };
}

export function runGeneration(input: GenerationRuntimeInput): Task<GenerationSummary, GenerationError> {
  const preparedGenerationResult: Result<PreparedGeneration, GenerationError> = prepareGeneration(input);

  // Order matters: clean stale output, generate contracts, then build stable index exports.
  return fromResult(preparedGenerationResult)
    .andThen((preparedGeneration: PreparedGeneration): Task<PreparedGeneration, GenerationError> => {
      return fromResult(cleanDirectory(input.paths.generatedRoot)).map(
        (): PreparedGeneration => preparedGeneration
      );
    })
    .andThen((preparedGeneration: PreparedGeneration): Task<PreparedGeneration, GenerationError> => {
      return runBufGenerate(input.paths.tsProtoRoot, preparedGeneration.expandedProtoPaths).map(
        (): PreparedGeneration => preparedGeneration
      );
    })
    .andThen((preparedGeneration: PreparedGeneration): Task<GenerationSummary, GenerationError> => {
      return fromResult(
        writeIndexFiles(input.paths.generatedRoot, preparedGeneration.selectedFeaturesByLayer)
      ).map(
        (): GenerationSummary => createGenerationSummary(input.paths.generatedRoot, preparedGeneration)
      );
    });
}
