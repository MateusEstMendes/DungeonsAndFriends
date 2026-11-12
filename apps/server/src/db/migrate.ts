import { openDatabase } from "./index.js";
const database = openDatabase();
console.log("Migrações aplicadas. SQLite:", database.sqlite.name);
database.close();
