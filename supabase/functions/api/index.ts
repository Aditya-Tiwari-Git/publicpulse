import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { geographicReference } from "../../../src/lib/geography.ts";
import {
  validateGraph,
  visibleQuestions,
  validateAnswer,
} from "../../../src/lib/engine.ts";
import type {
  AppData,
  Profile,
  ResponseRecord,
  Survey,
  Geography,
  SurveyVersion,
} from "../../../src/types.ts";
const url = Deno.env.get("SUPABASE_URL")!,
  serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const allowed = (
  Deno.env.get("ALLOWED_ORIGINS") ||
  "http://localhost:5173,http://127.0.0.1:5173"
).split(",");
function result(body: unknown, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": allowed.includes(origin)
        ? origin
        : allowed[0],
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      Vary: "Origin",
    },
  });
}
function check<T extends { error: unknown }>(r: T): T {
  if (r.error) throw Error((r.error as { message: string }).message);
  return r;
}
async function audit(actor: string, action: string) {
  check(await db.from("audit_logs").insert({ actor, action }));
}
async function rate(key: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key),
  );
  const hash = Array.from(new Uint8Array(bytes))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  const r = check(await db.rpc("reserve_login", { attempt_key: hash }));
  if (!r.data) throw Error("Too many attempts. Try again in 15 minutes.");
}
async function principal(req: Request) {
  const bearer = req.headers.get("Authorization")?.replace(/^Bearer /i, "");
  if (!bearer) throw Error("Authentication required.");
  const auth = check(await db.auth.getUser(bearer));
  if (!auth.data.user) throw Error("Authentication required.");
  const r = check(
    await db.from("profiles").select("*").eq("id", auth.data.user.id).single(),
  );
  if (!r.data?.active)
    throw Error("Account inactive. Contact your administrator.");
  return r.data as Profile;
}
function requireAdmin(p: Profile) {
  if (p.role !== "admin" || p.must_change_password)
    throw Error("Administrator access required.");
}
async function readWorkspace(p: Profile): Promise<AppData> {
  const admin = p.role === "admin";
  const assign =
    check(
      await (admin
        ? db.from("survey_assignments").select("*")
        : db.from("survey_assignments").select("*").eq("surveyor_id", p.id)),
    ).data || [];
  const surveys =
    check(
      await (admin
        ? db.from("surveys").select("*")
        : db
            .from("surveys")
            .select("*")
            .in(
              "id",
              assign.map((a) => a.survey_id),
            )),
    ).data || [];
  const versions = surveys.length
    ? check(
        await db
          .from("survey_versions")
          .select("*")
          .in(
            "survey_id",
            surveys.map((s) => s.id),
          ),
      ).data || []
    : [];
  const responseQuery = admin
    ? db
        .from("responses")
        .select("*")
        .order("collected_at", { ascending: false })
    : db
        .from("responses")
        .select("*")
        .eq("surveyor_id", p.id)
        .order("collected_at", { ascending: false });
  // Fetch all result pages; PostgREST defaults to a 1000-row cap.
  const responses: ResponseRecord[] = [];
  for (let offset = 0; ; offset += 1000) {
    const page =
      check(await responseQuery.range(offset, offset + 999)).data || [];
    responses.push(...page.map((r) => ({ ...r, created_at: r.collected_at })));
    if (page.length < 1000) break;
  }
  const [profiles, geographies, configs, widgets, classifiers, logs, settings] =
    await Promise.all([
      admin
        ? db.from("profiles").select("*")
        : db.from("profiles").select("*").eq("id", p.id),
      db.from("geographies").select("*"),
      admin
        ? db.from("dashboard_configs").select("*")
        : Promise.resolve({ data: [], error: null }),
      admin
        ? db.from("dashboard_widgets").select("*").order("display_order")
        : Promise.resolve({ data: [], error: null }),
      admin
        ? db.from("classification_rules").select("*")
        : Promise.resolve({ data: [], error: null }),
      admin
        ? db
            .from("audit_logs")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(500)
        : Promise.resolve({ data: [], error: null }),
      db.from("settings").select("*").single(),
    ]);
  for (const r of [
    profiles,
    geographies,
    configs,
    widgets,
    classifiers,
    logs,
    settings,
  ])
    check(r);
  const config = settings.data!;
  return {
    surveys: surveys.map((s) => ({
      ...s.definition,
      id: s.id,
      status: s.status,
      version: s.version,
      published: versions
        .filter((v) => v.survey_id === s.id)
        .map((v) => v.definition),
    })) as Survey[],
    responses,
    profiles: profiles.data || [],
    geographies: geographies.data || [],
    assignments: assign,
    dashboards: (configs.data || []).map((c) => ({
      ...c,
      widgets: (widgets.data || [])
        .filter((w) => w.dashboard_id === c.id)
        .map((w) => w.definition),
    })),
    classifiers: classifiers.data || [],
    audit: logs.data || [],
    settings: {
      organization: config.organization,
      minSample: config.min_sample,
      incomeBands: config.income_bands,
    },
  };
}
function validateGeographies(all: Geography[]) {
  const levels = [
    "country",
    "state",
    "district",
    "constituency",
    "locality",
    "ward",
  ];
  if (new Set(all.map((g) => g.id)).size !== all.length)
    throw Error("Duplicate geography IDs.");
  for (const g of all) {
    z.string().uuid().parse(g.id);
    if (!g.name.trim() || !levels.includes(g.level))
      throw Error("Invalid geography.");
    if (g.parent_id) {
      const parent = all.find((p) => p.id === g.parent_id);
      if (!parent || levels.indexOf(parent.level) >= levels.indexOf(g.level))
        throw Error("Invalid geography hierarchy.");
    } else if (!["country", "state"].includes(g.level))
      throw Error("Geography parent required.");
  }
}
async function saveWorkspace(doc: AppData, p: Profile) {
  if (
    !Array.isArray(doc.surveys) ||
    doc.settings.minSample < 5 ||
    !Number.isInteger(doc.settings.minSample)
  )
    throw Error("Invalid workspace settings.");
  const stored =
    check(await db.from("surveys").select("id,version,status")).data || [];
  for (const survey of doc.surveys) {
    z.string().uuid().parse(survey.id);
    if (!survey.title.trim()) throw Error("Survey title required.");
    const existing = stored.find((s) => s.id === survey.id);
    const oldVersions =
      check(
        await db
          .from("survey_versions")
          .select("version,definition")
          .eq("survey_id", survey.id),
      ).data || [];
    const incoming = survey.published || [];
    for (const old of oldVersions)
      if (!incoming.some((v) => v.version === old.version))
        throw Error("Cannot remove historical versions.");
    const additions = incoming.filter(
      (v) => !oldVersions.some((old) => old.version === v.version),
    );
    if (additions.length > 1) throw Error("Publish one version at a time.");
    for (const v of additions) {
      if (v.version !== (existing?.version || 0) + 1)
        throw Error("Version conflict. Refresh before publishing.");
      const errors = validateGraph(v);
      if (errors.length) throw Error(errors.join("; "));
      if (!v.questions.some((q) => q.id === "consent" && q.required))
        throw Error(
          "A required consent question with stable ID consent is required.",
        );
    }
    if (
      survey.status === "published" &&
      !incoming.some((v) => v.version === survey.version)
    )
      throw Error("Published version missing.");
    if (survey.start && survey.end && survey.start > survey.end)
      throw Error("Invalid collection date range.");
  }
  validateGeographies(doc.geographies);
  // Survey snapshots and their normalized questions/options/rules commit atomically per survey.
  for (const s of doc.surveys) check(await db.rpc("save_survey", { doc: s }));
  const remaining = [...doc.geographies];
  const saved = new Set<string>();
  while (remaining.length) {
    const index = remaining.findIndex(
      (g) => !g.parent_id || saved.has(g.parent_id),
    );
    if (index < 0) throw Error("Geography cycle.");
    const g = remaining.splice(index, 1)[0];
    check(await db.from("geographies").upsert(g));
    saved.add(g.id);
  }
  const assignments = z
    .array(
      z.object({
        id: z.string().uuid(),
        survey_id: z.string().uuid(),
        surveyor_id: z.string().uuid(),
        quota: z.number().int().positive(),
        geography_id: z.string().uuid().optional().nullable(),
      }),
    )
    .parse(doc.assignments);
  const oldAssign =
    check(await db.from("survey_assignments").select("id")).data || [];
  const removed = oldAssign.filter(
    (a) => !assignments.some((n) => n.id === a.id),
  );
  if (removed.length)
    check(
      await db
        .from("survey_assignments")
        .delete()
        .in(
          "id",
          removed.map((a) => a.id),
        ),
    );
  if (assignments.length)
    check(await db.from("survey_assignments").upsert(assignments));
  for (const c of doc.dashboards) {
    z.string().uuid().parse(c.id);
    if (!c.title.trim()) throw Error("Dashboard title required.");
    check(
      await db
        .from("dashboard_configs")
        .upsert({ id: c.id, title: c.title, published: c.published }),
    );
    for (const w of c.widgets) {
      z.string().uuid().parse(w.id);
      if (
        !w.title ||
        !w.metric ||
        ![
          "kpi",
          "bar",
          "horizontal",
          "donut",
          "line",
          "stacked",
          "trend",
          "table",
          "severity",
          "geography",
          "heatmap",
        ].includes(w.type)
      )
        throw Error("Invalid dashboard widget.");
    }
    check(await db.from("dashboard_widgets").delete().eq("dashboard_id", c.id));
    if (c.widgets.length)
      check(
        await db.from("dashboard_widgets").insert(
          c.widgets.map((w, i) => ({
            id: w.id,
            dashboard_id: c.id,
            definition: w,
            display_order: i,
          })),
        ),
      );
  }
  for (const r of doc.classifiers) {
    z.string().uuid().parse(r.id);
    z.array(z.string().min(1)).parse(r.keywords);
  }
  const oldRules =
    check(await db.from("classification_rules").select("id")).data || [];
  const gone = oldRules.filter(
    (r) => !doc.classifiers.some((c) => c.id === r.id),
  );
  if (gone.length)
    check(
      await db
        .from("classification_rules")
        .delete()
        .in(
          "id",
          gone.map((r) => r.id),
        ),
    );
  if (doc.classifiers.length)
    check(await db.from("classification_rules").upsert(doc.classifiers));
  check(
    await db
      .from("settings")
      .update({
        organization: doc.settings.organization,
        min_sample: doc.settings.minSample,
        income_bands: doc.settings.incomeBands,
      })
      .eq("id", true),
  );
  await audit(p.id, "Workspace configuration saved");
}
async function submit(doc: ResponseRecord, p: Profile) {
  z.object({
    id: z.string().uuid(),
    survey_id: z.string().uuid(),
    version: z.number().int().positive(),
    consent: z.boolean(),
    created_at: z.string().datetime(),
    status: z.enum(["completed", "declined"]),
    mode: z.string().min(1),
    answers: z.record(z.unknown()),
  }).parse(doc);
  const version = check(
    await db
      .from("survey_versions")
      .select("definition")
      .eq("survey_id", doc.survey_id)
      .eq("version", doc.version)
      .single(),
  ).data?.definition as SurveyVersion | undefined;
  if (!version) throw Error("Survey version unavailable.");
  doc = { ...doc, surveyor_id: p.id, synthetic: false };
  if (doc.status === "declined") {
    if (doc.consent) throw Error("Declined interview cannot have consent.");
    doc.answers = { consent: "I decline" };
    doc.state = "";
    doc.district = "";
    doc.geography = "";
  } else {
    if (!doc.consent || doc.answers.consent !== "I agree to participate")
      throw Error("Explicit consent is required.");
    const visible = visibleQuestions(
      version.questions,
      version.rules,
      doc.answers,
    );
    for (const q of visible) {
      const error = validateAnswer(q, doc.answers[q.id], doc.answers);
      if (error) throw Error(`${q.label}: ${error}`);
    }
    const validIds = new Set(
      visible
        .filter((q) => !["section", "instruction"].includes(q.type))
        .map((q) => q.id),
    );
    if (Object.keys(doc.answers).some((id) => !validIds.has(id)))
      throw Error("Unexpected or hidden answer field.");
    doc.state = String(doc.answers.state || "");
    doc.district = String(doc.answers.district || "");
    doc.geography = doc.state;
    const state = check(
      await db
        .from("geographies")
        .select("*")
        .eq("name", doc.state)
        .eq("level", "state")
        .maybeSingle(),
    ).data;
    if (version.questions.some((q) => q.id === "state" && q.required) && !state)
      throw Error("Invalid state reference.");
    if (doc.district) {
      const district = check(
        await db
          .from("geographies")
          .select("*")
          .eq("name", doc.district)
          .eq("parent_id", state?.id)
          .maybeSingle(),
      ).data;
      if (!district)
        throw Error("District does not belong to the selected state.");
    }
    const references =
      check(await db.from("geographies").select("*")).data || [];
    doc.geography = geographicReference(doc.answers, references);
  }
  check(await db.rpc("submit_response", { doc }));
  return { id: doc.id };
}
Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") || allowed[0];
  if (req.method === "OPTIONS") return result({}, 200, origin);
  if (req.method !== "POST")
    return result({ error: "Method not allowed" }, 405, origin);
  if (req.headers.get("Origin") && !allowed.includes(origin))
    return result({ error: "Origin not allowed" }, 403, origin);
  try {
    if (Number(req.headers.get("content-length") || 0) > 5_000_000)
      throw Error("Request too large.");
    const { action, payload = {} } = await req.json();
    if (action === "login" || action === "recover") {
      const username = z
        .string()
        .min(3)
        .max(50)
        .parse(payload.username)
        .toLowerCase();
      const ip =
        req.headers.get("x-real-ip") ||
        req.headers.get("x-forwarded-for")?.split(",")[0] ||
        "unknown";
      await rate("account:" + username);
      await rate("ip:" + ip);
      if (action === "recover") {
        await audit(
          "Recovery request",
          "Password reset requested; contact workspace administrator",
        );
        return result({ ok: true }, 200, origin);
      }
      const mapping = check(
        await db.rpc("auth_mapping_lookup", { login_name: username }),
      ).data?.[0];
      if (!mapping)
        return result({ error: "Invalid username or password." }, 401, origin);
      const authClient = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const auth = await authClient.auth.signInWithPassword({
        email: mapping.email,
        password: z.string().min(1).max(200).parse(payload.password),
      });
      if (auth.error || !auth.data.user || !auth.data.session)
        return result({ error: "Invalid username or password." }, 401, origin);
      const profile = check(
        await db
          .from("profiles")
          .select("*")
          .eq("id", auth.data.user.id)
          .single(),
      ).data;
      if (!profile?.active || profile.role !== payload.role) {
        await authClient.auth.signOut();
        return result(
          { error: "Account unavailable for this login experience." },
          403,
          origin,
        );
      }
      await audit(profile.id, "Signed in");
      return result(
        {
          profile,
          access_token: auth.data.session.access_token,
          refresh_token: auth.data.session.refresh_token,
        },
        200,
        origin,
      );
    }
    const p = await principal(req);
    if (action === "profile") return result(p, 200, origin);
    if (action === "change-password") {
      const password = z.string().min(12).max(200).parse(payload.password);
      check(await db.auth.admin.updateUserById(p.id, { password }));
      check(
        await db
          .from("profiles")
          .update({ must_change_password: false })
          .eq("id", p.id),
      );
      await audit(p.id, "Password changed");
      return result({ ok: true }, 200, origin);
    }
    if (p.must_change_password)
      throw Error("Change your temporary password first.");
    if (action === "workspace")
      return result(await readWorkspace(p), 200, origin);
    if (action === "submit-response")
      return result(await submit(payload, p), 200, origin);
    requireAdmin(p);
    if (action === "save-workspace") {
      await saveWorkspace(payload, p);
      return result({ ok: true }, 200, origin);
    }
    if (action === "manage-user") {
      if (payload.action === "create") {
        const input = z
          .object({
            username: z
              .string()
              .min(3)
              .max(50)
              .regex(/^[a-zA-Z0-9_.-]+$/),
            name: z.string().min(2).max(100),
            password: z.string().min(12).max(200),
            role: z.enum(["admin", "surveyor"]),
          })
          .parse(payload);
        const email = `${crypto.randomUUID()}@auth.publicpulse.invalid`;
        const auth = check(
          await db.auth.admin.createUser({
            email,
            password: input.password,
            email_confirm: true,
          }),
        );
        const uid = auth.data.user!.id;
        try {
          check(
            await db.from("profiles").insert({
              id: uid,
              username: input.username.toLowerCase(),
              name: input.name,
              role: input.role,
              active: true,
              must_change_password: true,
            }),
          );
          check(
            await db.rpc("auth_mapping_set", {
              login_name: input.username,
              uid,
              auth_email: email,
            }),
          );
        } catch (e) {
          await db.auth.admin.deleteUser(uid);
          throw e;
        }
        await audit(p.id, `Created ${input.role}: ${input.username}`);
        return result({ id: uid }, 200, origin);
      }
      const uid = z.string().uuid().parse(payload.id);
      if (uid === p.id)
        throw Error(
          "Use your own password settings; self-management is restricted.",
        );
      if (payload.action === "toggle") {
        const active = z.boolean().parse(payload.active);
        // Revoke database/API access first so a failed Auth ban cannot leave an active profile.
        if (!active)
          check(
            await db.from("profiles").update({ active: false }).eq("id", uid),
          );
        check(
          await db.auth.admin.updateUserById(uid, {
            ban_duration: active ? "none" : "876000h",
          }),
        );
        if (active)
          check(
            await db.from("profiles").update({ active: true }).eq("id", uid),
          );
        await audit(
          p.id,
          `Account ${uid}: ${active ? "activated" : "deactivated"}`,
        );
      } else if (payload.action === "reset") {
        const password = z.string().min(12).max(200).parse(payload.password);
        check(
          await db
            .from("profiles")
            .update({ must_change_password: true })
            .eq("id", uid),
        );
        check(await db.auth.admin.updateUserById(uid, { password }));
        await audit(p.id, `Temporary password reset: ${uid}`);
      } else throw Error("Unknown user operation.");
      return result({ ok: true }, 200, origin);
    }
    if (action === "clear-synthetic") {
      check(await db.from("responses").delete().eq("synthetic", true));
      await audit(p.id, "Synthetic responses cleared");
      return result({ ok: true }, 200, origin);
    }
    if (action === "review-classification") {
      const input = z
        .object({
          response_id: z.string().uuid(),
          category: z.string().max(100),
        })
        .parse(payload);
      check(
        await db.from("classification_reviews").upsert({
          ...input,
          reviewed_by: p.id,
          reviewed_at: new Date().toISOString(),
        }),
      );
      await audit(
        p.id,
        `Classification reviewed: ${input.response_id} → ${input.category}`,
      );
      return result({ ok: true }, 200, origin);
    }
    return result({ error: "Unknown operation" }, 400, origin);
  } catch (e) {
    console.error("PublicPulse request rejected:", (e as Error).message);
    return result(
      { error: (e as Error).message || "Request failed" },
      400,
      origin,
    );
  }
});
