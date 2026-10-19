#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function parseCsv(text) {
  const rows = []; let row = [], value = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted && c === '"' && text[i + 1] === '"') { value += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) { row.push(value); value = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) { if (c === "\r" && text[i + 1] === "\n") i++; row.push(value); if (row.some(x => x.trim())) rows.push(row); row = []; value = ""; }
    else value += c;
  }
  row.push(value); if (row.some(x => x.trim())) rows.push(row);
  const [head, ...body] = rows; if (!head) return [];
  return body.map(cols => Object.fromEntries(head.map((h, i) => [h.trim(), (cols[i] || "").trim()])));
}
const args = process.argv.slice(2), inputPath = args.find(a => !a.startsWith("--"));
if (!inputPath) throw Error("Usage: node --env-file=.env scripts/import-geography.mjs <file.csv|file.json> --source=... --source-url=... --source-date=YYYY-MM-DD [--expect=Delhi,Rajasthan,Uttar Pradesh] [--dry-run] [--report=report.json]");
const flag = (name) => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ext = path.extname(inputPath).toLowerCase();
let doc;
if (ext === ".json") doc = JSON.parse(await readFile(inputPath, "utf8"));
else if (ext === ".csv") doc = { records: parseCsv(await readFile(inputPath, "utf8")) };
else throw Error("Input must be CSV or JSON.");
const source = doc.source || flag("source"), source_url = doc.source_url || flag("source-url"), source_date = doc.source_date || flag("source-date");
const expected = doc.expected_coverage || { states: (flag("expect") || "Delhi NCT,Rajasthan,Uttar Pradesh").split(",").map(x => x.trim()) };
const records = Array.isArray(doc) ? doc : doc.records;
const output = flag("report") || `${inputPath}.report.json`;
if (!source || !source_url || !/^\d{4}-\d{2}-\d{2}$/.test(source_date || "") || new Date(`${source_date}T00:00:00Z`).toISOString().slice(0, 10) !== source_date) throw Error("A traceable source, valid source URL, and source date (YYYY-MM-DD) are required.");
try { if (!/^https:\/\//i.test(new URL(source_url).href)) throw Error(); } catch { throw Error("Use an official HTTPS source URL."); }
if (!Array.isArray(records)) throw Error("JSON input must include a records array.");
const validLevels = new Set(["country", "state", "district", "constituency", "locality", "ward"]);
const rejected = [], duplicates = [], accepted = [], seen = new Set();
for (const [index, raw] of records.entries()) {
  const r = { ...raw, name: String(raw.name || "").trim(), level: String(raw.level || "").trim().toLowerCase(), code: String(raw.code || "").trim() || null, parent_id: String(raw.parent_id || "").trim() || null, parent_code: String(raw.parent_code || "").trim() || null, id: String(raw.id || "").trim() || null };
  if (!r.name || !validLevels.has(r.level)) { rejected.push({ row: index + 2, reason: "Name or level is missing/invalid." }); continue; }
  if (!["country", "state"].includes(r.level) && !r.parent_id && !r.parent_code) { rejected.push({ row: index + 2, name: r.name, reason: "A parent ID or parent code is required." }); continue; }
  const natural = `${r.level}|${r.code || r.name.toLocaleLowerCase("en-IN")}|${r.parent_code || r.parent_id || ""}`;
  if (seen.has(natural)) { duplicates.push({ row: index + 2, name: r.name, reason: "Duplicate within source file." }); continue; }
  seen.add(natural); accepted.push(r);
}
const report = { source, source_url, source_date, generated_at: new Date().toISOString(), expected_coverage: expected, records_validated: accepted.length, records_imported: 0, records_rejected: rejected.length, rejected, duplicates, missing_coverage: { states: [], districts: [], constituencies: [], not_assessed: [] }, dry_run: args.includes("--dry-run") };
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!args.includes("--dry-run")) {
  if (!url || !key) throw Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in a trusted terminal; do not put them in Vite or commit them.");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: existing, error } = await db.from("geographies").select("id,name,level,parent_id,code"); if (error) throw error;
  const all = [...existing];
  const byCode = new Map(all.filter(g => g.code).map(g => [`${g.level}|${g.code}`, g]));
  const pending = [...accepted];
  for (let pass = 0; pending.length && pass <= accepted.length; pass++) {
    let changed = false;
    for (let i = pending.length - 1; i >= 0; i--) {
      const r = pending[i];
      if (!r.parent_id && r.parent_code) r.parent_id = byCode.get(`state|${r.parent_code}`)?.id || byCode.get(`district|${r.parent_code}`)?.id || null;
      const parent = r.parent_id ? all.find(g => g.id === r.parent_id) : null;
      const naturalMatch = all.find(g => g.level === r.level && g.name.toLocaleLowerCase("en-IN") === r.name.toLocaleLowerCase("en-IN") && (g.parent_id || null) === (r.parent_id || null));
      const codeMatch = r.code ? byCode.get(`${r.level}|${r.code}`) : null;
      if (codeMatch && r.parent_id && (codeMatch.parent_id || null) !== r.parent_id) { rejected.push({ name: r.name, reason: "Existing geography code belongs to a different parent." }); pending.splice(i, 1); changed = true; continue; }
      if (r.level !== "country" && r.level !== "state" && !parent) continue;
      if (parent && ["country", "state", "district", "constituency", "locality", "ward"].indexOf(parent.level) >= ["country", "state", "district", "constituency", "locality", "ward"].indexOf(r.level)) { rejected.push({ name: r.name, reason: "Parent hierarchy is invalid." }); pending.splice(i, 1); changed = true; continue; }
      const id = r.id || codeMatch?.id || naturalMatch?.id || crypto.randomUUID();
      if (r.id && all.some(g => g.id === id && (g.name !== r.name || g.level !== r.level))) { rejected.push({ name: r.name, reason: "Supplied ID conflicts with an existing geography." }); pending.splice(i, 1); changed = true; continue; }
      const row = { id, name: r.name, level: r.level, parent_id: r.parent_id, code: r.code };
      const { error: writeError } = await db.from("geographies").upsert(row, { onConflict: "id" });
      if (writeError) { rejected.push({ name: r.name, reason: writeError.message }); pending.splice(i, 1); changed = true; continue; }
      if (naturalMatch || codeMatch) duplicates.push({ name: r.name, reason: "Matched existing geography; existing ID preserved." });
      else report.records_imported++;
      all.push(row); if (r.code) byCode.set(`${r.level}|${r.code}`, row);
      pending.splice(i, 1); changed = true;
    }
    if (!changed) break;
  }
  for (const r of pending) rejected.push({ name: r.name, reason: "Parent reference is missing or unresolved." });
  for (const level of ["states", "districts", "constituencies"]) {
    const expectedRows = expected[level];
    if (!Array.isArray(expectedRows)) { report.missing_coverage.not_assessed.push(level); continue; }
    const actualLevel = level.slice(0, -1);
    const present = new Set(all.filter(g => g.level === actualLevel).map(g => g.name.toLocaleLowerCase("en-IN")));
    report.missing_coverage[level] = expectedRows.filter(name => !present.has(String(name).toLocaleLowerCase("en-IN")));
  }
  report.records_rejected = rejected.length; report.rejected = rejected;
  report.duplicates = duplicates;
  const { error: auditError } = await db.from("audit_logs").insert({ actor: "Geography import utility", action: `Geography import from ${source} (${source_date}): ${report.records_imported} imported, ${report.records_rejected} rejected, ${report.duplicates.length} duplicates; report ${path.basename(output)}` });
  if (auditError) report.audit_warning = auditError.message;
} else {
  report.records_rejected = rejected.length;
  report.missing_coverage.states = Array.isArray(expected.states) ? expected.states : [];
  report.missing_coverage.districts = Array.isArray(expected.districts) ? expected.districts : [];
  report.missing_coverage.constituencies = Array.isArray(expected.constituencies) ? expected.constituencies : [];
  report.missing_coverage.not_assessed = ["database duplicates", "live coverage"];
  report.note = "Dry run validates source rows only. Database duplicates and coverage require a live import.";
}
await writeFile(output, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify(report, null, 2));
