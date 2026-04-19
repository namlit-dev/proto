import { spawn } from 'node:child_process';
import type { GenerationError, ProcessGenerationError } from '../errors.js';
import type { Task } from 'true-myth/task';
import { fromPromise } from 'true-myth/task';
import Unit from 'true-myth/unit';

interface ProcessFailure {
  readonly cause: string;
}

function normalizeBoundaryFailure(boundaryFailure: unknown): ProcessFailure {
  if (boundaryFailure instanceof Error) {
    return {
      cause: boundaryFailure.message
    };
  }

  return {
    cause: 'Unknown process boundary failure.'
  };
}

function createProcessError(
  message: string,
  command: string,
  args: readonly string[],
  cwd: string,
  cause: string
): ProcessGenerationError {
  return {
    code: 'PROCESS',
    message,
    command,
    args,
    cwd,
    cause
  };
}

function spawnCommand(command: string, args: readonly string[], cwd: string): Promise<Unit> {
  return new Promise<Unit>((resolve, reject): void => {
    const childProcess = spawn(command, [...args], {
      cwd,
      stdio: 'inherit'
    });

    childProcess.once('error', (boundaryError: Error): void => {
      reject(boundaryError);
    });

    childProcess.once('exit', (exitCode: number | null, signal: NodeJS.Signals | null): void => {
      if (exitCode === 0) {
        resolve(Unit);
        return;
      }

      const normalizedExitCode: number = typeof exitCode === 'number' ? exitCode : -1;
      const normalizedSignal: string = typeof signal === 'string' ? signal : 'none';
      reject(
        new Error(
          `Process exited with code ${normalizedExitCode} and signal ${normalizedSignal}.`
        )
      );
    });
  });
}

export function runCommand(command: string, args: readonly string[], cwd: string): Task<Unit, GenerationError> {
  const promise: Promise<Unit> = spawnCommand(command, args, cwd);

  return fromPromise(promise, (boundaryFailure: unknown): GenerationError => {
    const normalizedBoundaryFailure: ProcessFailure = normalizeBoundaryFailure(boundaryFailure);
    return createProcessError(
      'Failed to run external process.',
      command,
      args,
      cwd,
      normalizedBoundaryFailure.cause
    );
  });
}
