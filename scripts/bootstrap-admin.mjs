import { createClient } from "@supabase/supabase-js";
import { defaultSurvey } from "../src/lib/template.ts";
import { publishSurvey } from "../src/lib/engine.ts";
const url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw Error(
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the shell (server-side only).",
  );
const host = new URL(url).hostname,
  local = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host);
const username = (
    process.env.BOOTSTRAP_USERNAME || (local ? "admin" : "")
  ).toLowerCase(),
  password = process.env.BOOTSTRAP_PASSWORD || (local ? "Admin@12345" : "");
if (!/^[a-z0-9_.-]{3,50}$/.test(username))
  throw Error("Provide a valid BOOTSTRAP_USERNAME.");
if (!local && (password.length < 12 || password === "Admin@12345"))
  throw Error(
    "Provide a unique production password of at least 12 characters. The development password is prohibited.",
  );
const db = createClient(url, key, { auth: { persistSession: false } });
const existing = await db.from("profiles").select("id").eq("role", "admin");
if (existing.error) throw existing.error;
if (existing.data.length)
  throw Error(
    "An administrator already exists. Bootstrap is only permitted for the first admin.",
  );
const email = `${crypto.randomUUID()}@auth.publicpulse.invalid`;
const user = await db.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (user.error) throw user.error;
const uid = user.data.user.id;
try {
  const profile = await db
    .from("profiles")
    .insert({
      id: uid,
      username,
      name: process.env.BOOTSTRAP_NAME || "Workspace Administrator",
      role: "admin",
      active: true,
      must_change_password: true,
    });
  if (profile.error) throw profile.error;
  const map = await db.rpc("auth_mapping_set", {
    login_name: username,
    uid,
    auth_email: email,
  });
  if (map.error) throw map.error;
} catch (e) {
  await db.auth.admin.deleteUser(uid);
  throw e;
}
const survey = publishSurvey(defaultSurvey());
const seeded = await db.rpc("save_survey", { doc: survey });
if (seeded.error) throw seeded.error;
const rules = [
  { category: "Roads", keywords: ["road", "pothole", "सड़क", "गड्ढ"] },
  { category: "Water", keywords: ["water", "पानी", "जल"] },
  {
    category: "Employment",
    keywords: ["job", "employment", "रोज़गार", "नौकरी"],
  },
];
const classifier = await db.from("classification_rules").insert(rules);
if (classifier.error) throw classifier.error;
await db
  .from("audit_logs")
  .insert({
    actor: uid,
    action: `First administrator provisioned (${local ? "local development" : "production"}); template published`,
  });
console.log(
  `Provisioned ${local ? "local development" : "production"} administrator: ${username}. Password change is required on first login. No password or key was written to disk.`,
);
