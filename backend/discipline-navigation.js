import { labManifest } from './lab-manifest.js';
const active = new Set(labManifest.flatMap((lab) => lab.groups));
import { disciplineDefinitions } from './disciplines.js';
const groups = new Map();
for (const { id, group } of disciplineDefinitions) {
  if (!active.has(id)) continue;
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push(id);
}
export const navigationGroups = [...groups];
export const disciplineIcon = (id) => {
  const path =
    disciplineDefinitions.find((d) => d.id === id)?.path ??
    'M4 4h6v6H4Zm10 0h6v6h-6ZM4 14h6v6H4Zm10 0h6v6h-6Z';
  return `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
};
