import { db } from './packages/core/src/db/client.ts';

const cities = await db.query('SELECT count(*) as count FROM cities');
const niches = await db.query('SELECT id, display_name FROM niches');
console.log('Cities:', cities[0].count);
console.log('Niches:', niches.map(n => n.display_name).join(', '));
