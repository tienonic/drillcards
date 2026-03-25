/**
 * Project registry — lists all available built-in projects.
 *
 * Each entry: { name, slug, loader }
 *   loader() returns a Promise that resolves to the project data object.
 */

export const projectRegistry = [
  {
    name: 'Sac County Ag Inspector',
    slug: 'sac-county-ag-inspector',
    folder: 'ag-inspector',
    loader: () => import('./ag-inspector/builder.js').then(m => m.buildDefaultProject()),
  },
];
