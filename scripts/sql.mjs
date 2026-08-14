/**
 * Прогон SQL-файлов в базу НищеMap.
 *   node scripts/sql.mjs supabase/12_something.sql        — выполнить файл
 *   node scripts/sql.mjs -q "select count(*) from ..."    — разовый запрос
 * Строка подключения лежит в ~/.nishemap-db (в репозиторий не попадает).
 */
import { Client } from "pg";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

const cs = readFileSync(homedir() + "/.nishemap-db", "utf8").trim();
const args = process.argv.slice(2);
if (!args.length) { console.error("укажи файл(ы) или -q \"запрос\""); process.exit(1); }

const c = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  if (args[0] === "-q") {
    const r = await c.query(args.slice(1).join(" "));
    console.log(JSON.stringify(r.rows, null, 1));
  } else {
    for (const f of args) {
      const sql = readFileSync(f, "utf8");
      await c.query(sql);
      console.log("✅", f);
    }
  }
} catch (e) {
  console.error("❌", e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
