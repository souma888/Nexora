import { labManifest } from './lab-manifest.js';
import { disciplines } from './disciplines.js';
/** Serializable catalog view of the single executable manifest. */
export const catalog = labManifest.map(({ model: _model, ...meta }) => meta);
export const disciplineCounts = Object.fromEntries(
  Object.keys(disciplines).map((id) => [
    id,
    catalog.filter((lab) => lab.groups.includes(id)).length,
  ]),
);
if (new Set(catalog.map((lab) => lab.id)).size !== catalog.length)
  throw new Error('Duplicate lab ID in catalog.');
for (const lab of catalog)
  for (const group of lab.groups)
    if (!Object.hasOwn(disciplines, group)) throw new Error(`Unknown discipline ${group}.`);
