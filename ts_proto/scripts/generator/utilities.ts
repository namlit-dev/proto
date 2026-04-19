import { relative } from 'node:path';
import type { SelectedFeaturesByLayer } from './models.js';
import { SUPPORTED_LAYERS } from './models.js';

export function toPosixPath(pathValue: string): string {
  return pathValue.split('\\').join('/');
}

export function toPosixRelativePath(rootPath: string, absolutePath: string): string {
  const relativePath: string = relative(rootPath, absolutePath);
  return toPosixPath(relativePath);
}

export function toSafeIdentifier(segment: string): string {
  let identifier: string = segment.replace(/[^A-Za-z0-9_]/g, '_');

  if (identifier.length === 0) {
    return '_';
  }

  if (!/^[A-Za-z_]/.test(identifier)) {
    identifier = `_${identifier}`;
  }

  return identifier;
}

export function collectSelectedFeatureNames(selectedFeaturesByLayer: SelectedFeaturesByLayer): readonly string[] {
  const names: Set<string> = new Set<string>();

  for (const layer of SUPPORTED_LAYERS) {
    for (const featureName of selectedFeaturesByLayer[layer]) {
      names.add(featureName);
    }
  }

  return [...names].sort((left: string, right: string): number => left.localeCompare(right));
}
