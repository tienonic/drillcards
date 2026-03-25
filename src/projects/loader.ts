import type { ProjectData, Project, ProjectConfig, Section } from './types.ts';
import { getGlobalFSRSDefaults } from '../core/store/config.ts';

function buildDefaultConfig(): ProjectConfig {
  const fsrs = getGlobalFSRSDefaults();
  return {
    desired_retention: fsrs.desired_retention,
    new_per_session: fsrs.new_per_session,
    leech_threshold: fsrs.leech_threshold,
    max_interval: fsrs.max_interval,
    imageSearchSuffix: '',
  };
}

export function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildCardIds(section: Section): void {
  section.cardIds = [];
  section.flashCardIds = [];

  if (section.type === 'mc-quiz' && section.questions) {
    section.questions.forEach((_, i) => {
      section.cardIds.push(`${section.id}-${i}`);
    });
  } else if (section.type === 'passage-quiz' && section.scenarios) {
    section.scenarios.forEach((s, si) => {
      s.questions.forEach((_, qi) => {
        section.cardIds.push(`${section.id}-${si}-${qi}`);
      });
    });
  }

  if (section.flashcards) {
    section.flashcards.forEach((_, i) => {
      section.flashCardIds.push(`${section.id}-flash-${i}`);
    });
  }
}

export function loadProject(data: ProjectData): Project {
  const config: ProjectConfig = { ...buildDefaultConfig(), ...data.config };
  const sections: Section[] = data.sections.map(s => {
    const section: Section = { ...s, cardIds: [], flashCardIds: [] };
    buildCardIds(section);
    return section;
  });

  return {
    name: data.name,
    slug: slugify(data.name),
    version: data.version ?? 1,
    config,
    sections,
    glossary: data.glossary ?? [],
  };
}

export function validateProject(data: unknown): string[] {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    errors.push('Invalid project data');
    return errors;
  }

  const d = data as Record<string, unknown>;
  if (!d.name || typeof d.name !== 'string') errors.push('Missing or invalid project name');
  else if (!slugify(d.name)) errors.push('Project name must contain at least one alphanumeric character');
  if (!Array.isArray(d.sections) || d.sections.length === 0) {
    errors.push('No sections defined');
  } else {
    const VALID_TYPES: Section['type'][] = ['mc-quiz', 'passage-quiz', 'math-gen'];
    const seenIds = new Set<string>();
    for (const s of d.sections as Record<string, unknown>[]) {
      if (!s.id) errors.push('Section missing id');
      else if (seenIds.has(s.id as string)) errors.push(`Duplicate section id: "${s.id}"`);
      else seenIds.add(s.id as string);
      if (!s.name) errors.push('Section missing name');
      if (!s.type) {
        errors.push(`Section "${s.name || s.id}" missing type`);
      } else if (!VALID_TYPES.includes(s.type as Section['type'])) {
        errors.push(`Section "${s.name || s.id}" has invalid type: "${s.type}"`);
      }
      if (s.type === 'mc-quiz' && (!Array.isArray(s.questions) || s.questions.length === 0)) {
        errors.push(`Section "${s.name}" has no questions`);
      } else if (s.type === 'mc-quiz' && (s.questions as Record<string, unknown>[]).some(q => typeof q.q !== 'string' || typeof q.correct !== 'string' || !Array.isArray(q.wrong))) {
        errors.push(`Section "${s.name}" has a question missing "q" (string), "correct" (string), or "wrong" (array)`);
      }
      if (s.type === 'passage-quiz' && (!Array.isArray(s.scenarios) || s.scenarios.length === 0)) {
        errors.push(`Section "${s.name}" has no scenarios`);
      } else if (s.type === 'passage-quiz' && (s.scenarios as Record<string, unknown>[]).some(sc => typeof sc.passage !== 'string' || !Array.isArray(sc.questions) || (sc.questions as unknown[]).length === 0)) {
        errors.push(`Section "${s.name}" has a scenario missing "passage" (string) or "questions" array`);
      } else if (s.type === 'passage-quiz' && (s.scenarios as Record<string, unknown>[]).some(sc => (sc.questions as Record<string, unknown>[]).some(q => typeof q.q !== 'string' || typeof q.correct !== 'string' || !Array.isArray(q.wrong)))) {
        errors.push(`Section "${s.name}" has a scenario question missing "q" (string), "correct" (string), or "wrong" (array)`);
      }
      // generators is optional for math-gen — defaults to all categories if omitted
    }
  }

  return errors;
}
