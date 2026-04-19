import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Result } from 'true-myth/result';
import type { Unit } from 'true-myth/unit';
import type { GenerationError } from '../scripts/generator/errors.js';
import type { SelectedFeaturesByLayer } from '../scripts/generator/models.js';
import { writeIndexFiles } from '../scripts/generator/index_generation.js';

function createTempGeneratedRoot(): string {
  return mkdtempSync(join(tmpdir(), 'ts-proto-indexes-'));
}

function writeTsFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

describe('index generation', (): void => {
  test('writes canonical, curated alias, and root indexes', (): void => {
    const generatedRoot: string = createTempGeneratedRoot();

    writeTsFile(
      join(generatedRoot, 'dev', 'namlit', 'common', 'v1', 'pagination_pb.ts'),
      'export const paginationValue: number = 1;\n'
    );
    writeTsFile(
      join(generatedRoot, 'dev', 'namlit', 'domain', 'about_me', 'v1', 'about_me_pb.ts'),
      'export const aboutMeValue: number = 1;\n'
    );
    writeTsFile(
      join(generatedRoot, 'dev', 'namlit', 'api', 'read', 'about_me', 'v1', 'about_me_service_pb.ts'),
      'export const aboutMeReadService: number = 1;\n'
    );

    const selectedFeaturesByLayer: SelectedFeaturesByLayer = {
      domain: ['about_me'],
      read_api: ['about_me'],
      write_api: []
    };

    const writeResult: Result<Unit, GenerationError> = writeIndexFiles(
      generatedRoot,
      selectedFeaturesByLayer
    );

    expect(writeResult.isOk).toBe(true);

    const rootIndexContent: string = readFileSync(join(generatedRoot, 'index.ts'), 'utf8');
    const commonAliasContent: string = readFileSync(
      join(generatedRoot, 'common', 'v1', 'index.ts'),
      'utf8'
    );
    const domainAliasContent: string = readFileSync(
      join(generatedRoot, 'domain', 'about_me', 'v1', 'index.ts'),
      'utf8'
    );
    const readAliasContent: string = readFileSync(
      join(generatedRoot, 'api', 'read', 'about_me', 'v1', 'index.ts'),
      'utf8'
    );

    rmSync(generatedRoot, { recursive: true, force: true });

    expect(rootIndexContent).toContain("export * as dev from './dev';");
    expect(rootIndexContent).toContain("export * as common from './common';");
    expect(rootIndexContent).toContain("export * as domain from './domain';");
    expect(rootIndexContent).toContain("export * as api from './api';");

    expect(commonAliasContent.trim()).toBe("export * from '../../dev/namlit/common/v1';");
    expect(domainAliasContent.trim()).toBe(
      "export * from '../../../dev/namlit/domain/about_me/v1';"
    );
    expect(readAliasContent.trim()).toBe(
      "export * from '../../../../dev/namlit/api/read/about_me/v1';"
    );
  });
});
