import { z } from "zod";
import type {
  Answers,
  Condition,
  Question,
  Rule,
  Survey,
  SurveyVersion,
  ResponseRecord,
  Classification,
  Widget,
} from "../types.ts";
export function matches(c: Condition, answers: Answers): boolean {
  const a = answers[c.question],
    b = c.value;
  const empty = a == null || a === "" || (Array.isArray(a) && a.length === 0);
  switch (c.operator) {
    case "equals":
      return a === b;
    case "not_equals":
      return a !== b;
    case "contains":
      return Array.isArray(a)
        ? a.includes(b)
        : String(a ?? "").includes(String(b));
    case "not_contains":
      return !matches({ ...c, operator: "contains" }, answers);
    case "greater_than":
      return !empty && Number(a) > Number(b);
    case "less_than":
      return !empty && Number(a) < Number(b);
    case "in":
      return Array.isArray(b) && b.includes(a);
    case "not_in":
      return Array.isArray(b) && !b.includes(a);
    case "is_empty":
      return empty;
    case "is_not_empty":
      return !empty;
    default:
      return false;
  }
}
export const triggered = (r: Rule, a: Answers) =>
  r.logic === "AND"
    ? r.conditions.every((c) => matches(c, a))
    : r.conditions.some((c) => matches(c, a));
