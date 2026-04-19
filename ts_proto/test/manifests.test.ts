import { describe, expect, test } from 'bun:test';
import type { Result } from 'true-myth/result';
import type { GenerationError } from '../scripts/generator/errors.js';
import {
  parseProtoFeaturesManifestFromYamlObject,
  parseTsFeatureSelectionFromYamlObject
} from '../scripts/generator/manifests.js';
import {
  parseYamlObjectDocument,
  type YamlObject
} from '../scripts/generator/boundary/yaml.js';
import type {
  ProtoFeatureEntry,
  ProtoFeaturesManifest,
  TsFeatureSelection
} from '../scripts/generator/models.js';

function parseYamlRoot(raw: string, sourcePath: string): Result<YamlObject, GenerationError> {
  return parseYamlObjectDocument(raw, sourcePath);
}

describe('manifests', (): void => {
  test('parses valid proto feature manifest', (): void => {
    const sourcePath: string = 'proto/features.yaml';
    const rawYaml: string = [
      'version: v1',
      'features:',
      '  about_me:',
      '    domain:',
      '      - dev/namlit/domain/about_me/v1/about_me.proto',
      '    read_api:',
      '      - dev/namlit/api/read/about_me/v1/about_me_models.proto',
      '    write_api:',
      '      - dev/namlit/api/write/about_me/v1/about_me_commands.proto'
    ].join('\n');

    const rootResult: Result<YamlObject, GenerationError> = parseYamlRoot(rawYaml, sourcePath);
    expect(rootResult.isOk).toBe(true);
    if (rootResult.isErr) {
      return;
    }

    const manifestResult: Result<ProtoFeaturesManifest, GenerationError> =
      parseProtoFeaturesManifestFromYamlObject(rootResult.value, sourcePath);

    expect(manifestResult.isOk).toBe(true);
    if (manifestResult.isErr) {
      return;
    }

    expect(Object.keys(manifestResult.value.features)).toEqual(['about_me']);
    const hasAboutMeEntry: boolean = Object.prototype.hasOwnProperty.call(
      manifestResult.value.features,
      'about_me'
    );
    expect(hasAboutMeEntry).toBe(true);
    if (!hasAboutMeEntry) {
      return;
    }

    const aboutMeEntry: ProtoFeatureEntry = manifestResult.value.features['about_me'] as ProtoFeatureEntry;
    const aboutMeDomain = aboutMeEntry.domain;
    expect(aboutMeDomain.isJust).toBe(true);
  });

  test('aggregates ts feature selection validation errors', (): void => {
    const sourcePath: string = 'ts_proto/features.yaml';
    const rawYaml: string = [
      'version: 5',
      'features:',
      "  '':",
      '    domain: true',
      '    read_api: false',
      '    write_api: false',
      '  about_me:',
      '    domain: yes',
      '    read_api: 1',
      '    write_api: false',
      '  contact: 42'
    ].join('\n');

    const rootResult: Result<YamlObject, GenerationError> = parseYamlRoot(rawYaml, sourcePath);
    expect(rootResult.isOk).toBe(true);
    if (rootResult.isErr) {
      return;
    }

    const selectionResult: Result<TsFeatureSelection, GenerationError> =
      parseTsFeatureSelectionFromYamlObject(rootResult.value, sourcePath);

    expect(selectionResult.isErr).toBe(true);
    if (selectionResult.isOk) {
      return;
    }

    expect(selectionResult.error.code).toBe('VALIDATION');
    if (selectionResult.error.code !== 'VALIDATION') {
      return;
    }

    const issueFields: readonly string[] = selectionResult.error.issues.map(
      (issue: { readonly fieldPath: string }): string => issue.fieldPath
    );

    expect(issueFields).toEqual([
      'features.<empty>',
      'features.about_me.domain',
      'features.about_me.read_api',
      'features.contact',
      'version'
    ]);
  });
});
