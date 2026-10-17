import { describe, it, expect } from "vitest";
import {
  matches,
  triggered,
  visibleQuestions,
  validateAnswer,
  validateGraph,
  publishSurvey,
  distribution,
  classify,
  canAccess,
  validateWidget,
  csv,
} from "../src/lib/engine";
import { defaultSurvey } from "../src/lib/template";
import { generateDemo } from "../src/lib/demo";
import { parseCSV } from "../src/lib/csv";
import { filterResponses, blankFilters } from "../src/pages/Analytics";
import type { Rule, Widget } from "../src/types";
describe("Branching operators", () => {
  it.each([
    ["equals", "Roads", "Roads", true],
    ["not_equals", "Water", "Roads", true],
    ["contains", ["Roads", "Water"], "Water", true],
    ["not_contains", ["Roads"], "Water", true],
    ["greater_than", 5, 3, true],
    ["less_than", 1, 3, true],
    ["in", "Roads", ["Roads", "Water"], true],
    ["not_in", "Jobs", ["Roads"], true],
    ["is_empty", [], null, true],
    ["is_not_empty", "yes", null, true],
    ["greater_than", "", -1, false],
  ] as const)("%s evaluates safely", (operator, value, target, expected) => {
    expect(
      matches({ question: "q", operator, value: target }, { q: value }),
    ).toBe(expected);
  });
  it("supports AND and OR", () => {
    const r: Rule = {
      id: "r",
      logic: "AND",
      conditions: [
        { question: "a", operator: "equals", value: 1 },
        { question: "b", operator: "equals", value: 2 },
      ],
      action: "show",
      target: "c",
    };
    expect(triggered(r, { a: 1, b: 3 })).toBe(false);
    expect(triggered({ ...r, logic: "OR" }, { a: 1, b: 3 })).toBe(true);
  });
  it("reveals only the appropriate dependent questions", () => {
    const s = defaultSurvey();
    const water = visibleQuestions(s.questions, s.rules, {
      priority: "Water",
    }).map((q) => q.id);
    expect(water).toContain("water_detail");
    expect(water).not.toContain("roads_detail");
    expect(water).not.toContain("employment_detail");
    expect(water).not.toContain("work_noticed");
  });
  it("handles forward skip and end", () => {
    const s = defaultSurvey(),
      qs = s.questions.slice(0, 4);
    expect(
      visibleQuestions(
        qs,
        [
          {
            id: "skip",
            logic: "AND",
            conditions: [
              { question: "consent", operator: "equals", value: "yes" },
            ],
            action: "skip",
            target: qs[3].id,
          },
        ],
        { consent: "yes" },
      ).map((q) => q.id),
    ).toEqual([qs[0].id, qs[3].id]);
    expect(
      visibleQuestions(
        qs,
        [
          {
            id: "end",
            logic: "AND",
            conditions: [
              { question: "consent", operator: "equals", value: "no" },
            ],
            action: "end",
            target: "",
          },
        ],
        { consent: "no" },
      ),
    ).toHaveLength(1);
  });
});
describe("Form validation", () => {
  it("requires mandatory answers and validates option membership", () => {
    const q = defaultSurvey().questions.find((q) => q.id === "priority")!;
    expect(validateAnswer(q, "", {})).toBeTruthy();
    expect(validateAnswer(q, "Forged option", {})).toBeTruthy();
    expect(validateAnswer(q, "Water", {})).toBeUndefined();
  });
  it("limits multi-select and numeric ranges", () => {
    const q = defaultSurvey().questions.find((q) => q.id === "issues")!;
    expect(
      validateAnswer(q, ["Roads", "Water", "Employment", "Healthcare"], {}),
    ).toBeTruthy();
    expect(
      validateAnswer({ ...q, type: "number", min: 1, max: 5 }, 99, {}),
    ).toBeTruthy();
  });
  it("conditionally requires fields", () => {
    const q = {
      ...defaultSurvey().questions[0],
      required: false,
      requiredWhen: [
        { question: "yes", operator: "equals" as const, value: true },
      ],
    };
    expect(validateAnswer(q, "", { yes: true })).toBeTruthy();
    expect(validateAnswer(q, "", { yes: false })).toBeUndefined();
  });
});
describe("Publication and versioning", () => {
  it("validates the complete India template", () =>
    expect(validateGraph(defaultSurvey())).toEqual([]));
  it("rejects cycles, missing targets and mandatory skips", () => {
    const s = defaultSurvey();
    s.rules.push({
      id: "bad",
      logic: "AND",
      conditions: [
        { question: "priority", operator: "equals", value: "Roads" },
      ],
      action: "skip",
      target: "consent",
    });
    expect(validateGraph(s).join(" ")).toMatch(/cycle|follow/);
    s.rules[0].target = "missing";
    expect(validateGraph(s).join(" ")).toContain("missing target");
  });
  it("preserves immutable snapshots while drafts evolve", () => {
    const original = publishSurvey(defaultSurvey()),
      label = original.published![0].questions[0].label;
    original.questions[0].label = "Updated consent";
    const next = publishSurvey(original);
    expect(next.version).toBe(2);
    expect(next.published![0].questions[0].label).toBe(label);
    expect(next.published![1].questions[0].label).toBe("Updated consent");
  });
});
describe("Analytics and privacy", () => {
  it("counts multi-selects and suppresses small samples", () => {
    const data = generateDemo(30),
      rows = data.responses;
    const all = distribution(rows, "issues", 1);
    expect(all.reduce((n, r) => n + (r.count || 0), 0)).toBe(60);
    expect(distribution(rows.slice(0, 1), "priority", 5)[0]).toMatchObject({
      count: null,
      suppressed: true,
    });
  });
  it("filters geography and demographics together", () => {
    const rows = generateDemo(100).responses;
    const r = rows[0];
    expect(
      filterResponses(rows, {
        ...blankFilters,
        state: r.state,
        age: String(r.answers.age),
      }).every((x) => x.state === r.state && x.answers.age === r.answers.age),
    ).toBe(true);
  });
  it("classifies English and Hindi without paid services", () => {
    const d = generateDemo(1);
    expect(classify("पानी की समस्या और road repair", d.classifiers)).toEqual([
      "Roads",
      "Water",
    ]);
  });
  it("reproduces distributions for a fixed seed", () => {
    const a = generateDemo(20, 2026).responses,
      b = generateDemo(20, 2026).responses;
    expect(a.map((r) => r.answers)).toEqual(b.map((r) => r.answers));
  });
});
describe("Authorization and dashboard config", () => {
  it("restricts management modules", () => {
    expect(canAccess("surveyor", "users")).toBe(false);
    expect(canAccess("surveyor", "collection")).toBe(true);
    expect(canAccess("admin", "users")).toBe(true);
    expect(canAccess("unknown", "collection")).toBe(false);
  });
  it("validates widget configuration", () => {
    const w: Widget = {
      id: "w",
      title: "Issues",
      metric: "priority",
      type: "bar",
      width: "half",
      aggregation: "count",
    };
    expect(validateWidget(w)).toBe(true);
    expect(validateWidget({ ...w, title: "" })).toBe(false);
  });
});
describe("CSV exchange", () => {
  it("round-trips quoted cells and neutralizes formulas", () => {
    const content = csv([
      { name: "Pune, city", note: '"quoted"', formula: "=1+1" },
    ]);
    expect(parseCSV(content)[0]).toEqual({
      name: "Pune, city",
      note: '"quoted"',
      formula: "'=1+1",
    });
  });
  it("rejects malformed input", () =>
    expect(() => parseCSV('name,level\n"unclosed,state')).toThrow());
});
