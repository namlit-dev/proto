import type { Maybe } from 'true-myth/maybe';

export type ManifestLayer = 'domain' | 'read_api' | 'write_api';

export const SUPPORTED_LAYERS: readonly ManifestLayer[] = ['domain', 'read_api', 'write_api'];

export interface ProtoFeatureEntry {
  readonly domain: Maybe<readonly string[]>;
  readonly read_api: Maybe<readonly string[]>;
  readonly write_api: Maybe<readonly string[]>;
}

export interface ProtoFeaturesManifest {
  readonly version: string;
  readonly features: Readonly<Record<string, ProtoFeatureEntry>>;
}

export interface TsFeatureLayerSelection {
  readonly domain: boolean;
  readonly read_api: boolean;
  readonly write_api: boolean;
}

export interface TsFeatureSelection {
  readonly version: string;
  readonly features: Readonly<Record<string, TsFeatureLayerSelection>>;
}

export interface SelectedFeaturesByLayer {
  readonly domain: readonly string[];
  readonly read_api: readonly string[];
  readonly write_api: readonly string[];
}

export interface GenerationPaths {
  readonly tsProtoRoot: string;
  readonly protoRoot: string;
  readonly generatedRoot: string;
  readonly featuresManifestPath: string;
  readonly tsFeatureSelectionPath: string;
}

export interface GenerationSummary {
  readonly expandedProtoFileCount: number;
  readonly selectedFeatureCount: number;
  readonly generatedRoot: string;
}

export interface PreparedGeneration {
  readonly manifest: ProtoFeaturesManifest;
  readonly selection: TsFeatureSelection;
  readonly selectedFeaturesByLayer: SelectedFeaturesByLayer;
  readonly selectedProtoPaths: ReadonlySet<string>;
  readonly expandedProtoPaths: ReadonlySet<string>;
}