export function visibleQuestions(
  questions: Question[],
  rules: Rule[],
  answers: Answers,
) {
  const showTargets = new Set(
    rules.filter((r) => r.action === "show").map((r) => r.target),
  );
  const hidden = new Set(
    questions.filter((q) => showTargets.has(q.id)).map((q) => q.id),
  );
  for (const r of rules)
    if (triggered(r, answers)) {
      if (r.action === "show") hidden.delete(r.target);
      if (r.action === "hide") hidden.add(r.target);
    }
  let result = questions.filter((q) => !hidden.has(q.id));
  for (const r of rules)
    if (triggered(r, answers)) {
      const source = Math.max(
        ...r.conditions.map((c) =>
          result.findIndex((q) => q.id === c.question),
        ),
      );
      if (r.action === "end") result = result.slice(0, source + 1);
      if (r.action === "skip") {
        const target = result.findIndex((q) => q.id === r.target);
        if (target > source)
          result = result.filter((_, i) => i <= source || i >= target);
      }
    }
  return result;
}
export function validateAnswer(
  q: Question,
  value: unknown,
  answers: Answers,
): string | undefined {
  if (q.type === "section" || q.type === "instruction") return;
  const empty =
    value == null || value === "" || (Array.isArray(value) && !value.length);
  const required =
    q.required ||
    (q.requiredWhen?.length &&
      q.requiredWhen.every((c) => matches(c, answers)));
  if (empty) return required ? "This question is required." : undefined;
  if (
    ["short", "long", "date", "geography"].includes(q.type) &&
    typeof value !== "string"
  )
    return "Enter a valid text value.";
  if (q.type === "multi") {
    if (!Array.isArray(value)) return "Choose valid options.";
    if (new Set(value).size !== value.length) return "Choose each option once.";
    if (q.min != null && value.length < q.min)
      return `Choose at least ${q.min}.`;
    if (q.max != null && value.length > q.max)
      return `Choose no more than ${q.max}.`;
    if (value.some((v) => !q.options?.includes(String(v))))
      return "Choose valid options.";
  }
  if (
    ["single", "dropdown", "likert", "yesno"].includes(q.type) &&
    !q.options?.includes(String(value))
  )
    return "Choose a valid option.";
  if (q.type === "number" || q.type === "rating") {
    const n = z.coerce.number().finite().safeParse(value);
    if (
      !n.success ||
      typeof value === "boolean" ||
      (typeof value === "string" && !value.trim())
    )
      return "Enter a valid number.";
    if (q.type === "rating" && !Number.isInteger(n.data))
      return "Choose a whole-number rating.";
    if (q.min != null && n.data < q.min) return `Minimum is ${q.min}.`;
    if (q.max != null && n.data > q.max) return `Maximum is ${q.max}.`;
  }
  if (
    q.type === "date" &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ||
      !Number.isFinite(new Date(String(value)).getTime()) ||
      new Date(String(value)).toISOString().slice(0, 10) !== String(value))
  )
    return "Enter a valid date.";
  if (["short", "long"].includes(q.type)) {
    if (q.min != null && String(value).length < q.min)
      return `Use at least ${q.min} characters.`;
    if (q.max != null && String(value).length > q.max)
      return `Use no more than ${q.max} characters.`;
  }
  if (
    q.type === "matrix" &&
    (!value ||
      typeof value !== "object" ||
      q.rows?.some(
        (row) => !q.options?.includes(String((value as Answers)[row])),
      ))
  )
    return "Answer each row.";
}
export function validateGraph(
  s: Pick<Survey, "questions" | "rules">,
): string[] {
  const questionSchema = z.object({
    id: z.string().min(1),
    type: z.enum([
      "single",
      "multi",
      "dropdown",
      "short",
      "long",
      "number",
      "date",
      "rating",
      "likert",
      "yesno",
      "matrix",
      "geography",
      "section",
      "instruction",
    ]),
    label: z.string().min(1),
    hi: z.string(),
    section: z.string().min(1),
    required: z.boolean(),
    options: z.array(z.string()).optional(),
    optionsHi: z.array(z.string()).optional(),
    rows: z.array(z.string()).optional(),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
  });
  if (!z.array(questionSchema).safeParse(s.questions).success)
    return ["Invalid question definition."];
  const conditionSchema = z.object({
    question: z.string().min(1),
    operator: z.enum([
      "equals",
      "not_equals",
      "contains",
      "not_contains",
      "greater_than",
      "less_than",
      "in",
      "not_in",
      "is_empty",
      "is_not_empty",
    ]),
    value: z.unknown().optional(),
  });
  const ruleSchema = z.object({
    id: z.string().min(1),
    logic: z.enum(["AND", "OR"]),
    conditions: z.array(conditionSchema).min(1),
    action: z.enum(["show", "hide", "skip", "end"]),
    target: z.string(),
  });
  if (
    !Array.isArray(s.questions) ||
    !z.array(ruleSchema).safeParse(s.rules).success
  )
    return ["Invalid branching rule structure, condition or operator."];
  const errors: string[] = [],
    ids = new Set(s.questions.map((q) => q.id)),
    edges = new Map<string, string[]>();
  if (ids.size !== s.questions.length)
    errors.push("Question IDs must be unique.");
  if (!s.questions.some((q) => !["section", "instruction"].includes(q.type)))
    errors.push("Add at least one question.");
  for (const q of s.questions) {
    if (!q.id?.trim() || !q.label?.trim())
      errors.push("Every question needs an ID and label.");
    if (
      ["single", "multi", "dropdown", "likert", "yesno", "matrix"].includes(
        q.type,
      ) &&
      !q.options?.length
    )
      errors.push(`${q.id}: add options.`);
    if (
      q.options &&
      (q.options.some((o) => !o.trim()) ||
        new Set(q.options).size !== q.options.length)
    )
      errors.push(`${q.id}: options must be nonempty and unique.`);
    if (q.min != null && q.max != null && q.min > q.max)
      errors.push(`${q.id}: minimum exceeds maximum.`);
    if (q.requiredWhen) {
      if (!z.array(conditionSchema).safeParse(q.requiredWhen).success)
        errors.push(`${q.id}: invalid required condition.`);
      else
        for (const c of q.requiredWhen) {
          if (!ids.has(c.question))
            errors.push(`${q.id}: missing required condition source.`);
          edges.set(c.question, [...(edges.get(c.question) || []), q.id]);
        }
    }
  }
  for (const r of s.rules) {
    if (!r.conditions.length) errors.push(`${r.id}: add a condition.`);
    if (r.action !== "end" && !ids.has(r.target))
      errors.push(`${r.id}: missing target.`);
    for (const c of r.conditions) {
      if (!ids.has(c.question)) errors.push(`${r.id}: missing source.`);
      if (r.action !== "end")
        edges.set(c.question, [...(edges.get(c.question) || []), r.target]);
      if (
        r.action === "skip" &&
        s.questions.findIndex((q) => q.id === r.target) <=
          s.questions.findIndex((q) => q.id === c.question)
      )
        errors.push("Skip targets must follow their sources.");
    }
    if (["hide", "skip", "end"].includes(r.action)) {
      const start = Math.max(
        ...r.conditions.map((c) =>
          s.questions.findIndex((q) => q.id === c.question),
        ),
      );
      const end =
        r.action === "end"
          ? s.questions.length
          : r.action === "hide"
            ? start + 1
            : s.questions.findIndex((q) => q.id === r.target);
      const blocked =
        r.action === "hide"
          ? s.questions.filter((q) => q.id === r.target)
          : s.questions.slice(start + 1, end);
      if (blocked.some((q) => q.required && !q.requiredWhen?.length))
        errors.push(
          `${r.id}: unconditional required question may be unreachable; use conditional required.`,
        );
    }
  }
  const visiting = new Set<string>(),
    done = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) {
      errors.push("Branching cycle detected.");
      return;
    }
    if (done.has(id)) return;
    visiting.add(id);
    for (const next of edges.get(id) || []) visit(next);
    visiting.delete(id);
    done.add(id);
  }
  for (const id of ids) visit(id);
  for (const q of s.questions)
    if (
      q.required &&
      s.rules.some((r) => r.action === "show" && r.target === q.id) &&
      !q.requiredWhen?.length
    )
      errors.push(
        `${q.id}: conditional visibility needs conditional required.`,
      );
  return [...new Set(errors)];
}
export function publishSurvey(s: Survey): Survey {
  const errors = validateGraph(s);
  if (errors.length) throw Error(errors.join("\n"));
  const n = Math.max(0, ...(s.published || []).map((v) => v.version)) + 1;
  const version: SurveyVersion = {
    id: crypto.randomUUID(),
    version: n,
    questions: structuredClone(s.questions),
    rules: structuredClone(s.rules),
    created_at: new Date().toISOString(),
  };
  return {
    ...s,
    status: "published",
    version: n,
    published: [...(s.published || []), version],
  };
}
export function distribution(
  responses: ResponseRecord[],
  key: string,
  min = 5,
) {
  const counts: Record<string, number> = {};
  for (const r of responses) {
    const value =
      key === "state"
        ? r.state
        : key === "district"
          ? r.district
          : r.answers[key];
    for (const v of Array.isArray(value) ? value : [value ?? "Not answered"])
      counts[String(v)] = (counts[String(v)] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, count]) => ({
      name,
      count: count < min ? null : count,
      suppressed: count < min,
    }))
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
}
export function classify(text: string, rules: Classification[]) {
  const normalized = text.toLocaleLowerCase();
  return rules
    .filter((r) =>
      r.keywords.some((k) => normalized.includes(k.toLocaleLowerCase())),
    )
    .map((r) => r.category);
}
export function validateWidget(w: Widget) {
  return Boolean(
    w.title.trim() &&
    w.metric &&
    [
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
    ].includes(w.type) &&
    ["count", "percent"].includes(w.aggregation),
  );
}
export function canAccess(role: string, resource: string) {
  return (
    role === "admin" ||
    (role === "surveyor" &&
      ["collection", "history", "sync", "password"].includes(resource))
  );
}
export function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const escape = (x: unknown) => {
    let s = typeof x === "object" ? JSON.stringify(x) : String(x ?? "");
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return [
    keys.map(escape).join(","),
    ...rows.map((r) => keys.map((k) => escape(r[k])).join(",")),
  ].join("\r\n");
}
