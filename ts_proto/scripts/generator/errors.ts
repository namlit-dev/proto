import type { Result } from 'true-myth/result';
import { err, ok } from 'true-myth/result';

export interface ValidationIssue {
  readonly sourcePath: string;
  readonly fieldPath: string;
  readonly message: string;
}

export interface ValidationGenerationError {
  readonly code: 'VALIDATION';
  readonly message: string;
  readonly issues: readonly ValidationIssue[];
}

export interface IoGenerationError {
  readonly code: 'IO';
  readonly message: string;
  readonly operation: string;
  readonly targetPath: string;
  readonly cause: string;
}

export interface ProcessGenerationError {
  readonly code: 'PROCESS';
  readonly message: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly cause: string;
}

export interface YamlGenerationError {
  readonly code: 'YAML_PARSE';
  readonly message: string;
  readonly sourcePath: string;
  readonly cause: string;
}

export type GenerationError =
  | ValidationGenerationError
  | IoGenerationError
  | ProcessGenerationError
  | YamlGenerationError;

function compareValidationIssues(left: ValidationIssue, right: ValidationIssue): number {
  const sourcePathCompare: number = left.sourcePath.localeCompare(right.sourcePath);
  if (sourcePathCompare !== 0) {
    return sourcePathCompare;
  }

  const fieldPathCompare: number = left.fieldPath.localeCompare(right.fieldPath);
  if (fieldPathCompare !== 0) {
    return fieldPathCompare;
  }

  return left.message.localeCompare(right.message);
}

export function normalizeValidationIssues(
  issues: readonly ValidationIssue[]
): readonly ValidationIssue[] {
  const sortedIssues: ValidationIssue[] = [...issues].sort(compareValidationIssues);
  return sortedIssues;
}

export function createValidationError(
  message: string,
  issues: readonly ValidationIssue[]
): ValidationGenerationError {
  return {
    code: 'VALIDATION',
    message,
    issues: normalizeValidationIssues(issues)
  };
}

export function validationResultFromIssues<TValue>(
  value: TValue,
  issues: readonly ValidationIssue[],
  message: string
): Result<TValue, GenerationError> {
  return issues.length === 0 ? ok(value) : err(createValidationError(message, issues));
}

export function mergeValidationIssues(
  ...issueGroups: ReadonlyArray<readonly ValidationIssue[]>
): readonly ValidationIssue[] {
  const merged: ValidationIssue[] = [];

  for (const group of issueGroups) {
    for (const issue of group) {
      merged.push(issue);
    }
  }

  return normalizeValidationIssues(merged);
}

export function describeGenerationError(error: GenerationError): string {
  if (error.code === 'VALIDATION') {
    const issueLines: string[] = error.issues.map((issue: ValidationIssue): string => {
      return `- ${issue.sourcePath}:${issue.fieldPath}: ${issue.message}`;
    });

    return `${error.message}\n${issueLines.join('\n')}`;
  }

  if (error.code === 'IO') {
    return `${error.message} (operation=${error.operation}, path=${error.targetPath}, cause=${error.cause})`;
  }

  if (error.code === 'YAML_PARSE') {
    return `${error.message} (path=${error.sourcePath}, cause=${error.cause})`;
  }

  return `${error.message} (command=${error.command}, cwd=${error.cwd}, cause=${error.cause})`;
}
