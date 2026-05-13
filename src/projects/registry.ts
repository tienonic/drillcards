import type { RegistryEntry, ProjectData } from './types.ts';
import { slugify } from './loader.ts';
import ahi001cExam2 from '../../projects/ahi001c-exam-2.json';

const defaultProject = ahi001cExam2 as ProjectData;

export const projectRegistry: RegistryEntry[] = [
  {
    name: defaultProject.name,
    slug: slugify(defaultProject.name),
    folder: '',
    loader: () => Promise.resolve(defaultProject),
  },
];
