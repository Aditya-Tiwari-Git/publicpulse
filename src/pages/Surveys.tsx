import { useEffect, useState } from "react";
import QRCode from "qrcode";
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
import { demoMode, edge, supabase } from "../lib/api";
import type { Survey } from "../types";
export default function Surveys() {
  const { data, update } = useWorkspace(),
    navigate = useNavigate();
  const [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [config, setConfig] = useState<Survey | null>(null),
    [confirm, setConfirm] = useState<Survey | null>(null),
    [share, setShare] = useState<Survey | null>(null),
    [selectedVersion, setSelectedVersion] = useState(""),
    [publicLink, setPublicLink] = useState(""),
    [qrData, setQrData] = useState(""),
    [expiresAt, setExpiresAt] = useState(""),
    [anonymous, setAnonymous] = useState(true),
    [publicLinks, setPublicLinks] = useState<Array<{id:string;survey_id:string;version:number;active:boolean;expired:boolean;expires_at:string|null;responses:number}>>([]);
  async function refreshPublicLinks() {
    if (demoMode) return;
    try { setPublicLinks(await edge("list-public-links")); } catch (e) { toast.error((e as Error).message); }
  }
  useEffect(() => { void refreshPublicLinks(); }, []);
  async function createPublicLink() {
    if (!share) return;
    const version = share.published?.find((item) => item.version === Number(selectedVersion));
    if (!version) return toast.error("Publish a survey version first.");
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    try {
      await edge("create-public-link", { survey_id: share.id, version: version.version, token, expires_at: expiresAt ? new Date(expiresAt).toISOString() : null, anonymous_allowed: anonymous });
      const url = `${window.location.origin}/survey/${token}`;
      setPublicLink(url);
      setQrData(await QRCode.toDataURL(`${url}?source=qr`, { errorCorrectionLevel: "M", width: 360, margin: 2 }));
      await refreshPublicLinks();
      toast.success("Public survey link created. Copy it now; the token is not stored in readable form.");
    } catch (e) { toast.error((e as Error).message); }
  }
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
                      <button disabled={!supabase} title={!supabase ? "Connect Supabase to create a public link." : undefined} onClick={() => { setShare(s); setSelectedVersion(String(s.published?.at(-1)?.version || "")); setPublicLink(""); setQrData(""); setExpiresAt(""); setAnonymous(true); }}><Link size={13} />Create public link</button>
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
        title="Create public survey link"
        description="This link opens one immutable published version. Anyone with the link can respond while it is active."
        open={!!share}
        onClose={() => { setShare(null); setPublicLink(""); setQrData(""); setSelectedVersion(""); }}
      >
        {share && <div className="prose">
          <p><strong>{share.title}</strong></p>
          {!publicLink ? <>
            <label>Published survey version<select value={selectedVersion} onChange={(e) => setSelectedVersion(e.target.value)}>{(share.published || []).map((version) => <option key={version.version} value={version.version}>Version {version.version} · {new Date(version.created_at).toLocaleDateString()}</option>)}</select></label>
            <label>Link expiry (optional)<input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></label>
            <label className="check-row"><input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />Allow anonymous responses</label>
            <p>Anonymous participation is enabled by default. If disabled, this link will reject submissions; respondent accounts are not available in this release. The system limits repeated requests but cannot guarantee that anonymous participants submit only once.</p>
            <Button onClick={createPublicLink}>Generate secure link</Button>
          </> : <>
            <label>Public URL<input readOnly value={publicLink} onFocus={(e) => e.currentTarget.select()} /></label>
            <div className="modal-actions"><Button variant="outline" onClick={() => navigator.clipboard.writeText(publicLink).then(() => toast.success("Link copied."))}>Copy URL</Button><a className="btn btn-outline" href={publicLink} target="_blank" rel="noreferrer">Preview</a></div>
            {qrData && <div className="public-qr"><img src={qrData} alt="QR code for the public survey" /><a className="btn btn-outline" href={qrData} download={`publicpulse-survey-v${selectedVersion}-qr.png`}>Download QR code</a><small>The QR encodes this link with a source label for QR analytics.</small></div>}
            <p>Save this URL securely. Its token cannot be recovered from the database after this dialog closes.</p>
          </>}
        </div>}
      </Modal>
      <section className="public-link-list"><h2>Public survey links</h2>{publicLinks.map((link) => <div className="public-link-row" key={link.id}><span><strong>{data.surveys.find((s) => s.id === link.survey_id)?.title || "Survey"}</strong><small>Version {link.version} · {link.responses} responses{link.expires_at ? ` · expires ${new Date(link.expires_at).toLocaleString()}` : ""}</small></span><Badge tone={link.expired || !link.active ? "gray" : "teal"}>{link.expired ? "expired" : link.active ? "active" : "inactive"}</Badge>{!link.expired && <Button size="sm" variant="outline" onClick={async () => { try { await edge("set-public-link", { id: link.id, active: !link.active }); await refreshPublicLinks(); } catch (e) { toast.error((e as Error).message); } }}>{link.active ? "Deactivate" : "Activate"}</Button>}</div>)}</section>
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
