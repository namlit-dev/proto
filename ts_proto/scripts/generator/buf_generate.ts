import { join } from 'node:path';
import type { Task } from 'true-myth/task';
import Unit from 'true-myth/unit';
import type { GenerationError } from './errors.js';
import { runCommand } from './boundary/process.js';
import { toPosixPath } from './utilities.js';

export function buildBufPathArguments(protoPaths: ReadonlySet<string>): readonly string[] {
  const sortedProtoPaths: string[] = [...protoPaths.values()].sort(
    (left: string, right: string): number => left.localeCompare(right)
  );

  const pathArguments: string[] = [];

  for (const protoPath of sortedProtoPaths) {
    pathArguments.push('--path');
    pathArguments.push(toPosixPath(join('..', 'proto', protoPath)));
  }

  return pathArguments;
}

export function runBufGenerate(tsProtoRoot: string, protoPaths: ReadonlySet<string>): Task<Unit, GenerationError> {
  const commandArguments: readonly string[] = [
    'generate',
    '--template',
    'buf.gen.yaml',
    '../proto',
    ...buildBufPathArguments(protoPaths)
  ];

  return runCommand('buf', commandArguments, tsProtoRoot);
}
