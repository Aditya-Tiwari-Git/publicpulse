import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Plus,
  GripVertical,
  Copy,
  Trash2,
  Eye,
  Check,
  ArrowUp,
  ArrowDown,
  Save,
  GitBranch,
  ChevronRight,
  Type,
  ListChecks,
  Star,
  CalendarDays,
  Hash,
  AlignLeft,
  MapPin,
  Heading,
  ToggleLeft,
  Table2,
  MessageSquare,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "../context";
import { Button } from "../components/ui/button";
import { PageTitle, Modal, Badge } from "../components/common";
import { defaultSurvey } from "../lib/template";
import { publishSurvey, validateGraph } from "../lib/engine";
import type { Survey, Question, QuestionType, Rule } from "../types";
export const questionTypes: {
  value: QuestionType;
  label: string;
  icon: typeof Type;
}[] = [
  { value: "single", label: "Single select", icon: ToggleLeft },
  { value: "multi", label: "Multi-select", icon: ListChecks },
  { value: "dropdown", label: "Dropdown", icon: ListChecks },
  { value: "short", label: "Short text", icon: Type },
  { value: "long", label: "Long text", icon: AlignLeft },
  { value: "number", label: "Number", icon: Hash },
  { value: "date", label: "Date", icon: CalendarDays },
  { value: "rating", label: "Rating (1–5)", icon: Star },
  { value: "likert", label: "Likert scale", icon: ListChecks },
  { value: "yesno", label: "Yes / No", icon: ToggleLeft },
  { value: "matrix", label: "Matrix", icon: Table2 },
  { value: "geography", label: "Geography", icon: MapPin },
  { value: "section", label: "Section heading", icon: Heading },
  { value: "instruction", label: "Instruction", icon: MessageSquare },
];
export default function Builder() {
  const { data, update } = useWorkspace(),
    [params] = useSearchParams(),
    navigate = useNavigate();
  const [survey, setSurvey] = useState<Survey>(() =>
      structuredClone(
        data.surveys.find((s) => s.id === params.get("survey")) ||
          data.surveys[0] ||
          defaultSurvey(data.settings.incomeBands),
      ),
    ),
    [selected, setSelected] = useState(""),
    [tab, setTab] = useState("questions"),
    [rulesText, setRulesText] = useState(""),
    [preview, setPreview] = useState(false),
    [errors, setErrors] = useState<string[]>([]),
    [saving, setSaving] = useState(false),
    [dirty, setDirty] = useState(false),
    [drag, setDrag] = useState<number | null>(null);
  useEffect(() => {
    const existing = data.surveys.find((s) => s.id === params.get("survey"));
    if (existing) {
      setSurvey(structuredClone(existing));
      setDirty(false);
    } else if (params.get("new")) {
      const fresh = defaultSurvey(data.settings.incomeBands);
      fresh.title = "Untitled survey";
      fresh.questions = [fresh.questions[0]];
      fresh.rules = [];
      setSurvey(fresh);
      setDirty(true);
    }
  }, [params]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const change = (next: Survey) => {
    setSurvey(next);
    setDirty(true);
  };
  const q = survey.questions.find((q) => q.id === selected);
  function patchQuestion(patch: Partial<Question>) {
    change({
      ...survey,
      questions: survey.questions.map((item) =>
        item.id === selected ? { ...item, ...patch } : item,
      ),
    });
  }
  function add(type: QuestionType) {
    const item: Question = {
      id: `q_${crypto.randomUUID().slice(0, 8)}`,
      type,
      label: questionTypes.find((t) => t.value === type)!.label + " question",
      hi: "",
      required: false,
      section: survey.questions.at(-1)?.section || "Section 1",
      options: ["single", "multi", "dropdown", "likert", "matrix"].includes(
        type,
      )
        ? ["Option 1", "Option 2"]
        : type === "yesno"
          ? ["Yes", "No"]
          : undefined,
      ...(type === "rating" ? { min: 1, max: 5 } : {}),
      ...(type === "matrix" ? { rows: ["Row 1", "Row 2"] } : {}),
    };
    change({ ...survey, questions: [...survey.questions, item] });
    setSelected(item.id);
  }
  function reorder(from: number, to: number) {
    if (to < 0 || to >= survey.questions.length) return;
    const questions = [...survey.questions];
    questions.splice(to, 0, questions.splice(from, 1)[0]);
    change({ ...survey, questions });
  }
  async function save(publish = false) {
    const issues = publish ? validateGraph(survey) : [];
    setErrors(issues);
    if (issues.length)
      return toast.error("Resolve the validation issues before publishing.");
    setSaving(true);
    try {
      const next = publish ? publishSurvey(survey) : survey;
      await update(
        (d) => {
          const idx = d.surveys.findIndex((s) => s.id === next.id);
          if (idx < 0) d.surveys.push(next);
          else d.surveys[idx] = next;
        },
        publish
          ? `Survey published as version ${next.version}`
          : "Survey draft saved",
      );
      setSurvey(next);
      setDirty(false);
      navigate(`/builder?survey=${next.id}`, { replace: true });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="A SPACE FOR BETTER QUESTIONS"
        title="Survey builder"
        description="Shape the conversation. Let thoughtful questions lead the way."
        action={
          <>
            <Button variant="outline" onClick={() => setPreview(true)}>
              <Eye size={16} />
              Preview
            </Button>
            <Button variant="outline" disabled={saving} onClick={() => save()}>
              <Save size={16} />
              {dirty ? "Save changes" : "Saved"}
            </Button>
            <Button disabled={saving} onClick={() => save(true)}>
              <Check size={16} />
              Publish version
            </Button>
          </>
        }
      />
      <div className="builder-toolbar">
        <select
          aria-label="Choose survey"
          value={survey.id}
          onChange={(e) => {
            if (dirty && !window.confirm("Discard unsaved changes?")) return;
            navigate(`/builder?survey=${e.target.value}`);
          }}
        >
          {!data.surveys.some((s) => s.id === survey.id) && (
            <option value={survey.id}>New survey</option>
          )}
          {data.surveys.map((s) => (
            <option value={s.id} key={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <Badge tone={survey.status === "published" ? "teal" : "orange"}>
          {survey.status} · v{survey.version}
        </Badge>
        <span className="muted tiny">
          {survey.questions.length} questions {dirty ? "· Unsaved changes" : ""}
        </span>
        <div className="tabs compact">
          <button
            className={tab === "questions" ? "active" : ""}
            onClick={() => setTab("questions")}
          >
            Questions
          </button>
          <button
            className={tab === "branching" ? "active" : ""}
            onClick={() => {
              setTab("branching");
              setRulesText(JSON.stringify(survey.rules, null, 2));
            }}
          >
            <GitBranch size={14} />
            Branching
          </button>
        </div>
      </div>
      {errors.length > 0 && (
        <div className="validation-alert">
          <strong>Before you publish</strong>
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}
      {tab === "questions" ? (
        <div className="builder-layout">
          <aside className="card question-toolbox">
            <span className="eyebrow">ADD A QUESTION</span>
            <p>Choose a building block</p>
            {questionTypes.map((t) => (
              <button key={t.value} onClick={() => add(t.value)}>
                <t.icon size={16} />
                {t.label}
                <Plus size={12} />
              </button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const template = defaultSurvey(data.settings.incomeBands);
                change({
                  ...survey,
                  questions: template.questions,
                  rules: template.rules,
                });
                toast.info("India template loaded. Save to keep it.");
              }}
            >
              Load India template
            </Button>
          </aside>
          <div className="builder-canvas">
            <div className="survey-title-editor">
              <span className="eyebrow">SURVEY DETAILS</span>
              <input
                aria-label="Survey title"
                value={survey.title}
                onChange={(e) => change({ ...survey, title: e.target.value })}
              />
              <textarea
                aria-label="Survey description"
                value={survey.description}
                onChange={(e) =>
                  change({ ...survey, description: e.target.value })
                }
              />
            </div>
            {survey.questions.map((item, i) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => setDrag(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (drag !== null) reorder(drag, i);
                  setDrag(null);
                }}
                onClick={() => setSelected(item.id)}
                className={`builder-question ${selected === item.id ? "selected" : ""}`}
              >
                <div className="question-header">
                  <GripVertical size={16} />
                  <span>
                    {String(i + 1).padStart(2, "0")} /{" "}
                    {questionTypes.find((t) => t.value === item.type)?.label}
                  </span>
                  <small>{item.section}</small>
                  <button
                    aria-label={`Move ${item.label} up`}
                    onClick={(e) => {
                      e.stopPropagation();
                      reorder(i, i - 1);
                    }}
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    aria-label={`Move ${item.label} down`}
                    onClick={(e) => {
                      e.stopPropagation();
                      reorder(i, i + 1);
                    }}
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    aria-label={`Duplicate ${item.label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      const copy = {
                        ...structuredClone(item),
                        id: `q_${crypto.randomUUID().slice(0, 8)}`,
                      };
                      change({
                        ...survey,
                        questions: [
                          ...survey.questions.slice(0, i + 1),
                          copy,
                          ...survey.questions.slice(i + 1),
                        ],
                      });
                    }}
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    aria-label={`Delete ${item.label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      change({
                        ...survey,
                        questions: survey.questions.filter(
                          (q) => q.id !== item.id,
                        ),
                      });
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <h3>
                  {item.label}
                  {item.required && <span className="required"> *</span>}
                </h3>
                {item.hi && <p className="hindi-preview">{item.hi}</p>}
                {item.options ? (
                  <div className="option-preview">
                    {item.options.slice(0, 4).map((o) => (
                      <span key={o}>
                        <i className={item.type === "multi" ? "square" : ""} />
                        {o}
                      </span>
                    ))}
                    {item.options.length > 4 && (
                      <small>+ {item.options.length - 4} more options</small>
                    )}
                  </div>
                ) : (
                  !["section", "instruction"].includes(item.type) && (
                    <div className="input-preview">
                      {item.type === "long"
                        ? "Long answer text…"
                        : item.type === "rating"
                          ? "☆  ☆  ☆  ☆  ☆"
                          : "Your answer…"}
                    </div>
                  )
                )}
              </div>
            ))}
            <button className="add-question" onClick={() => add("single")}>
              <Plus size={17} />
              Add a question
            </button>
          </div>
          <aside className="card question-properties">
            <span className="eyebrow">QUESTION PROPERTIES</span>
            {q ? (
              <>
                <label>
                  English label
                  <textarea
                    value={q.label}
                    onChange={(e) => patchQuestion({ label: e.target.value })}
                  />
                </label>
                <label>
                  Hindi label
                  <textarea
                    value={q.hi}
                    onChange={(e) => patchQuestion({ hi: e.target.value })}
                  />
                </label>
                <label>
                  Stable question ID
                  <input
                    value={q.id}
                    onChange={(e) => {
                      const old = q.id,
                        newId = e.target.value;
                      change({
                        ...survey,
                        questions: survey.questions.map((item) =>
                          item.id === old ? { ...item, id: newId } : item,
                        ),
                        rules: survey.rules.map((r) => ({
                          ...r,
                          target: r.target === old ? newId : r.target,
                          conditions: r.conditions.map((c) => ({
                            ...c,
                            question: c.question === old ? newId : c.question,
                          })),
                        })),
                      });
                      setSelected(newId);
                    }}
                  />
                </label>
                <label>
                  Section
                  <input
                    value={q.section}
                    onChange={(e) => patchQuestion({ section: e.target.value })}
                  />
                </label>
                <label>
                  Help text
                  <textarea
                    value={q.help || ""}
                    onChange={(e) => patchQuestion({ help: e.target.value })}
                  />
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={q.required}
                    onChange={(e) =>
                      patchQuestion({ required: e.target.checked })
                    }
                  />
                  Required answer
                </label>
                {q.options && (
                  <>
                    <label>
                      Options (one per line)
                      <textarea
                        rows={5}
                        value={q.options.join("\n")}
                        onChange={(e) =>
                          patchQuestion({ options: e.target.value.split("\n") })
                        }
                      />
                    </label>
                    <label>
                      Hindi options (same order)
                      <textarea
                        value={q.optionsHi?.join("\n") || ""}
                        onChange={(e) =>
                          patchQuestion({
                            optionsHi: e.target.value.split("\n"),
                          })
                        }
                      />
                    </label>
                  </>
                )}
                {q.type === "matrix" && (
                  <label>
                    Matrix rows (one per line)
                    <textarea
                      value={q.rows?.join("\n") || ""}
                      onChange={(e) =>
                        patchQuestion({ rows: e.target.value.split("\n") })
                      }
                    />
                  </label>
                )}
                <div className="form-grid">
                  <label>
                    Minimum
                    <input
                      type="number"
                      value={q.min ?? ""}
                      onChange={(e) =>
                        patchQuestion({
                          min: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        })
                      }
                    />
                  </label>
                  <label>
                    Maximum
                    <input
                      type="number"
                      value={q.max ?? ""}
                      onChange={(e) =>
                        patchQuestion({
                          max: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        })
                      }
                    />
                  </label>
                </div>
                <label>
                  Default value
                  <input
                    value={String(q.default ?? "")}
                    onChange={(e) => patchQuestion({ default: e.target.value })}
                  />
                </label>
                <label>
                  Conditional required (JSON conditions)
                  <textarea
                    defaultValue={JSON.stringify(q.requiredWhen || [])}
                    key={q.id}
                    onBlur={(e) => {
                      try {
                        const value = JSON.parse(e.target.value);
                        if (!Array.isArray(value)) throw Error();
                        patchQuestion({ requiredWhen: value });
                      } catch {
                        toast.error("Use a JSON array of conditions.");
                      }
                    }}
                  />
                </label>
              </>
            ) : (
              <div className="properties-empty">
                <PenIcon />
                <p>Select a question to fine-tune its details.</p>
              </div>
            )}
          </aside>
        </div>
      ) : (
        <div className="card branching-editor">
          <div className="branching-intro">
            <GitBranch size={25} />
            <div>
              <h3>Let each answer guide the conversation.</h3>
              <p>
                Rules support AND / OR, all ten operators, and show, hide, skip
                and end actions. Skip targets must be forward question IDs.
              </p>
            </div>
          </div>
          <div className="info-banner">
            For conditional mandatory questions, use <code>requiredWhen</code>.
            Published versions preserve their own rules.
          </div>
          <textarea
            className="code-editor"
            spellCheck={false}
            aria-label="Branching rules JSON"
            value={rulesText}
            onChange={(e) => setRulesText(e.target.value)}
          />
          <div className="modal-actions">
            <Button
              variant="outline"
              onClick={() => {
                const example: Rule = {
                  id: crypto.randomUUID(),
                  logic: "AND",
                  conditions: [
                    {
                      question: survey.questions[0]?.id || "question_id",
                      operator: "equals",
                      value: "Option 1",
                    },
                  ],
                  action: "show",
                  target: survey.questions[1]?.id || "target_id",
                };
                try {
                  setRulesText(
                    JSON.stringify(
                      [...JSON.parse(rulesText), example],
                      null,
                      2,
                    ),
                  );
                } catch {
                  toast.error("Fix the JSON before adding a rule.");
                }
              }}
            >
              <Plus size={15} />
              Add rule
            </Button>
            <Button
              onClick={() => {
                try {
                  const rules = JSON.parse(rulesText);
                  if (
                    !Array.isArray(rules) ||
                    rules.some(
                      (r) =>
                        !Array.isArray(r.conditions) ||
                        !["AND", "OR"].includes(r.logic) ||
                        !["show", "hide", "skip", "end"].includes(r.action),
                    )
                  )
                    throw Error(
                      "Rules need valid logic, conditions, and an action.",
                    );
                  const next = { ...survey, rules };
                  change(next);
                  const problems = validateGraph(next);
                  setErrors(problems);
                  if (!problems.length)
                    toast.success("Branching graph is valid.");
                  else toast.error("Review the graph validation issues.");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              Apply & validate rules
            </Button>
          </div>
        </div>
      )}
      <Modal
        title="Preview this survey"
        description="Preview the current working draft. No response is collected."
        open={preview}
        onClose={() => setPreview(false)}
        wide
      >
        <SurveyPreview survey={survey} />
      </Modal>
    </>
  );
}
import { visibleQuestions, validateAnswer } from "../lib/engine";
import { QuestionInput } from "./Collection";
function SurveyPreview({ survey }: { survey: Survey }) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  return (
    <div className="preview-questions">
      <h2>{survey.title}</h2>
      {visibleQuestions(survey.questions, survey.rules, answers).map((q) => (
        <div key={q.id} className="interview-question">
          <label>
            {q.label}
            {q.required ? " *" : ""}
          </label>
          <QuestionInput
            question={q}
            value={answers[q.id]}
            onChange={(v) => setAnswers({ ...answers, [q.id]: v })}
            answers={answers}
          />
        </div>
      ))}
    </div>
  );
}
function PenIcon() {
  return <Type size={28} />;
}
