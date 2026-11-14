import { openapi } from '../backend/openapi.js';
export const GET = () => Response.json(openapi);
