export interface Question {
  q: string;
  correct: string;
  wrong: string[];
  imageName?: string;
  cropName?: string;
  explanation?: string;
}

export interface Scenario {
  passage: string;
  source?: string;
  questions: Question[];
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface Section {
  id: string;
  name: string;
  type: 'mc-quiz' | 'passage-quiz' | 'math-gen';
  questions?: Question[];
  scenarios?: Scenario[];
  generators?: string[];
  hasFlashcards?: boolean;
  hasImages?: boolean;
  flashcards?: Flashcard[];
  tips?: string[];
  instruction?: string;
  cardIds: string[];
  flashCardIds: string[];
}

export interface ProjectConfig {
  desired_retention: number;
  new_per_session: number;
  leech_threshold: number;
  max_interval: number;
  imageSearchSuffix: string;
}

export interface ProjectData {
  name: string;
  version?: number;
  config?: Partial<ProjectConfig>;
  sections: Omit<Section, 'cardIds' | 'flashCardIds'>[];
  glossary?: { term: string; def: string; hasImage?: boolean }[];
}

export interface Project {
  name: string;
  slug: string;
  version: number;
  config: ProjectConfig;
  sections: Section[];
  glossary: { term: string; def: string; hasImage?: boolean }[];
  sourceFolder?: string;
}

export interface RegistryEntry {
  name: string;
  slug: string;
  folder: string;
  loader: () => Promise<ProjectData>;
}
