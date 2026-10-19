import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { defaultSurvey } from "../src/lib/template";
import { publishSurvey } from "../src/lib/engine";
let db: PGlite;
const admin = "00000000-0000-4000-8000-000000000001",
  field = "00000000-0000-4000-8000-000000000002",
  other = "00000000-0000-4000-8000-000000000003";
const survey = publishSurvey(defaultSurvey());
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
  );
  // PGlite has gen_random_uuid built in; Supabase installs pgcrypto separately.
  const sql = readFileSync(
    new URL("../supabase/migrations/202610170001_initial.sql", import.meta.url),
    "utf8",
  ).replace("create extension if not exists pgcrypto;", "");
  await db.exec(sql);
  const publicSql = readFileSync(
    new URL("../supabase/migrations/202610190002_public_links.sql", import.meta.url),
    "utf8",
  );
  await db.exec(publicSql);
  await db.exec(
    `grant usage on schema public to anon,authenticated;grant select,insert,update,delete on all tables in schema public to authenticated;insert into auth.users values('${admin}'),('${field}'),('${other}');insert into public.profiles(id,username,name,role,must_change_password) values('${admin}','admin','Admin','admin',false),('${field}','field1','Field One','surveyor',false),('${other}','field2','Field Two','surveyor',false);`,
  );
  await db.query("select public.save_survey($1::jsonb)", [
    JSON.stringify(survey),
  ]);
  await db.query(
    "insert into public.survey_assignments(survey_id,surveyor_id,quota) values($1,$2,2)",
    [survey.id, field],
  );
}, 30000);
afterAll(async () => {
  await db.close();
});
async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${uid}',false);`,
  );
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
  }
}
describe("PostgreSQL migration and access boundaries", () => {
  it("limits repeated login attempts atomically", async () => {
    for (let i = 0; i < 10; i++) {
      const result = await db.query<{ reserve_login: boolean }>(
        "select public.reserve_login('test-hashed-account')",
      );
      expect(result.rows[0].reserve_login).toBe(true);
    }
    const result = await db.query<{ reserve_login: boolean }>(
      "select public.reserve_login('test-hashed-account')",
    );
    expect(result.rows[0].reserve_login).toBe(false);
  });
  it("enables RLS on every public data table", async () => {
    const r = await db.query<{ relname: string }>(
      "select relname from pg_class join pg_namespace ns on ns.oid=relnamespace where ns.nspname=$1 and relkind=$2 and not relrowsecurity",
      ["public", "r"],
    );
    expect(r.rows).toEqual([]);
  });
  it("adds public links without changing the source of historical responses", async () => {
    const cols = await db.query<{ column_name: string; is_nullable: string; column_default: string | null }>(
      "select column_name,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name='responses' and column_name in ('source','surveyor_id') order by column_name",
    );
    expect(cols.rows.find((c) => c.column_name === "source")?.column_default).toContain("surveyor");
    expect(cols.rows.find((c) => c.column_name === "surveyor_id")?.is_nullable).toBe("YES");
    const rls = await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where relname='public_survey_links'");
    expect(rls.rows[0].relrowsecurity).toBe(true);
  });
  it("rate limits hashed public-link attempts in a separate window", async () => {
    const key = "c".repeat(64);
    const a = await db.query<{ reserve_public_attempt: boolean }>("select public.reserve_public_attempt($1,2)", [key]);
    const b = await db.query<{ reserve_public_attempt: boolean }>("select public.reserve_public_attempt($1,2)", [key]);
    const c = await db.query<{ reserve_public_attempt: boolean }>("select public.reserve_public_attempt($1,2)", [key]);
    expect([a.rows[0].reserve_public_attempt,b.rows[0].reserve_public_attempt,c.rows[0].reserve_public_attempt]).toEqual([true,true,false]);
  });
  it("gives surveyors only assigned surveys and their own profile", async () => {
    await asUser(field, async () => {
      expect(
        (await db.query("select * from public.surveys")).rows,
      ).toHaveLength(1);
      expect(
        (await db.query("select * from public.profiles")).rows,
      ).toHaveLength(1);
    });
    await asUser(other, async () => {
      expect(
        (await db.query("select * from public.surveys")).rows,
      ).toHaveLength(0);
    });
  });
  it("rejects frontend writes and privileged RPCs", async () => {
    await expect(
      asUser(field, () =>
        db.query(
          "insert into public.dashboard_configs(title) values('forged')",
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asUser(field, () =>
        db.query("select public.save_survey($1::jsonb)", [
          JSON.stringify(survey),
        ]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("allows active administrators to read configuration", async () => {
    await asUser(admin, async () => {
      expect(
        (await db.query("select * from public.surveys")).rows,
      ).toHaveLength(1);
      expect(
        (await db.query("select * from public.profiles")).rows,
      ).toHaveLength(3);
    });
  });
  it("removes survey access for deactivated users", async () => {
    await db.query("update public.profiles set active=false where id=$1", [
      field,
    ]);
    await asUser(field, async () =>
      expect(
        (await db.query("select * from public.surveys")).rows,
      ).toHaveLength(0),
    );
    await db.query("update public.profiles set active=true where id=$1", [
      field,
    ]);
  });
  it("requires password change before assigned data access", async () => {
    await db.query(
      "update public.profiles set must_change_password=true where id=$1",
      [field],
    );
    await asUser(field, async () =>
      expect(
        (await db.query("select * from public.surveys")).rows,
      ).toHaveLength(0),
    );
    await db.query(
      "update public.profiles set must_change_password=false where id=$1",
      [field],
    );
  });
  it("normalizes published questions and rejects snapshot mutation", async () => {
    expect((await db.query("select * from public.questions")).rows.length).toBe(
      survey.questions.length,
    );
    await expect(
      db.query("update public.survey_versions set definition='{}'"),
    ).rejects.toThrow(/immutable/);
  });
});
describe("Atomic response submission", () => {
  const record = {
    id: crypto.randomUUID(),
    survey_id: survey.id,
    version: 1,
    surveyor_id: field,
    created_at: new Date().toISOString(),
    state: "Maharashtra",
    district: "Pune",
    geography: "Maharashtra",
    mode: "In person",
    answers: { consent: "I agree to participate", priority: "Roads" },
    consent: true,
    status: "completed",
    synthetic: false,
  };
  it("stores one response on repeated idempotent retries", async () => {
    await db.query("select public.submit_response($1::jsonb)", [
      JSON.stringify(record),
    ]);
    await db.query("select public.submit_response($1::jsonb)", [
      JSON.stringify(record),
    ]);
    expect(
      (await db.query("select * from public.responses")).rows,
    ).toHaveLength(1);
    expect(
      (await db.query("select * from public.response_answers")).rows,
    ).toHaveLength(2);
    const source = await db.query<{ source: string }>("select source from public.responses where id=$1", [record.id]);
    expect(source.rows[0].source).toBe("surveyor");
  });
  it("rejects changed content for an existing ID", async () => {
    await expect(
      db.query("select public.submit_response($1::jsonb)", [
        JSON.stringify({ ...record, answers: { priority: "Water" } }),
      ]),
    ).rejects.toThrow(/Idempotency conflict/);
  });
  it("rejects unassigned surveyors", async () => {
    await expect(
      db.query("select public.submit_response($1::jsonb)", [
        JSON.stringify({
          ...record,
          id: crypto.randomUUID(),
          surveyor_id: other,
        }),
      ]),
    ).rejects.toThrow(/Not assigned/);
  });
  it("preserves submitted responses", async () => {
    await expect(
      db.query("update public.responses set answers='{}'"),
    ).rejects.toThrow(/immutable/);
    await expect(db.query("delete from public.responses")).rejects.toThrow(
      /immutable/,
    );
  });
  it("enforces assignment quotas", async () => {
    await db.query("select public.submit_response($1::jsonb)", [
      JSON.stringify({ ...record, id: crypto.randomUUID() }),
    ]);
    await expect(
      db.query("select public.submit_response($1::jsonb)", [
        JSON.stringify({ ...record, id: crypto.randomUUID() }),
      ]),
    ).rejects.toThrow(/quota reached/);
  });
  it("protects other surveyors responses under RLS", async () => {
    await asUser(other, async () =>
      expect(
        (await db.query("select * from public.responses")).rows,
      ).toHaveLength(0),
    );
    await asUser(field, async () =>
      expect(
        (await db.query("select * from public.responses")).rows,
      ).toHaveLength(2),
    );
  });
  it("suppresses aggregate groups below the configured sample", async () => {
    await asUser(admin, async () => {
      const r = await db.query<{ n: null; suppressed: boolean }>(
        "select * from public.aggregate_question($1,$2,5)",
        [survey.id, "priority"],
      );
      expect(r.rows[0].n).toBe(null);
      expect(r.rows[0].suppressed).toBe(true);
    });
  });
});
describe("Anonymous public link submissions", () => {
  const hash = "a".repeat(64);
  const doc = {
    id: crypto.randomUUID(), survey_id: survey.id, version: 1,
    created_at: new Date().toISOString(), answers: { consent: "I agree to participate" },
    consent: true, status: "completed", state: "", district: "", geography: "",
  };
  it("accepts an active published link and records a non-account source", async () => {
    await db.query("insert into public.public_survey_links(token_hash,survey_id,version,created_by) values($1,$2,1,$3)", [hash,survey.id,admin]);
    await db.query("select public.submit_public_response($1,$2::jsonb,$3)", [hash,JSON.stringify(doc),"qr"]);
    const r = await db.query<{ surveyor_id: string | null; source: string; answers: Record<string, unknown> }>("select surveyor_id,source,answers from public.responses where id=$1", [doc.id]);
    expect(r.rows[0]).toMatchObject({ surveyor_id: null, source: "qr", answers: doc.answers });
  });
  it("rejects inactive links and protects link records from anonymous reads", async () => {
    await db.query("insert into public.public_survey_links(token_hash,survey_id,version,created_by,active) values($1,$2,1,$3,false)", ["b".repeat(64),survey.id,admin]);
    await expect(db.query("select public.submit_public_response($1,$2::jsonb,$3)", ["b".repeat(64),JSON.stringify({ ...doc, id: crypto.randomUUID() }),"public_link"])).rejects.toThrow(/inactive or expired/);
    await db.exec("set role anon");
    try { await expect(db.query("select * from public.public_survey_links")).rejects.toThrow(); }
    finally { await db.exec("reset role"); }
  });
  it("rejects expired links and links that disallow anonymous responses", async () => {
    await db.query("insert into public.public_survey_links(token_hash,survey_id,version,created_by,expires_at) values($1,$2,1,$3,now()-interval '1 second')", ["d".repeat(64),survey.id,admin]);
    await db.query("insert into public.public_survey_links(token_hash,survey_id,version,created_by,anonymous_allowed) values($1,$2,1,$3,false)", ["e".repeat(64),survey.id,admin]);
    await expect(db.query("select public.submit_public_response($1,$2::jsonb,$3)", ["d".repeat(64),JSON.stringify({ ...doc, id: crypto.randomUUID() }),"public_link"])).rejects.toThrow(/inactive or expired/);
    await expect(db.query("select public.submit_public_response($1,$2::jsonb,$3)", ["e".repeat(64),JSON.stringify({ ...doc, id: crypto.randomUUID() }),"public_link"])).rejects.toThrow(/does not allow anonymous/);
  });
});
