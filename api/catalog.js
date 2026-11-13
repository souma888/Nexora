import { catalog, disciplineCounts } from '../backend/catalog.js';
import { disciplines } from '../backend/disciplines.js';
export const GET = () => Response.json({ labs: catalog, disciplines, counts: disciplineCounts });
