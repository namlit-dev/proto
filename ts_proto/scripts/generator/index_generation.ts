import { dirname, join } from 'node:path';
import type { Maybe } from 'true-myth/maybe';
import type { Result } from 'true-myth/result';
import { err, ok } from 'true-myth/result';
import Unit from 'true-myth/unit';
import type { GenerationError } from './errors.js';
import {
  ensureDirectory,
  getPathStats,
  getPathStatsIfExists,
  readDirectory,
  readDirectoryIfExists,
  writeUtf8File
} from './boundary/filesystem.js';
import type { SelectedFeaturesByLayer } from './models.js';
import { toSafeIdentifier } from './utilities.js';

function writeAliasIndex(targetPath: string, content: string): Result<Unit, GenerationError> {
  const ensureDirectoryResult: Result<Unit, GenerationError> = ensureDirectory(dirname(targetPath));
  if (ensureDirectoryResult.isErr) {
    return ensureDirectoryResult;
  }

  return writeUtf8File(targetPath, `${content}\n`);
}

function writeDirectoryNamespaceIndex(directoryPath: string): Result<Unit, GenerationError> {
  const entriesResult: Result<Maybe<readonly string[]>, GenerationError> =
    readDirectoryIfExists(directoryPath);

  if (entriesResult.isErr) {
    return err(entriesResult.error);
  }

  if (entriesResult.value.isNothing) {
    return ok(Unit);
  }

  const sortedEntries: string[] = [...entriesResult.value.value].sort(
    (left: string, right: string): number => left.localeCompare(right)
  );

  const namespaceExports: string[] = [];

  for (const entry of sortedEntries) {
    const entryPath: string = join(directoryPath, entry);
    const entryStatsResult = getPathStats(entryPath);
    if (entryStatsResult.isErr) {
      return err(entryStatsResult.error);
    }

    if (!entryStatsResult.value.isDirectory) {
      continue;
    }

    const nestedIndexPath: string = join(entryPath, 'index.ts');
    const nestedIndexStatsResult = getPathStatsIfExists(nestedIndexPath);
    if (nestedIndexStatsResult.isErr) {
      return err(nestedIndexStatsResult.error);
    }

    if (nestedIndexStatsResult.value.isNothing) {
      continue;
    }

    if (!nestedIndexStatsResult.value.value.isFile) {
      continue;
    }

    namespaceExports.push(`export * as ${toSafeIdentifier(entry)} from './${entry}';`);
  }

  if (namespaceExports.length === 0) {
    return ok(Unit);
  }

  return writeUtf8File(join(directoryPath, 'index.ts'), `${namespaceExports.join('\n')}\n`);
}

function generateRecursiveCanonicalIndexes(directoryPath: string): Result<Unit, GenerationError> {
  const entriesResult: Result<readonly string[], GenerationError> = readDirectory(directoryPath);
  if (entriesResult.isErr) {
    return err(entriesResult.error);
  }

  const sortedEntries: string[] = [...entriesResult.value].sort(
    (left: string, right: string): number => left.localeCompare(right)
  );

  const directoryExports: string[] = [];
  const fileExports: string[] = [];

  for (const entry of sortedEntries) {
    const fullPath: string = join(directoryPath, entry);
    const entryStatsResult = getPathStats(fullPath);
    if (entryStatsResult.isErr) {
      return err(entryStatsResult.error);
    }

    if (entryStatsResult.value.isDirectory) {
      const nestedResult: Result<Unit, GenerationError> = generateRecursiveCanonicalIndexes(fullPath);
      if (nestedResult.isErr) {
        return nestedResult;
      }

      const nestedIndexPath: string = join(fullPath, 'index.ts');
      const nestedIndexStatsResult = getPathStatsIfExists(nestedIndexPath);
      if (nestedIndexStatsResult.isErr) {
        return err(nestedIndexStatsResult.error);
      }

      if (nestedIndexStatsResult.value.isJust && nestedIndexStatsResult.value.value.isFile) {
        directoryExports.push(`export * as ${toSafeIdentifier(entry)} from './${entry}';`);
      }

      continue;
    }

    if (entry.endsWith('.ts') && entry !== 'index.ts') {
      const baseName: string = entry.slice(0, -3);
      fileExports.push(`export * from './${baseName}';`);
    }
  }

  if (directoryExports.length === 0 && fileExports.length === 0) {
    return ok(Unit);
  }

  const indexContent: string = [...directoryExports, ...fileExports].join('\n');
  return writeUtf8File(join(directoryPath, 'index.ts'), `${indexContent}\n`);
}

