import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  type Stats
} from 'node:fs';
import type { Maybe } from 'true-myth/maybe';
import { just, nothing } from 'true-myth/maybe';
import type { Result } from 'true-myth/result';
import { err, ok } from 'true-myth/result';
import Unit from 'true-myth/unit';
import type { GenerationError, IoGenerationError } from '../errors.js';

export interface PathStats {
  readonly isFile: boolean;
  readonly isDirectory: boolean;
}

interface NormalizedBoundaryError {
  readonly cause: string;
  readonly isNotFound: boolean;
}

function normalizeBoundaryError(boundaryError: unknown): NormalizedBoundaryError {
  if (boundaryError instanceof Error) {
    const nodeError: NodeJS.ErrnoException = boundaryError;
    const code: string = typeof nodeError.code === 'string' ? nodeError.code : '';

    return {
      cause: boundaryError.message,
      isNotFound: code === 'ENOENT'
    };
  }

  return {
    cause: 'Unknown boundary error.',
    isNotFound: false
  };
}

function createIoError(
  message: string,
  operation: string,
  targetPath: string,
  cause: string
): IoGenerationError {
  return {
    code: 'IO',
    message,
    operation,
    targetPath,
    cause
  };
}

function mapStats(stats: Stats): PathStats {
  return {
    isFile: stats.isFile(),
    isDirectory: stats.isDirectory()
  };
}

export function readUtf8File(path: string): Result<string, GenerationError> {
  try {
    const content: string = readFileSync(path, 'utf8');
    return ok(content);
  } catch (boundaryError: unknown) {
    const normalizedBoundaryError: NormalizedBoundaryError = normalizeBoundaryError(boundaryError);
    return err(createIoError('Failed to read UTF-8 file.', 'read_file', path, normalizedBoundaryError.cause));
  }
}

export function readDirectory(path: string): Result<readonly string[], GenerationError> {
  try {
    const entries: string[] = readdirSync(path);
    return ok(entries);
  } catch (boundaryError: unknown) {
    const normalizedBoundaryError: NormalizedBoundaryError = normalizeBoundaryError(boundaryError);
    return err(
      createIoError('Failed to read directory entries.', 'read_directory', path, normalizedBoundaryError.cause)
    );
  }
}

export function readDirectoryIfExists(path: string): Result<Maybe<readonly string[]>, GenerationError> {
  try {
    const entries: string[] = readdirSync(path);
    return ok(just(entries));
  } catch (boundaryError: unknown) {
    const normalizedBoundaryError: NormalizedBoundaryError = normalizeBoundaryError(boundaryError);
    if (normalizedBoundaryError.isNotFound) {
      return ok(nothing());
    }

    return err(
      createIoError('Failed to read directory entries.', 'read_directory_if_exists', path, normalizedBoundaryError.cause)
    );
  }
}

export function getPathStats(path: string): Result<PathStats, GenerationError> {
  try {
    const stats: Stats = statSync(path);
    return ok(mapStats(stats));
  } catch (boundaryError: unknown) {
    const normalizedBoundaryError: NormalizedBoundaryError = normalizeBoundaryError(boundaryError);
    return err(createIoError('Failed to read path stats.', 'stat_path', path, normalizedBoundaryError.cause));
  }
}

export function getPathStatsIfExists(path: string): Result<Maybe<PathStats>, GenerationError> {
  try {
    const stats: Stats = statSync(path);
    return ok(just(mapStats(stats)));
  } catch (boundaryError: unknown) {
    const normalizedBoundaryError: NormalizedBoundaryError = normalizeBoundaryError(boundaryError);
    if (normalizedBoundaryError.isNotFound) {
      return ok(nothing());
    }

    return err(
      createIoError(
        'Failed to read optional path stats.',
        'stat_path_if_exists',
        path,
        normalizedBoundaryError.cause
      )
    );
  }
}

export function cleanDirectory(path: string): Result<Unit, GenerationError> {
  try {
    rmSync(path, { recursive: true, force: true });
    mkdirSync(path, { recursive: true });
    return ok(Unit);
  } catch (boundaryError: unknown) {
    const normalizedBoundaryError: NormalizedBoundaryError = normalizeBoundaryError(boundaryError);
    return err(
      createIoError('Failed to clean output directory.', 'clean_directory', path, normalizedBoundaryError.cause)
    );
  }
}

export function ensureDirectory(path: string): Result<Unit, GenerationError> {
  try {
    mkdirSync(path, { recursive: true });
    return ok(Unit);
  } catch (boundaryError: unknown) {
    const normalizedBoundaryError: NormalizedBoundaryError = normalizeBoundaryError(boundaryError);
    return err(
      createIoError('Failed to create directory.', 'ensure_directory', path, normalizedBoundaryError.cause)
    );
  }
}

export function writeUtf8File(path: string, content: string): Result<Unit, GenerationError> {
  try {
    writeFileSync(path, content, 'utf8');
    return ok(Unit);
  } catch (boundaryError: unknown) {
    const normalizedBoundaryError: NormalizedBoundaryError = normalizeBoundaryError(boundaryError);
    return err(createIoError('Failed to write UTF-8 file.', 'write_file', path, normalizedBoundaryError.cause));
  }
}
