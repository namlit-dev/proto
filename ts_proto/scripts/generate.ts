import type { Result } from 'true-myth/result';
import { describeGenerationError, type GenerationError } from './generator/errors.js';
import { resolveGenerationPaths } from './generator/paths.js';
import { runGeneration, type GenerationRuntimeInput } from './generator/pipeline.js';
import type { GenerationSummary } from './generator/models.js';

async function main(): Promise<void> {
  const runtimeInput: GenerationRuntimeInput = {
    paths: resolveGenerationPaths(import.meta.url)
  };

  const result: Result<GenerationSummary, GenerationError> = await runGeneration(runtimeInput);

  if (result.isErr) {
    console.error(describeGenerationError(result.error));
    process.exitCode = 1;
    return;
  }

  console.log(
    `Generated ${result.value.expandedProtoFileCount} proto files for ${result.value.selectedFeatureCount} selected features into ${result.value.generatedRoot}`
  );
}

main();
