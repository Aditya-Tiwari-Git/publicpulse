import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

describe("geography import utility", () => {
  it("reports duplicate source rows and provenance without inventing coverage in dry-run mode", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "publicpulse-geo-"));
    try {
      const input = path.join(dir, "source.json"), report = path.join(dir, "report.json");
      writeFileSync(input, JSON.stringify({
        source: "Official reference", source_url: "https://example.gov", source_date: "2026-10-01",
        expected_coverage: { states: ["Delhi", "Rajasthan", "Uttar Pradesh"] },
        records: [
          { name: "Example state", level: "state", code: "IN-EX" },
          { name: "Example state", level: "state", code: "IN-EX" },
        ],
      }));
      const run = spawnSync(process.execPath, ["scripts/import-geography.mjs", input, "--dry-run", `--report=${report}`], { encoding: "utf8" });
      expect(run.status, run.stderr).toBe(0);
      const result = JSON.parse(readFileSync(report, "utf8"));
      expect(result).toMatchObject({ source: "Official reference", source_date: "2026-10-01", records_rejected: 0, missing_coverage: { states: ["Delhi", "Rajasthan", "Uttar Pradesh"] } });
      expect(result.duplicates).toHaveLength(1);
      expect(result.dry_run).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it("accepts CSV rows with provenance flags", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "publicpulse-geo-csv-"));
    try {
      const input = path.join(dir, "source.csv"), report = path.join(dir, "report.json");
      writeFileSync(input, "id,name,level,parent_id,parent_code,code\n,\"Example, North\",state,,,IN-EX\n");
      const run = spawnSync(process.execPath, ["scripts/import-geography.mjs", input, "--source=Official source", "--source-url=https://example.gov/geo", "--source-date=2026-10-01", "--dry-run", `--report=${report}`], { encoding: "utf8" });
      expect(run.status, run.stderr).toBe(0);
      const result = JSON.parse(readFileSync(report, "utf8"));
      expect(result.records_validated).toBe(1);
      expect(result.rejected).toHaveLength(0);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
