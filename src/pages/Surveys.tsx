import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  ArrowUpRight,
  Copy,
  Archive,
  Link,
  ClipboardList,
  MoreHorizontal,
  CalendarDays,
  Users,
  Pause,
  Play,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "../context";
import { Button } from "../components/ui/button";
import { Badge, PageTitle, Empty, Modal } from "../components/common";
import { publishSurvey } from "../lib/engine";
import type { Survey } from "../types";
export default function Surveys() {
  const { data, update } = useWorkspace(),
    navigate = useNavigate();
  const [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [config, setConfig] = useState<Survey | null>(null),
    [confirm, setConfirm] = useState<Survey | null>(null);
  const list = data.surveys.filter(
    (s) =>
      (filter === "all" || s.status === filter) &&
      s.title.toLowerCase().includes(search.toLowerCase()),
  );
  async function action(id: string, kind: string) {
    try {
      await update(
        (d) => {
          const idx = d.surveys.findIndex((s) => s.id === id),
            s = d.surveys[idx];
          if (kind === "duplicate") {
            d.surveys.push({
              ...structuredClone(s),
              id: crypto.randomUUID(),
              title: s.title + " (copy)",
              status: "draft",
              version: 0,
              published: [],
              created_at: new Date().toISOString(),
            });
          }
          if (kind === "archive") s.status = "archived";
          if (kind === "unpublish") s.status = "draft";
          if (kind === "publish") d.surveys[idx] = publishSurvey(s);
        },
        `Survey ${kind === "duplicate" ? "duplicated" : kind === "archive" ? "archived" : kind === "publish" ? "published" : "unpublished"}`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="DESIGNED TO LISTEN"
        title="Your surveys"
        description="From the first question to the last response, keep your research moving."
        action={
          <Button onClick={() => navigate("/builder?new=true")}>
            <Plus size={16} />
            Create survey
          </Button>
        }
      />
      <div className="section-toolbar">
        <div className="tabs compact">
          {["all", "published", "draft", "archived"].map((f) => (
            <button
              className={filter === f ? "active" : ""}
              key={f}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All surveys" : f[0].toUpperCase() + f.slice(1)}
              <span>
                {
                  data.surveys.filter((s) => f === "all" || s.status === f)
                    .length
                }
              </span>
            </button>
          ))}
        </div>
        <div className="search-input">
          <Search size={16} />
          <input
            placeholder="Search surveys…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search surveys"
          />
        </div>
      </div>
      <div className="survey-grid">
        {list.map((s, i) => {
          const count = data.responses.filter(
            (r) => r.survey_id === s.id,
          ).length;
          return (
            <article key={s.id} className="survey-card">
              <div className={`survey-cover cover-${i % 3}`}>
                <div className="survey-cover-art">
                  <ClipboardList size={48} strokeWidth={1} />
                  <span />
                  <span />
                </div>
                <Badge
                  tone={
                    s.status === "published"
                      ? "teal"
                      : s.status === "draft"
                        ? "orange"
                        : "gray"
                  }
                >
                  {s.status}
                </Badge>
                <span className="survey-version">
                  Version {s.version || "—"}
                </span>
              </div>
              <div className="survey-card-body">
                <span className="eyebrow">COMMUNITY RESEARCH</span>
                <h3>{s.title}</h3>
                <p>{s.description}</p>
                <div className="survey-card-metrics">
                  <span>
                    <MessageIcon />
                    {count} responses
                  </span>
                  <span>
                    <Users size={14} />
                    {
                      data.assignments.filter((a) => a.survey_id === s.id)
                        .length
                    }{" "}
                    surveyors
                  </span>
                </div>
                <div className="survey-card-footer">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/builder?survey=${s.id}`)}
                  >
                    Edit survey <ArrowUpRight size={14} />
                  </Button>
                  <button
                    aria-label="Configure survey"
                    className="icon-button"
                    onClick={() => setConfig(structuredClone(s))}
                  >
                    <CalendarDays size={17} />
                  </button>
                  <button
                    aria-label="Duplicate survey"
                    className="icon-button"
                    onClick={() => action(s.id, "duplicate")}
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    aria-label="Archive survey"
                    className="icon-button"
                    onClick={() => setConfirm(s)}
                  >
                    <Archive size={16} />
                  </button>
                </div>
                <div className="survey-extra-actions">
                  <button
                    onClick={() =>
                      action(
                        s.id,
                        s.status === "published" ? "unpublish" : "publish",
                      )
                    }
                  >
                    {s.status === "published" ? (
                      <Pause size={13} />
                    ) : (
                      <Play size={13} />
                    )}{" "}
                    {s.status === "published" ? "Unpublish" : "Publish"}
                  </button>
                  {s.status === "published" && (
                    <>
                      <button onClick={() => navigate(`/collect/${s.id}`)}>
                        <Eye size={13} />
                        Collect
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard
                            .writeText(`${location.origin}/collect/${s.id}`)
                            .then(() =>
                              toast.success(
                                "Authorized survey link copied. Login is required.",
                              ),
                            )
                            .catch(() =>
                              toast.error(
                                "Clipboard unavailable. Copy the collection URL from your address bar.",
                              ),
                            );
                        }}
                      >
                        <Link size={13} />
                        Copy link
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!list.length && (
        <Empty
          title="No surveys here yet"
          description="Start with a thoughtful question."
          action={
            <Button onClick={() => navigate("/builder?new=true")}>
              Create a survey
            </Button>
          }
        />
      )}
      <Modal
        title="Survey collection settings"
        open={!!config}
        onClose={() => setConfig(null)}
      >
        {config && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (config.start && config.end && config.start > config.end)
                return toast.error("End date must follow the start date.");
              await update((d) => {
                d.surveys[d.surveys.findIndex((s) => s.id === config.id)] =
                  config;
              }, "Collection settings saved");
              setConfig(null);
            }}
          >
            <div className="form-grid">
              <label>
                Start date
                <input
                  type="date"
                  value={config.start || ""}
                  onChange={(e) =>
                    setConfig({ ...config, start: e.target.value })
                  }
                />
              </label>
              <label>
                End date
                <input
                  type="date"
                  value={config.end || ""}
                  onChange={(e) =>
                    setConfig({ ...config, end: e.target.value })
                  }
                />
              </label>
            </div>
            <label>
              Overall response quota
              <input
                type="number"
                min="1"
                value={config.quota || ""}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    quota: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </label>
            <label>
              Allowed states (leave empty for all)
              <select
                multiple
                value={config.coverage || []}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    coverage: Array.from(
                      e.target.selectedOptions,
                      (o) => o.value,
                    ),
                  })
                }
              >
                {data.geographies
                  .filter((g) => g.level === "state")
                  .map((g) => (
                    <option key={g.id}>{g.name}</option>
                  ))}
              </select>
            </label>
            <Button>Save collection settings</Button>
          </form>
        )}
      </Modal>
      <Modal
        title="Archive this survey?"
        description="Collection will close. Published versions and collected responses remain available."
        open={!!confirm}
        onClose={() => setConfirm(null)}
      >
        <p>{confirm?.title}</p>
        <div className="modal-actions">
          <Button variant="outline" onClick={() => setConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              action(confirm!.id, "archive");
              setConfirm(null);
            }}
          >
            Archive survey
          </Button>
        </div>
      </Modal>
    </>
  );
}
function MessageIcon() {
  return <ClipboardList size={14} />;
}
