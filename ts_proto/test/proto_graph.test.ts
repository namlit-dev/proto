import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Result } from 'true-myth/result';
import type { GenerationError } from '../scripts/generator/errors.js';
import {
  expandWithTransitiveImports,
  parseImportsFromProtoContent
} from '../scripts/generator/proto_graph.js';

function createTempProtoRoot(): string {
  return mkdtempSync(join(tmpdir(), 'ts-proto-graph-'));
}

function writeProto(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

describe('proto graph', (): void => {
  test('parses import statements from proto content', (): void => {
    const content: string = [
      'syntax = "proto3";',
      'import "dev/namlit/common/v1/pagination.proto";',
      'import "google/protobuf/timestamp.proto";'
    ].join('\n');

    const imports: readonly string[] = parseImportsFromProtoContent(content);
    expect(imports).toEqual([
      'dev/namlit/common/v1/pagination.proto',
      'google/protobuf/timestamp.proto'
    ]);
  });

  test('expands selected protos with transitive imports and excludes google protos', (): void => {
    const protoRoot: string = createTempProtoRoot();

    writeProto(
      join(protoRoot, 'feature_a.proto'),
      [
        'syntax = "proto3";',
        'import "feature_b.proto";',
        'import "google/protobuf/timestamp.proto";'
      ].join('\n')
    );

    writeProto(
      join(protoRoot, 'feature_b.proto'),
      ['syntax = "proto3";', 'import "feature_c.proto";'].join('\n')
    );

    writeProto(join(protoRoot, 'feature_c.proto'), 'syntax = "proto3";\n');

    const expandedResult: Result<ReadonlySet<string>, GenerationError> = expandWithTransitiveImports(
      new Set<string>(['feature_a.proto']),
      protoRoot
    );

    rmSync(protoRoot, { recursive: true, force: true });

    expect(expandedResult.isOk).toBe(true);
    if (expandedResult.isErr) {
      return;
    }

    const sortedPaths: string[] = [...expandedResult.value.values()].sort(
      (left: string, right: string): number => left.localeCompare(right)
    );

    expect(sortedPaths).toEqual(['feature_a.proto', 'feature_b.proto', 'feature_c.proto']);
  });
});
