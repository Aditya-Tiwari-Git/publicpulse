import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  CloudUpload,
  Globe,
  MapPin,
  Save,
  ShieldCheck,
  Star,
  WifiOff,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "../context";
import { Button } from "../components/ui/button";
import { PageTitle, Badge, Card, Empty } from "../components/common";
import { localStore } from "../lib/storage";
import { submitResponse } from "../lib/api";
import { geographicReference } from "../lib/geography";
import { visibleQuestions, validateAnswer } from "../lib/engine";
import type {
  Answers,
  Draft,
  Question,
  ResponseRecord,
  SurveyVersion,
} from "../types";
export function QuestionInput({
  question: q,
  value,
  onChange,
  answers,
  hi = false,
}: {
  question: Question;
  value: unknown;
  onChange: (v: unknown) => void;
  answers: Answers;
  hi?: boolean;
}) {
  const { data } = useWorkspace();
  const options = q.options || [];
  const label = (o: string, i: number) =>
    hi && q.optionsHi?.[i] ? q.optionsHi[i] : o;
  if (["section", "instruction"].includes(q.type)) return null;
  if (["single", "yesno", "likert"].includes(q.type))
    return (
      <div
        className={`choice-list ${q.type === "likert" ? "likert-list" : ""}`}
      >
        {options.map((o, i) => (
          <label
            className={`choice ${value === o ? "choice-selected" : ""}`}
            key={o}
          >
            <input
              type="radio"
              name={q.id}
              value={o}
              checked={value === o}
              onChange={() => onChange(o)}
            />
            <span>{label(o, i)}</span>
            {value === o && <CheckCircle2 size={18} />}
          </label>
        ))}
      </div>
    );
  if (q.type === "multi")
    return (
      <div className="choice-list">
        {options.map((o, i) => (
          <label
            className={`choice ${Array.isArray(value) && value.includes(o) ? "choice-selected" : ""}`}
            key={o}
          >
            <input
              type="checkbox"
              checked={Array.isArray(value) && value.includes(o)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...(Array.isArray(value) ? value : []), o]
                    : (Array.isArray(value) ? value : []).filter(
                        (v) => v !== o,
                      ),
                )
              }
            />
            <span>{label(o, i)}</span>
          </label>
        ))}
        {q.max && (
          <small className="muted">Select up to {q.max} options.</small>
        )}
      </div>
    );
  if (q.type === "dropdown")
    return (
      <select
        aria-label={q.label}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{hi ? "चुनें…" : "Choose an option…"}</option>
        {options.map((o, i) => (
          <option value={o} key={o}>
            {label(o, i)}
          </option>
        ))}
      </select>
    );
  if (q.type === "geography") {
    const level =
      q.id === "state"
        ? "state"
        : q.id === "district"
          ? "district"
          : "locality";
    const parent = data.geographies.find(
      (g) => g.name === answers.state && g.level === "state",
    );
    const values = data.geographies.filter(
      (g) =>
        g.level === level &&
        (level !== "district" || g.parent_id === parent?.id),
    );
    return (
      <select
        aria-label={q.label}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select {level}…</option>
        {values.map((g) => (
          <option key={g.id} value={g.name}>
            {g.name}
          </option>
        ))}
      </select>
    );
  }
  if (q.type === "rating")
    return (
      <div className="rating-input">
        {Array.from({ length: Math.min(q.max || 5, 10) }, (_, i) => (
          <button
            type="button"
            key={i}
            className={Number(value) >= i + 1 ? "rated" : ""}
            onClick={() => onChange(i + 1)}
            aria-label={`${i + 1} out of ${q.max || 5}`}
          >
            <Star
              size={28}
              fill={Number(value) >= i + 1 ? "currentColor" : "none"}
            />
            <small>{i + 1}</small>
          </button>
        ))}
      </div>
    );
  if (q.type === "matrix")
    return (
      <div className="matrix-input">
        {q.rows?.map((row) => (
          <label key={row}>
            {row}
            <select
              value={String((value as Answers)?.[row] || "")}
              onChange={(e) =>
                onChange({
                  ...((value && typeof value === "object"
                    ? value
                    : {}) as Answers),
                  [row]: e.target.value,
                })
              }
            >
              <option value="">Choose…</option>
              {options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
    );
  if (q.type === "long")
    return (
      <textarea
        aria-label={q.label}
        value={String(value ?? "")}
        rows={4}
        maxLength={q.max}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          hi ? "अपना उत्तर लिखें…" : "Write the respondent’s answer…"
        }
      />
    );
  return (
    <input
      aria-label={q.label}
      type={
        q.type === "number" ? "number" : q.type === "date" ? "date" : "text"
      }
      min={q.min}
      max={q.max}
      value={String(value ?? "")}
      onChange={(e) =>
        onChange(
          q.type === "number"
            ? e.target.value === ""
              ? ""
              : Number(e.target.value)
            : e.target.value,
        )
      }
      placeholder={hi ? "उत्तर दर्ज करें…" : "Enter an answer…"}
    />
  );
}
export default function Collection() {
  const { data, profile, demo, refresh } = useWorkspace(),
    { surveyId } = useParams(),
    navigate = useNavigate();
  const [drafts, setDrafts] = useState<Draft[]>([]),
    [draft, setDraft] = useState<Draft | null>(null),
    [hi, setHi] = useState(false),
    [review, setReview] = useState(false),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [complete, setComplete] = useState<"submitted" | "pending" | null>(null);
  const initialized = useRef(""),
    submitting = useRef(false);
  const assigned = data.surveys.filter(
    (s) =>
      s.status === "published" &&
      (profile.role === "admin" ||
        data.assignments.some(
          (a) => a.survey_id === s.id && a.surveyor_id === profile.id,
        )),
  );
  const survey = assigned.find((s) => s.id === surveyId);
  const version = survey?.published?.find(
    (v) => v.version === (draft?.version || survey.version),
  );
  useEffect(() => {
    localStore
      .drafts()
      .then((all) => setDrafts(all.filter((d) => d.owner_id === profile.id)));
  }, [surveyId, complete, profile.id]);
  useEffect(() => {
    if (!survey || initialized.current === surveyId) return;
    initialized.current = surveyId || "";
    setComplete(null);
    setReview(false);
    localStore.drafts().then((all) => {
      const saved = all
        .filter(
          (d) =>
            d.survey_id === survey.id &&
            d.owner_id === profile.id &&
            d.status === "draft",
        )
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
      if (saved) setDraft(saved);
      else
        setDraft({
          id: crypto.randomUUID(),
          owner_id: profile.id,
          survey_id: survey.id,
          version: survey.version,
          answers: Object.fromEntries(
            (survey.published?.at(-1)?.questions || [])
              .filter((q) => q.default !== undefined)
              .map((q) => [q.id, q.default]),
          ),
          step: 0,
          status: "draft",
          updated_at: new Date().toISOString(),
        });
    });
  }, [surveyId, survey, profile.id]);
  useEffect(() => {
    if (!draft || draft.status !== "draft" || complete) return;
    const timer = setTimeout(() => {
      localStore
        .saveDraft(draft)
        .catch(() =>
          toast.error("Device storage is full. Save your work before leaving."),
        );
    }, 350);
    return () => clearTimeout(timer);
  }, [draft, complete]);
  if (!surveyId) {
    const own = data.responses.filter((r) => r.surveyor_id === profile.id),
      pending = drafts.filter(
        (d) => d.status === "pending" || d.status === "conflict",
      );
    return (
      <>
        <PageTitle
          eyebrow="YOUR FIELD WORKSPACE"
          title={`Hello, ${profile.name.split(" ")[0]}.`}
          description="A good conversation can make a difference. Let’s hear what your community has to say."
          action={
            <Button variant="outline" onClick={() => navigate("/sync")}>
              <CloudUpload size={16} />
              Sync queue {pending.length > 0 && `(${pending.length})`}
            </Button>
          }
        />
        <div className="stats-grid">
          {[
            {
              label: "Assigned surveys",
              value: assigned.length,
              icon: ClipboardList,
            },
            {
              label: "Completed interviews",
              value: own.filter((r) => r.status === "completed").length,
              icon: CheckCircle2,
            },
            {
              label: "Draft interviews",
              value: drafts.filter((d) => d.status === "draft").length,
              icon: Save,
            },
            { label: "Pending sync", value: pending.length, icon: CloudUpload },
          ].map((s) => (
            <div className="stat-card" key={s.label}>
              <div className="stat-top">
                {s.label}
                <s.icon size={20} />
              </div>
              <strong>{s.value}</strong>
              <small className="muted">Your field collection</small>
            </div>
          ))}
        </div>
        <h2 className="section-heading">Ready for a conversation?</h2>
        <div className="survey-grid">
          {assigned.map((s) => (
            <Card key={s.id} title={s.title} subtitle={s.description}>
              <div className="field-survey-info">
                <Badge tone="teal">Open for collection</Badge>
                <span>
                  Version {s.version} · {s.published?.at(-1)?.questions.length}{" "}
                  questions
                </span>
              </div>
              <p className="muted">
                {data.assignments.find(
                  (a) => a.survey_id === s.id && a.surveyor_id === profile.id,
                )?.quota ||
                  s.quota ||
                  "No"}{" "}
                response quota
              </p>
              <Button
                className="full"
                onClick={() => {
                  initialized.current = "";
                  navigate(`/collect/${s.id}`);
                }}
              >
                {drafts.some(
                  (d) => d.survey_id === s.id && d.status === "draft",
                )
                  ? "Resume draft"
                  : "Start interview"}
                <ArrowRight size={16} />
              </Button>
            </Card>
          ))}
        </div>
        {!assigned.length && (
          <Empty
            title="No assigned surveys"
            description="Your administrator will assign your next field survey here."
          />
        )}
      </>
    );
  }
  if (!survey)
    return (
      <Empty
        title="Survey unavailable"
        description="This survey is closed or is not assigned to your account."
        action={
          <Button onClick={() => navigate("/collection")}>
            Back to my surveys
          </Button>
        }
      />
    );
  if (!draft || !version)
    return <div className="loading">Loading interview…</div>;
  const answers = draft.answers,
    visible = visibleQuestions(version.questions, version.rules, answers),
    sections = [...new Set(visible.map((q) => q.section))],
    section = sections[Math.min(draft.step, sections.length - 1)],
    questions = visible.filter((q) => q.section === section);
  function answer(id: string, value: unknown) {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            answers: {
              ...prev.answers,
              [id]: value,
              ...(id === "state" ? { district: "" } : {}),
            },
            updated_at: new Date().toISOString(),
          }
        : null,
    );
    setErrors((prev) => ({ ...prev, [id]: "" }));
  }
  function validate(all = false) {
    const next: Record<string, string> = {};
    for (const q of all ? visible : questions) {
      const error = validateAnswer(q, answers[q.id], answers);
      if (error) next[q.id] = error;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }
  async function submit(declined = false) {
    if (submitting.current) return;
    if (!declined && !validate(true)) {
      setReview(false);
      return toast.error("Review the highlighted required answers.");
    }
    submitting.current = true;
    setBusy(true);
    try {
      const cleaned = declined
        ? { consent: "I decline" }
        : Object.fromEntries(
            visible
              .filter(
                (q) =>
                  !["section", "instruction"].includes(q.type) &&
                  answers[q.id] !== undefined,
              )
              .map((q) => [q.id, answers[q.id]]),
          );
      const record: ResponseRecord = {
        id: draft!.id,
        survey_id: survey!.id,
        version: draft!.version,
        surveyor_id: profile.id,
        created_at: new Date().toISOString(),
        geography: declined
          ? ""
          : geographicReference(answers, data.geographies),
        state: declined ? "" : String(answers.state || ""),
        district: declined ? "" : String(answers.district || ""),
        mode: String(answers.mode || "In person"),
        answers: cleaned,
        consent: !declined,
        status: declined ? "declined" : "completed",
        synthetic: demo,
        validation_status: "valid",
        sync_status: "pending",
      };
      const queued: Draft = {
        ...draft!,
        answers: cleaned,
        response: record,
        status: "pending",
        updated_at: new Date().toISOString(),
      };
      await localStore.saveDraft(queued);
      setDraft(queued);
      if (navigator.onLine) {
        try {
          await submitResponse(record);
          await localStore.saveDraft({
            ...queued,
            status: "synced",
            response: { ...record, sync_status: "synced" },
          });
          await refresh();
          setComplete("submitted");
        } catch (e) {
          const message = (e as Error).message;
          await localStore.saveDraft({
            ...queued,
            status: "conflict",
            error: message,
          });
          setComplete("pending");
          toast.error("Submission needs review in the sync queue: " + message);
        }
      } else setComplete("pending");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }
  if (complete)
    return (
      <div className="submission-success">
        <div className="success-circle">
          {complete === "submitted" ? (
            <CheckCircle2 size={45} />
          ) : (
            <CloudUpload size={45} />
          )}
        </div>
        <span className="eyebrow">EVERY VOICE MATTERS</span>
        <h1>
          {complete === "submitted"
            ? "Thank you for listening."
            : "Safely saved on this device."}
        </h1>
        <p>
          {complete === "submitted"
            ? "This interview has been recorded. You’re ready for the next conversation."
            : "This response is in your synchronization queue. Review it and sync when connected."}
        </p>
        <small>
          Reference: {draft.id.slice(0, 8)} · Version {draft.version}
        </small>
        <div className="modal-actions">
          <Button variant="outline" onClick={() => navigate("/collection")}>
            My surveys
          </Button>
          <Button
            onClick={() => {
              const fresh: Draft = {
                id: crypto.randomUUID(),
                owner_id: profile.id,
                survey_id: survey.id,
                version: survey.version,
                answers: Object.fromEntries(
                  (survey.published?.at(-1)?.questions || [])
                    .filter((q) => q.default !== undefined)
                    .map((q) => [q.id, q.default]),
                ),
                step: 0,
                status: "draft",
                updated_at: new Date().toISOString(),
              };
              setDraft(fresh);
              setComplete(null);
              setReview(false);
              setErrors({});
            }}
          >
            <Plus size={16} />
            New interview
          </Button>
        </div>
      </div>
    );
  return (
    <div className="interview-shell">
      <div className="interview-top">
        <button
          className="back-link"
          onClick={async () => {
            await localStore.saveDraft(draft);
            navigate("/collection");
          }}
        >
          <ArrowLeft size={16} />
          Save & exit
        </button>
        <button className="language-toggle" onClick={() => setHi(!hi)}>
          <Globe size={15} />
          {hi ? "English" : "हिन्दी"}
        </button>
      </div>
      <div className="interview-title">
        <Badge tone="teal">FIELD INTERVIEW · V{draft.version}</Badge>
        <h1>{survey.title}</h1>
        <p>{survey.description}</p>
        <small>
          Surveyor: {profile.username} ·{" "}
          {new Date(draft.updated_at).toLocaleDateString("en-IN")} · No
          respondent identity collected
        </small>
      </div>
      <div className="progress-track">
        <i
          style={{
            width: `${review ? 100 : ((draft.step + 1) / sections.length) * 100}%`,
          }}
        />
      </div>
      <div className="interview-progress">
        <span>
          {review
            ? "Review before submission"
            : `Section ${draft.step + 1} of ${sections.length} · ${section}`}
        </span>
        <span>
          <Save size={12} />
          Autosaved on device
        </span>
      </div>
      <div className="card interview-card">
        {review ? (
          <>
            <h2>{hi ? "उत्तर की समीक्षा करें" : "Let’s check the details."}</h2>
            <p className="muted">
              Confirm the respondent’s answers before submitting. Submitted
              interviews cannot be changed.
            </p>
            <div className="review-answers">
              {visible
                .filter((q) => !["section", "instruction"].includes(q.type))
                .map((q) => (
                  <div key={q.id}>
                    <span>{hi && q.hi ? q.hi : q.label}</span>
                    <strong>
                      {typeof answers[q.id] === "object"
                        ? JSON.stringify(answers[q.id])
                        : String(answers[q.id] ?? "Not answered")}
                    </strong>
                  </div>
                ))}
            </div>
            <div className="info-banner">
              <ShieldCheck size={18} />
              Consent confirmed. Only research answers will be submitted.
            </div>
          </>
        ) : (
          <>
            <span className="eyebrow">{section}</span>
            {questions.map((q) => (
              <div className="interview-question" key={q.id}>
                <label>
                  {hi && q.hi ? q.hi : q.label}
                  {q.required && <span className="required"> *</span>}
                </label>
                {q.help && <p className="question-help">{q.help}</p>}
                <QuestionInput
                  question={q}
                  value={answers[q.id]}
                  onChange={(v) => answer(q.id, v)}
                  answers={answers}
                  hi={hi}
                />
                {errors[q.id] && <p className="error">{errors[q.id]}</p>}
              </div>
            ))}
          </>
        )}
        <div className="interview-actions">
          <Button
            variant="outline"
            disabled={(draft.step === 0 && !review) || busy}
            onClick={() =>
              review
                ? setReview(false)
                : setDraft({ ...draft, step: Math.max(0, draft.step - 1) })
            }
          >
            <ArrowLeft size={16} />
            {hi ? "पीछे" : "Back"}
          </Button>
          {review ? (
            <Button onClick={() => submit()} disabled={busy}>
              {busy ? "Submitting…" : "Confirm & submit"}
              <CheckCircle2 size={16} />
            </Button>
          ) : (
            <Button
              disabled={busy}
              onClick={() => {
                if (!validate()) return;
                if (answers.consent === "I decline") {
                  submit(true);
                  return;
                }
                if (draft.step >= sections.length - 1) setReview(true);
                else setDraft({ ...draft, step: draft.step + 1 });
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              {answers.consent === "I decline"
                ? "Record decline"
                : draft.step >= sections.length - 1
                  ? "Review answers"
                  : hi
                    ? "आगे"
                    : "Continue"}
              <ArrowRight size={16} />
            </Button>
          )}
        </div>
      </div>
      <p className="interview-privacy">
        <ShieldCheck size={14} />
        Participation is voluntary. Respect the respondent’s choice to stop.
      </p>
    </div>
  );
}
