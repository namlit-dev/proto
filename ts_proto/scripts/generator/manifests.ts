import type { Maybe } from 'true-myth/maybe';
import { just, nothing } from 'true-myth/maybe';
import type { Result } from 'true-myth/result';
import { err, ok } from 'true-myth/result';
import type { GenerationError, ValidationIssue } from './errors.js';
import { createValidationError, validationResultFromIssues } from './errors.js';
import type {
  ProtoFeatureEntry,
  ProtoFeaturesManifest,
  TsFeatureLayerSelection,
  TsFeatureSelection
} from './models.js';
import { readUtf8File } from './boundary/filesystem.js';
import {
  parseYamlObjectDocument,
  type YamlArray,
  type YamlObject,
  type YamlValue
} from './boundary/yaml.js';

const DEFAULT_MANIFEST_VERSION: string = 'v1';

function makeIssue(sourcePath: string, fieldPath: string, message: string): ValidationIssue {
  return {
    sourcePath,
    fieldPath,
    message
  };
}

function getField(objectValue: YamlObject, key: string): Maybe<YamlValue> {
  const hasKey: boolean = Object.prototype.hasOwnProperty.call(objectValue.fields, key);
  if (!hasKey) {
    return nothing();
  }

  const rawFieldValue: YamlValue = objectValue.fields[key] as YamlValue;
  return just(rawFieldValue);
}

function parseVersion(root: YamlObject, sourcePath: string, issues: ValidationIssue[]): string {
  const versionValue: Maybe<YamlValue> = getField(root, 'version');

  if (versionValue.isNothing) {
    // Keep current manifests backward-compatible when version is omitted.
    return DEFAULT_MANIFEST_VERSION;
  }

  if (versionValue.value.kind !== 'string') {
    issues.push(makeIssue(sourcePath, 'version', 'Must be a string when provided.'));
    return DEFAULT_MANIFEST_VERSION;
  }

  return versionValue.value.value;
}

function parseFeaturesRoot(root: YamlObject, sourcePath: string, issues: ValidationIssue[]): Maybe<YamlObject> {
  const featuresValue: Maybe<YamlValue> = getField(root, 'features');

  if (featuresValue.isNothing) {
    issues.push(makeIssue(sourcePath, 'features', 'Missing required field.'));
    return nothing();
  }

  if (featuresValue.value.kind !== 'object') {
    issues.push(makeIssue(sourcePath, 'features', 'Must be an object keyed by feature name.'));
    return nothing();
  }

  const featureCount: number = Object.keys(featuresValue.value.fields).length;
  if (featureCount === 0) {
    issues.push(makeIssue(sourcePath, 'features', 'Must contain at least one feature entry.'));
  }

  return just(featuresValue.value);
}

function parseOptionalStringArray(
  parent: YamlObject,
  key: string,
  sourcePath: string,
  fieldPath: string,
  issues: ValidationIssue[]
): Maybe<readonly string[]> {
  const value: Maybe<YamlValue> = getField(parent, key);

  if (value.isNothing) {
    return nothing();
  }

  if (value.value.kind !== 'array') {
    issues.push(makeIssue(sourcePath, fieldPath, 'Must be an array of strings when provided.'));
    return nothing();
  }

  return parseStringArray(value.value, sourcePath, fieldPath, issues);
}

function parseStringArray(
  arrayValue: YamlArray,
  sourcePath: string,
  fieldPath: string,
  issues: ValidationIssue[]
): Maybe<readonly string[]> {
  const parsedItems: string[] = [];
  let hasInvalidItems: boolean = false;

  let index: number = 0;
  for (const item of arrayValue.items) {
    if (item.kind !== 'string') {
      issues.push(
        makeIssue(
          sourcePath,
          `${fieldPath}[${index}]`,
          'Array entries must be strings.'
        )
      );
      hasInvalidItems = true;
      index += 1;
      continue;
    }

    parsedItems.push(item.value);
    index += 1;
  }

  return hasInvalidItems ? nothing() : just(parsedItems);
}

function parseRequiredBoolean(
  parent: YamlObject,
  key: string,
  sourcePath: string,
  fieldPath: string,
  issues: ValidationIssue[]
): boolean {
  // Force explicit true/false in ts_proto/features.yaml to avoid implicit defaults in layer selection.
  const value: Maybe<YamlValue> = getField(parent, key);

  if (value.isNothing) {
    issues.push(makeIssue(sourcePath, fieldPath, 'Missing required boolean field.'));
    return false;
  }

  if (value.value.kind !== 'boolean') {
    issues.push(makeIssue(sourcePath, fieldPath, 'Must be a boolean value.'));
    return false;
  }

  return value.value.value;
}

function parseProtoFeatureEntry(
  featureName: string,
  sourcePath: string,
  value: YamlValue,
  issues: ValidationIssue[]
): Maybe<ProtoFeatureEntry> {
  const featurePathPrefix: string = `features.${featureName}`;

  if (value.kind !== 'object') {
    issues.push(makeIssue(sourcePath, featurePathPrefix, 'Feature entry must be an object.'));
    return nothing();
  }

  const entry: ProtoFeatureEntry = {
    domain: parseOptionalStringArray(
      value,
      'domain',
      sourcePath,
      `${featurePathPrefix}.domain`,
      issues
    ),
    read_api: parseOptionalStringArray(
      value,
      'read_api',
      sourcePath,
      `${featurePathPrefix}.read_api`,
      issues
    ),
    write_api: parseOptionalStringArray(
      value,
      'write_api',
      sourcePath,
      `${featurePathPrefix}.write_api`,
      issues
    )
  };

  return just(entry);
}

