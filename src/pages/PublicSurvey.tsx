import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { edge } from "../lib/api";
import { validateAnswer, visibleQuestions } from "../lib/engine";
import type { Geography, Survey, SurveyVersion } from "../types";
import { Button } from "../components/ui/button";

type PublicSurveyDoc = Survey & SurveyVersion;
export default function PublicSurvey() {
  const { token = "" } = useParams();
  const [search] = useSearchParams();
  const [survey, setSurvey] = useState<PublicSurveyDoc | null>(null);
  const [geographies, setGeographies] = useState<Geography[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [review, setReview] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    edge<{ survey: PublicSurveyDoc; geographies: Geography[] }>("public-survey", { token })
      .then((data) => { setSurvey(data.survey); setGeographies(data.geographies); })
      .catch((e) => setError((e as Error).message));
  }, [token]);
  const visible = useMemo(() => survey ? visibleQuestions(survey.questions, survey.rules, answers) : [], [survey, answers]);
  const label = (q: { label: string; hi: string }) => language === "hi" ? q.hi : q.label;
  const set = (id: string, value: unknown) => setAnswers((a) => ({ ...a, [id]: value }));
  async function submit() {
    if (!survey) return;
    const invalid = visible.find((q) => validateAnswer(q, answers[q.id], answers));
    if (invalid) { setError(`${label(invalid)}: ${validateAnswer(invalid, answers[invalid.id], answers)}`); setReview(false); return; }
    setBusy(true); setError("");
    try {
      await edge("submit-public-response", { token, source: search.get("source"), response: { id: crypto.randomUUID(), version: survey.version, created_at: new Date().toISOString(), answers, consent: true } });
      setDone(true);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  if (done) return <main className="public-survey"><div className="public-card"><span className="eyebrow">PUBLICPULSE</span><h1>Thank you</h1><p>Your response has been recorded. It will be used only for the survey purpose described above.</p></div></main>;
  if (declined) return <main className="public-survey"><div className="public-card"><span className="eyebrow">PUBLICPULSE</span><h1>Thank you</h1><p>You chose not to participate. No answers were collected or saved.</p></div></main>;
  if (error && !survey) return <main className="public-survey"><div className="public-card"><h1>Survey unavailable</h1><p role="alert">{error}</p></div></main>;
  if (!survey) return <main className="public-survey"><div className="public-card"><p>Loading survey…</p></div></main>;
  const states = geographies.filter((g) => g.level === "state");
  const districts = geographies.filter((g) => g.level === "district" && g.parent_id === states.find((s) => s.name === answers.state)?.id);
  const geographyById = new Map(geographies.map((g) => [g.id, g]));
  const areaRoot = districts.find((g) => g.name === answers.district) || states.find((g) => g.name === answers.state);
  function withinArea(g: Geography) { let parent = g.parent_id; const seen = new Set<string>(); while (parent && !seen.has(parent)) { if (parent === areaRoot?.id) return true; seen.add(parent); parent = geographyById.get(parent)?.parent_id || null; } return false; }
  const progress = Math.round((visible.filter((q) => answers[q.id] !== undefined && answers[q.id] !== "").length / Math.max(visible.length, 1)) * 100);
  return <main className="public-survey"><article className="public-card">
    <div className="public-header"><span className="eyebrow">PUBLICPULSE · {survey.version ? `VERSION ${survey.version}` : "SURVEY"}</span><button className="small-link" onClick={() => setLanguage(language === "en" ? "hi" : "en")}>{language === "en" ? "हिन्दी" : "English"}</button></div>
    <h1>{survey.title}</h1><p>{survey.description}</p>
    <div className="public-progress"><span style={{ width: `${progress}%` }} /></div><small>{progress}% complete · {visible.length} questions</small>
    {review ? <section><h2>Review your answers</h2><p>Please check your answers before sending.</p>{visible.filter(q => !["section", "instruction"].includes(q.type)).map((q) => <div className="public-review" key={q.id}><strong>{label(q)}</strong><span>{Array.isArray(answers[q.id]) ? (answers[q.id] as unknown[]).join(", ") : typeof answers[q.id] === "object" && answers[q.id] !== null ? JSON.stringify(answers[q.id]) : String(answers[q.id] ?? "Not answered")}</span></div>)}<div className="public-actions"><Button variant="outline" onClick={() => setReview(false)}>Back to edit</Button><Button disabled={busy} onClick={submit}>{busy ? "Sending…" : "Submit response"}</Button></div></section> : <section className="public-questions">{visible.map((q) => <fieldset key={q.id} className="public-question"><legend>{label(q)}{q.required ? <em> *</em> : null}</legend>{q.help && <p>{q.help}</p>}
      {q.type === "section" ? null : q.type === "instruction" ? <p>{label(q)}</p>
      : q.id === "state" ? <select value={String(answers[q.id] || "")} onChange={(e) => { set(q.id, e.target.value); set("district", ""); }}><option value="">Select state or UT</option>{states.map((g) => <option key={g.id}>{g.name}</option>)}</select>
      : q.id === "district" ? <select value={String(answers[q.id] || "")} onChange={(e) => set(q.id, e.target.value)}><option value="">Select district</option>{districts.map((g) => <option key={g.id}>{g.name}</option>)}</select>
      : q.type === "geography" && ["constituency", "locality", "ward"].includes(q.id) ? <select value={String(answers[q.id] || "")} onChange={(e) => set(q.id, e.target.value)}><option value="">Select {q.id}</option>{geographies.filter((g) => g.level === q.id && withinArea(g)).map((g) => <option key={g.id}>{g.name}</option>)}</select>
      : q.type === "single" || q.type === "likert" || q.type === "yesno" ? <div className="public-options">{(q.options || ["Yes", "No"]).map((v) => <label key={v}><input type="radio" name={q.id} checked={answers[q.id] === v} onChange={() => { set(q.id, v); if (q.id === "consent" && v === "I decline") setDeclined(true); }} />{language === "hi" ? q.optionsHi?.[q.options?.indexOf(v) ?? -1] || v : v}</label>)}</div>
      : q.type === "multi" ? <div className="public-options">{(q.options || []).map((v) => <label key={v}><input type="checkbox" checked={Array.isArray(answers[q.id]) && (answers[q.id] as unknown[]).includes(v)} onChange={(e) => set(q.id, e.target.checked ? [...(Array.isArray(answers[q.id]) ? answers[q.id] as unknown[] : []), v] : (answers[q.id] as unknown[]).filter((x) => x !== v))} />{v}</label>)}</div>
      : q.type === "dropdown" ? <select value={String(answers[q.id] || "")} onChange={(e) => set(q.id, e.target.value)}><option value="">Choose an option</option>{(q.options || []).map((v) => <option key={v}>{v}</option>)}</select>
      : q.type === "rating" ? <div className="public-rating">{(q.options || ["1", "2", "3", "4", "5"]).map((v) => <label key={v}><input type="radio" name={q.id} checked={String(answers[q.id] || "") === v} onChange={() => set(q.id, Number(v))} />{v}</label>)}</div>
      : q.type === "matrix" ? <div className="public-matrix">{(q.rows || []).map((row) => <label key={row}><strong>{row}</strong><select value={String((answers[q.id] as Record<string, unknown> | undefined)?.[row] || "")} onChange={(e) => set(q.id, { ...((answers[q.id] as Record<string, unknown>) || {}), [row]: e.target.value })}><option value="">Choose</option>{(q.options || []).map((v) => <option key={v}>{v}</option>)}</select></label>)}</div>
      : q.type === "long" ? <textarea maxLength={q.max} value={String(answers[q.id] || "")} onChange={(e) => set(q.id, e.target.value)} />
      : <input type={q.type === "date" ? "date" : q.type === "number" ? "number" : "text"} min={q.type === "number" ? q.min : undefined} max={q.type === "number" ? q.max : undefined} maxLength={["short", "long"].includes(q.type) ? q.max : undefined} value={String(answers[q.id] || "")} onChange={(e) => set(q.id, q.type === "number" ? e.target.value === "" ? "" : e.target.valueAsNumber : e.target.value)} />}</fieldset>)}
      <p className="public-privacy">Participation is voluntary. Responses are anonymous by default. Anonymous links cannot fully prevent repeat submissions.</p>
      {error && <p role="alert" className="error">{error}</p>}<div className="public-actions"><Button disabled={busy} onClick={() => { const invalid = visible.find((q) => validateAnswer(q, answers[q.id], answers)); if (invalid) setError(`${label(invalid)}: ${validateAnswer(invalid, answers[invalid.id], answers)}`); else { setError(""); setReview(true); } }}>Review answers</Button></div>
    </section>}
  </article></main>;
}
