import type { RegistryEntry } from './types.ts';
import { slugify } from './loader.ts';
import { buildExampleArtHistoryProject } from './example-art-history.ts';

const defaultProject = buildExampleArtHistoryProject();

export const projectRegistry: RegistryEntry[] = [
  {
    name: defaultProject.name,
    slug: slugify(defaultProject.name),
    folder: '',
    loader: () => Promise.resolve(defaultProject),
  },
];