export function parseProtoFeaturesManifestFromYamlObject(
  root: YamlObject,
  sourcePath: string
): Result<ProtoFeaturesManifest, GenerationError> {
  const issues: ValidationIssue[] = [];
  const version: string = parseVersion(root, sourcePath, issues);
  const featuresRoot: Maybe<YamlObject> = parseFeaturesRoot(root, sourcePath, issues);
  const features: Record<string, ProtoFeatureEntry> = {};

  if (featuresRoot.isJust) {
    for (const [featureNameBoundary, featureValue] of Object.entries(featuresRoot.value.fields)) {
      const featureName: string = featureNameBoundary.trim();
      if (featureName.length === 0) {
        issues.push(makeIssue(sourcePath, 'features.<empty>', 'Feature key must not be empty.'));
        continue;
      }

      const parsedEntry: Maybe<ProtoFeatureEntry> = parseProtoFeatureEntry(
        featureName,
        sourcePath,
        featureValue,
        issues
      );
      if (parsedEntry.isNothing) {
        continue;
      }

      features[featureName] = parsedEntry.value;
    }
  }

  return validationResultFromIssues(
    {
      version,
      features
    },
    issues,
    `Invalid proto feature manifest at ${sourcePath}.`
  );
}

function parseTsFeatureSelectionEntry(
  featureName: string,
  sourcePath: string,
  value: YamlValue,
  issues: ValidationIssue[]
): Maybe<TsFeatureLayerSelection> {
  const featurePathPrefix: string = `features.${featureName}`;

  if (value.kind !== 'object') {
    issues.push(makeIssue(sourcePath, featurePathPrefix, 'Feature selection entry must be an object.'));
    return nothing();
  }

  return just({
    domain: parseRequiredBoolean(value, 'domain', sourcePath, `${featurePathPrefix}.domain`, issues),
    read_api: parseRequiredBoolean(value, 'read_api', sourcePath, `${featurePathPrefix}.read_api`, issues),
    write_api: parseRequiredBoolean(value, 'write_api', sourcePath, `${featurePathPrefix}.write_api`, issues)
  });
}

export function parseTsFeatureSelectionFromYamlObject(
  root: YamlObject,
  sourcePath: string
): Result<TsFeatureSelection, GenerationError> {
  const issues: ValidationIssue[] = [];
  const version: string = parseVersion(root, sourcePath, issues);
  const featuresRoot: Maybe<YamlObject> = parseFeaturesRoot(root, sourcePath, issues);
  const features: Record<string, TsFeatureLayerSelection> = {};

  if (featuresRoot.isJust) {
    for (const [featureNameBoundary, featureValue] of Object.entries(featuresRoot.value.fields)) {
      const featureName: string = featureNameBoundary.trim();
      if (featureName.length === 0) {
        issues.push(makeIssue(sourcePath, 'features.<empty>', 'Feature key must not be empty.'));
        continue;
      }

      const parsedEntry: Maybe<TsFeatureLayerSelection> = parseTsFeatureSelectionEntry(
        featureName,
        sourcePath,
        featureValue,
        issues
      );
      if (parsedEntry.isNothing) {
        continue;
      }

      features[featureName] = parsedEntry.value;
    }
  }

  return validationResultFromIssues(
    {
      version,
      features
    },
    issues,
    `Invalid TS feature selection at ${sourcePath}.`
  );
}

export function loadProtoFeaturesManifest(sourcePath: string): Result<ProtoFeaturesManifest, GenerationError> {
  const rawResult: Result<string, GenerationError> = readUtf8File(sourcePath);
  if (rawResult.isErr) {
    return err(rawResult.error);
  }

  const yamlRootResult: Result<YamlObject, GenerationError> = parseYamlObjectDocument(
    rawResult.value,
    sourcePath
  );
  if (yamlRootResult.isErr) {
    return err(yamlRootResult.error);
  }

  return parseProtoFeaturesManifestFromYamlObject(yamlRootResult.value, sourcePath);
}

export function loadTsFeatureSelection(sourcePath: string): Result<TsFeatureSelection, GenerationError> {
  const rawResult: Result<string, GenerationError> = readUtf8File(sourcePath);
  if (rawResult.isErr) {
    return err(rawResult.error);
  }

  const yamlRootResult: Result<YamlObject, GenerationError> = parseYamlObjectDocument(
    rawResult.value,
    sourcePath
  );
  if (yamlRootResult.isErr) {
    return err(yamlRootResult.error);
  }

  const parsedSelectionResult: Result<TsFeatureSelection, GenerationError> =
    parseTsFeatureSelectionFromYamlObject(yamlRootResult.value, sourcePath);

  if (parsedSelectionResult.isErr) {
    return err(parsedSelectionResult.error);
  }

  const hasFeatures: boolean = Object.keys(parsedSelectionResult.value.features).length > 0;
  if (!hasFeatures) {
    return err(
      createValidationError(`Invalid TS feature selection at ${sourcePath}.`, [
        makeIssue(sourcePath, 'features', 'Must contain at least one feature entry.')
      ])
    );
  }

  return ok(parsedSelectionResult.value);
}