function writeCuratedAliasIndexes(
  generatedRoot: string,
  selectedFeaturesByLayer: SelectedFeaturesByLayer
): Result<Unit, GenerationError> {
  const domainFeatures: readonly string[] = selectedFeaturesByLayer.domain;
  const readFeatures: readonly string[] = selectedFeaturesByLayer.read_api;
  const writeFeatures: readonly string[] = selectedFeaturesByLayer.write_api;

  if (domainFeatures.length > 0) {
    const commonAliasResult: Result<Unit, GenerationError> = writeAliasIndex(
      join(generatedRoot, 'common', 'v1', 'index.ts'),
      "export * from '../../dev/namlit/common/v1';"
    );
    if (commonAliasResult.isErr) {
      return commonAliasResult;
    }

    for (const featureName of domainFeatures) {
      const domainAliasResult: Result<Unit, GenerationError> = writeAliasIndex(
        join(generatedRoot, 'domain', featureName, 'v1', 'index.ts'),
        `export * from '../../../dev/namlit/domain/${featureName}/v1';`
      );
      if (domainAliasResult.isErr) {
        return domainAliasResult;
      }

      const featureNamespaceResult: Result<Unit, GenerationError> = writeDirectoryNamespaceIndex(
        join(generatedRoot, 'domain', featureName)
      );
      if (featureNamespaceResult.isErr) {
        return featureNamespaceResult;
      }
    }

    const domainNamespaceResult: Result<Unit, GenerationError> = writeDirectoryNamespaceIndex(
      join(generatedRoot, 'domain')
    );
    if (domainNamespaceResult.isErr) {
      return domainNamespaceResult;
    }

    const commonNamespaceResult: Result<Unit, GenerationError> = writeDirectoryNamespaceIndex(
      join(generatedRoot, 'common')
    );
    if (commonNamespaceResult.isErr) {
      return commonNamespaceResult;
    }
  }

  if (readFeatures.length > 0) {
    for (const featureName of readFeatures) {
      const readAliasResult: Result<Unit, GenerationError> = writeAliasIndex(
        join(generatedRoot, 'api', 'read', featureName, 'v1', 'index.ts'),
        `export * from '../../../../dev/namlit/api/read/${featureName}/v1';`
      );
      if (readAliasResult.isErr) {
        return readAliasResult;
      }

      const featureNamespaceResult: Result<Unit, GenerationError> = writeDirectoryNamespaceIndex(
        join(generatedRoot, 'api', 'read', featureName)
      );
      if (featureNamespaceResult.isErr) {
        return featureNamespaceResult;
      }
    }

    const readNamespaceResult: Result<Unit, GenerationError> = writeDirectoryNamespaceIndex(
      join(generatedRoot, 'api', 'read')
    );
    if (readNamespaceResult.isErr) {
      return readNamespaceResult;
    }
  }

  if (writeFeatures.length > 0) {
    for (const featureName of writeFeatures) {
      const writeAliasResult: Result<Unit, GenerationError> = writeAliasIndex(
        join(generatedRoot, 'api', 'write', featureName, 'v1', 'index.ts'),
        `export * from '../../../../dev/namlit/api/write/${featureName}/v1';`
      );
      if (writeAliasResult.isErr) {
        return writeAliasResult;
      }

      const featureNamespaceResult: Result<Unit, GenerationError> = writeDirectoryNamespaceIndex(
        join(generatedRoot, 'api', 'write', featureName)
      );
      if (featureNamespaceResult.isErr) {
        return featureNamespaceResult;
      }
    }

    const writeNamespaceResult: Result<Unit, GenerationError> = writeDirectoryNamespaceIndex(
      join(generatedRoot, 'api', 'write')
    );
    if (writeNamespaceResult.isErr) {
      return writeNamespaceResult;
    }
  }

  return writeDirectoryNamespaceIndex(join(generatedRoot, 'api'));
}

function writeRootIndex(
  generatedRoot: string,
  selectedFeaturesByLayer: SelectedFeaturesByLayer
): Result<Unit, GenerationError> {
  const includeDomain: boolean = selectedFeaturesByLayer.domain.length > 0;
  const includeApi: boolean =
    selectedFeaturesByLayer.read_api.length > 0 || selectedFeaturesByLayer.write_api.length > 0;

  const rootExports: string[] = ["export * as dev from './dev';"];

  if (includeDomain) {
    rootExports.push("export * as common from './common';");
    rootExports.push("export * as domain from './domain';");
  }

  if (includeApi) {
    rootExports.push("export * as api from './api';");
  }

  return writeUtf8File(join(generatedRoot, 'index.ts'), `${rootExports.join('\n')}\n`);
}

export function writeIndexFiles(
  generatedRoot: string,
  selectedFeaturesByLayer: SelectedFeaturesByLayer
): Result<Unit, GenerationError> {
  const canonicalIndexResult: Result<Unit, GenerationError> =
    generateRecursiveCanonicalIndexes(generatedRoot);
  if (canonicalIndexResult.isErr) {
    return canonicalIndexResult;
  }

  const curatedAliasResult: Result<Unit, GenerationError> = writeCuratedAliasIndexes(
    generatedRoot,
    selectedFeaturesByLayer
  );
  if (curatedAliasResult.isErr) {
    return curatedAliasResult;
  }

  return writeRootIndex(generatedRoot, selectedFeaturesByLayer);
}
