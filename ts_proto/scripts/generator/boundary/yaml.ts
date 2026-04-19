import { parse } from 'yaml';
import type { Result } from 'true-myth/result';
import { err, ok } from 'true-myth/result';
import type { GenerationError, YamlGenerationError } from '../errors.js';

export interface YamlNull {
  readonly kind: 'null';
}

export interface YamlString {
  readonly kind: 'string';
  readonly value: string;
}

export interface YamlBoolean {
  readonly kind: 'boolean';
  readonly value: boolean;
}

export interface YamlNumber {
  readonly kind: 'number';
  readonly value: number;
}

export interface YamlArray {
  readonly kind: 'array';
  readonly items: readonly YamlValue[];
}

export interface YamlObject {
  readonly kind: 'object';
  readonly fields: Readonly<Record<string, YamlValue>>;
}

export type YamlValue = YamlNull | YamlString | YamlBoolean | YamlNumber | YamlArray | YamlObject;

const YAML_NULL: YamlNull = {
  kind: 'null'
};

function createYamlError(message: string, sourcePath: string, cause: string): YamlGenerationError {
  return {
    code: 'YAML_PARSE',
    message,
    sourcePath,
    cause
  };
}

function normalizeYamlBoundaryError(boundaryError: unknown): string {
  if (boundaryError instanceof Error) {
    return boundaryError.message;
  }

  return 'Unknown YAML boundary error.';
}

function convertBoundaryValue(
  value: unknown,
  sourcePath: string,
  seenObjects: WeakSet<object>
): Result<YamlValue, GenerationError> {
  if (typeof value === 'string') {
    return ok({
      kind: 'string',
      value
    });
  }

  if (typeof value === 'boolean') {
    return ok({
      kind: 'boolean',
      value
    });
  }

  if (typeof value === 'number') {
    return ok({
      kind: 'number',
      value
    });
  }

  if (typeof value === 'undefined') {
    return err(createYamlError('YAML value cannot be undefined.', sourcePath, 'Undefined value encountered.'));
  }

  if (value === null) {
    return ok(YAML_NULL);
  }

  if (Array.isArray(value)) {
    const convertedItems: YamlValue[] = [];

    for (const item of value) {
      const convertedItemResult: Result<YamlValue, GenerationError> = convertBoundaryValue(
        item,
        sourcePath,
        seenObjects
      );

      if (convertedItemResult.isErr) {
        return convertedItemResult;
      }

      convertedItems.push(convertedItemResult.value);
    }

    return ok({
      kind: 'array',
      items: convertedItems
    });
  }

  if (typeof value === 'object') {
    if (seenObjects.has(value)) {
      return err(
        createYamlError('YAML object graph is cyclic.', sourcePath, 'Cycle detected while decoding YAML.')
      );
    }

    seenObjects.add(value);
    const fields: Record<string, YamlValue> = {};

    for (const [entryKey, entryValue] of Object.entries(value)) {
      const convertedEntryResult: Result<YamlValue, GenerationError> = convertBoundaryValue(
        entryValue,
        sourcePath,
        seenObjects
      );

      if (convertedEntryResult.isErr) {
        return convertedEntryResult;
      }

      fields[entryKey] = convertedEntryResult.value;
    }

    seenObjects.delete(value);

    return ok({
      kind: 'object',
      fields
    });
  }

  return err(
    createYamlError(
      'YAML contains unsupported value kind.',
      sourcePath,
      `Unsupported value type '${typeof value}'.`
    )
  );
}

export function parseYamlObjectDocument(raw: string, sourcePath: string): Result<YamlObject, GenerationError> {
  let parsedBoundaryValue: unknown;

  try {
    parsedBoundaryValue = parse(raw);
  } catch (boundaryError: unknown) {
    const cause: string = normalizeYamlBoundaryError(boundaryError);
    return err(createYamlError('Failed to parse YAML document.', sourcePath, cause));
  }

  const convertedRootResult: Result<YamlValue, GenerationError> = convertBoundaryValue(
    parsedBoundaryValue,
    sourcePath,
    new WeakSet<object>()
  );

  if (convertedRootResult.isErr) {
    return err(convertedRootResult.error);
  }

  if (convertedRootResult.value.kind !== 'object') {
    return err(
      createYamlError('YAML document root must be an object.', sourcePath, 'Parsed root value is not an object.')
    );
  }

  return ok(convertedRootResult.value);
}
