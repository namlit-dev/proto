import { join } from 'node:path';
import type { Maybe } from 'true-myth/maybe';
import { just, nothing } from 'true-myth/maybe';
import type { Result } from 'true-myth/result';
import { err, ok } from 'true-myth/result';
import type { GenerationError } from './errors.js';
import { readUtf8File } from './boundary/filesystem.js';

const IMPORT_STATEMENT_PATTERN: RegExp = /^import\s+"([^"]+)"\s*;/;

function popStack(stack: string[]): Maybe<string> {
  if (stack.length === 0) {
    return nothing();
  }

  const stackLengthBefore: number = stack.length;
  const value: string = stack[stackLengthBefore - 1] as string;
  stack.length = stackLengthBefore - 1;
  return just(value);
}

function captureGroup(match: RegExpMatchArray, groupIndex: number): Maybe<string> {
  const hasGroup: boolean = match.length > groupIndex;
  if (!hasGroup) {
    return nothing();
  }

  const boundaryValue: string = match[groupIndex] as string;
  return just(boundaryValue);
}

export function parseImportsFromProtoContent(content: string): readonly string[] {
  const imports: string[] = [];
  const lines: readonly string[] = content.split('\n');

  for (const rawLine of lines) {
    const line: string = rawLine.trim();
    const match: RegExpMatchArray | null = line.match(IMPORT_STATEMENT_PATTERN);
    if (match === null) {
      continue;
    }

    const capturedImportPath: Maybe<string> = captureGroup(match, 1);
    if (capturedImportPath.isNothing) {
      continue;
    }

    imports.push(capturedImportPath.value);
  }

  return imports;
}

export function expandWithTransitiveImports(
  initialPaths: ReadonlySet<string>,
  protoRoot: string
): Result<ReadonlySet<string>, GenerationError> {
  const expandedPaths: Set<string> = new Set<string>();
  const stack: string[] = [...initialPaths.values()];

  while (stack.length > 0) {
    const currentPath: Maybe<string> = popStack(stack);
    if (currentPath.isNothing) {
      continue;
    }

    if (expandedPaths.has(currentPath.value)) {
      continue;
    }

    expandedPaths.add(currentPath.value);

    const absoluteProtoPath: string = join(protoRoot, currentPath.value);
    const rawProtoResult: Result<string, GenerationError> = readUtf8File(absoluteProtoPath);
    if (rawProtoResult.isErr) {
      return err(rawProtoResult.error);
    }

    const imports: readonly string[] = parseImportsFromProtoContent(rawProtoResult.value);

    for (const importPath of imports) {
      if (importPath.startsWith('google/protobuf/')) {
        continue;
      }

      if (!expandedPaths.has(importPath)) {
        stack.push(importPath);
      }
    }
  }

  return ok(expandedPaths);
}
