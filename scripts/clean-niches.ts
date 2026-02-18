import { db } from '../packages/core/src/db/client.js';

await db.query("DELETE FROM niches WHERE id IN ('test-niche', 'test-niche-2')");
const niches = await db.query('SELECT id, display_name FROM niches');
console.log('Niches:', niches.map(n => n.display_name).join(', '));
