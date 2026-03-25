import type { RegistryEntry, ProjectData } from './types.ts';
import { slugify } from './loader.ts';

// Auto-discover JSON project files from /projects/ at repo root
const jsonModules = import.meta.glob('/projects/*.json', { eager: true }) as Record<
  string,
  { default: ProjectData }
>;

const autoEntries: RegistryEntry[] = Object.entries(jsonModules).map(([, mod]) => {
  const data = mod.default;
  return {
    name: data.name,
    slug: slugify(data.name),
    folder: '',
    loader: () => Promise.resolve(data),
  };
});

export const projectRegistry: RegistryEntry[] = [
  {
    name: 'Example Botany Project',
    slug: 'example-botany-project',
    folder: 'ag-inspector',
    loader: () => import('./ag-inspector/builder.ts').then(m => m.buildDefaultProject()),
  },
  ...autoEntries,
];
