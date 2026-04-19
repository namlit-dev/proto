import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GenerationPaths } from './models.js';

export function resolveGenerationPaths(scriptImportMetaUrl: string): GenerationPaths {
  const scriptDirectory: string = dirname(fileURLToPath(scriptImportMetaUrl));
  const tsProtoRoot: string = resolve(scriptDirectory, '..');
  const protoRoot: string = resolve(tsProtoRoot, '..', 'proto');
  const generatedRoot: string = join(tsProtoRoot, 'generated');

  return {
    tsProtoRoot,
    protoRoot,
    generatedRoot,
    featuresManifestPath: join(protoRoot, 'features.yaml'),
    tsFeatureSelectionPath: join(tsProtoRoot, 'features.yaml')
  };
}
