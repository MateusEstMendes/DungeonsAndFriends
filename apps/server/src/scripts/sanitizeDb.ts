import { openDatabase } from '../db/index.js';
import { sanitizeDatabase } from '../db/sanitize.js';

let database: ReturnType<typeof openDatabase> | undefined;
try {
  database = openDatabase(undefined, { seed: false });
  console.log(JSON.stringify(sanitizeDatabase(database), null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha na sanitização do SQLite.');
  process.exitCode = 1;
} finally {
  database?.close();
}
