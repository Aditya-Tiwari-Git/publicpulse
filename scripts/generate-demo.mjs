import { writeFile } from "node:fs/promises";
import { generateDemo } from "../src/lib/demo.ts";
if (process.env.NODE_ENV === "production")
  throw Error("Synthetic generation is development-only.");
const count = Number(process.argv[2] || 864);
if (!Number.isInteger(count) || count < 1 || count > 100000)
  throw Error("Use a count from 1 to 100000.");
const data = generateDemo(count, 2026);
await writeFile("demo-data.json", JSON.stringify(data, null, 2));
console.log(
  `Generated ${count} explicitly synthetic interviews with fixed random seed 2026 in demo-data.json. No database was modified.`,
);
