import type { ProjectData, RegistryEntry } from './types.ts';
import { slugify } from './loader.ts';

const isSingleDeckMode = import.meta.env.VITE_STUDY_SINGLE_DECK === '1';

export function selectGeneratedProject(modules: Record<string, ProjectData>): ProjectData | undefined {
  return modules['./generated/active-project.json'] ?? Object.values(modules)[0];
}

export function buildProjectRegistry(generatedProject: ProjectData | undefined, singleDeckMode: boolean): RegistryEntry[] {
  if (singleDeckMode) return generatedProject ? [buildGeneratedEntry(generatedProject)] : [];

  return [
    buildExampleEntry(),
  ];
}

function buildGeneratedEntry(project: ProjectData): RegistryEntry {
  return {
    name: project.name,
    slug: slugify(project.name),
    folder: 'generated',
    loader: () => Promise.resolve(project),
  };
}

function buildGeneratedFileRegistry(): RegistryEntry[] {
  const loaders = import.meta.glob<ProjectData>('./generated/*.json', { import: 'default', exhaustive: true });
  const loader = loaders['./generated/active-project.json'] ?? Object.values(loaders)[0];
  if (!loader) return [];
  return [{
    name: 'Generated Deck',
    slug: 'generated-deck',
    folder: 'generated',
    loader,
  }];
}

function buildExampleEntry(): RegistryEntry {
  return {
    name: 'Example Art History Drill',
    slug: slugify('Example Art History Drill'),
    folder: '',
    loader: async () => {
      const { buildExampleArtHistoryProject } = await import('./example-art-history.ts');
      return buildExampleArtHistoryProject();
    },
  };
}

export const projectRegistry: RegistryEntry[] = isSingleDeckMode
  ? buildGeneratedFileRegistry()
  : [buildExampleEntry()];
