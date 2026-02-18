import { db } from './packages/core/src/db/client.js';

const tables = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
console.log('Tables:', tables.map(t => t.table_name).join(', '));

const cities = await db.query('SELECT count(*) as count FROM cities');
console.log('Cities:', cities[0].count);

const niches = await db.query('SELECT id, display_name FROM niches');
console.log('Niches:', niches.map(n => n.display_name).join(', '));
