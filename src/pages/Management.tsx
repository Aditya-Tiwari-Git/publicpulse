import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  ShieldCheck,
  Users,
  KeyRound,
  Power,
  Upload,
  MapPin,
  Trash2,
  Download,
  RefreshCw,
  CloudUpload,
  CheckCircle2,
  AlertCircle,
  Save,
  FileText,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useWorkspace } from "../context";
import { Button } from "../components/ui/button";
import {
  PageTitle,
  Card,
  Badge,
  Empty,
  Modal,
  ExportButton,
  download,
} from "../components/common";
import { edge, submitResponse } from "../lib/api";
import { localStore } from "../lib/storage";
import { generateDemo } from "../lib/demo";
import { classify } from "../lib/engine";
import { parseCSV } from "../lib/csv";
import type { Draft, Profile, Geography, ResponseRecord } from "../types";
export function UsersPage() {
  const { data, update, demo, refresh, profile } = useWorkspace(),
    [search, setSearch] = useState(""),
    [open, setOpen] = useState(false),
    [reset, setReset] = useState<Profile | null>(null),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false);
  const schema = z.object({
    name: z.string().min(2),
    username: z
      .string()
      .min(3)
      .max(50)
      .regex(/^[a-zA-Z0-9_.-]+$/),
    password: z.string().min(12),
    role: z.enum(["admin", "surveyor"]),
  });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { role: "surveyor" },
  });
  async function toggle(p: Profile) {
    if (p.id === profile.id)
      return toast.error("You cannot deactivate your own account.");
    try {
      if (demo)
        await update(
          (d) => {
            d.profiles.find((x) => x.id === p.id)!.active = !p.active;
          },
          `Account ${p.active ? "deactivated" : "activated"}`,
        );
      else {
        await edge("manage-user", {
          action: "toggle",
          id: p.id,
          active: !p.active,
        });
        await refresh();
        toast.success("Account status updated.");
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="PEOPLE BEHIND THE PERSPECTIVE"
        title="Field team"
        description="Give your researchers the access and support to do their best work."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} />
            Add team member
          </Button>
        }
      />
      <div className="privacy-banner">
        <ShieldCheck size={18} />
        <span>
          Accounts use assigned usernames. Temporary passwords must be changed
          before live workspace access.
        </span>
      </div>
      <div className="section-toolbar">
        <h2 className="section-heading">
          Team members <span className="muted">({data.profiles.length})</span>
        </h2>
        <div className="search-input">
          <Search size={15} />
          <input
            aria-label="Search people"
            placeholder="Find a team member…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="card table-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Team member</th>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th>Assignments</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.profiles
                .filter((p) =>
                  `${p.name} ${p.username}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="person-cell">
                        <span className="avatar">
                          {p.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </span>
                        <strong>{p.name}</strong>
                      </div>
                    </td>
                    <td>
                      <code>{p.username}</code>
                    </td>
                    <td>
                      {p.role === "admin" ? "Administrator" : "Field surveyor"}
                    </td>
                    <td>
                      <Badge tone={p.active ? "teal" : "gray"}>
                        {p.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td>
                      {
                        data.assignments.filter((a) => a.surveyor_id === p.id)
                          .length
                      }
                    </td>
                    <td>
                      <div className="table-actions">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setReset(p);
                            setPassword("");
                          }}
                        >
                          <KeyRound size={14} />
                          Reset
                        </Button>
                        <button
                          className="icon-button"
                          aria-label={`${p.active ? "Deactivate" : "Activate"} ${p.name}`}
                          disabled={p.id === profile.id}
                          onClick={() => toggle(p)}
                        >
                          <Power size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      <Modal
        title="Welcome a team member"
        description="Share the username and temporary password through a secure channel."
        open={open}
        onClose={() => setOpen(false)}
      >
        <form
          onSubmit={form.handleSubmit(async (values) => {
            if (
              data.profiles.some(
                (p) =>
                  p.username.toLowerCase() === values.username.toLowerCase(),
              )
            )
              return toast.error("That username is already in use.");
            setBusy(true);
            try {
              if (demo)
                await update((d) => {
                  d.profiles.push({
                    id: crypto.randomUUID(),
                    name: values.name,
                    username: values.username.toLowerCase(),
                    role: values.role,
                    active: true,
                    must_change_password: true,
                  });
                }, "Demo team member created (no authentication account)");
              else {
                await edge("manage-user", { action: "create", ...values });
                await refresh();
                toast.success("Account created; password change required.");
              }
              setOpen(false);
              form.reset({ role: "surveyor" });
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          })}
        >
          <label>
            Full name
            <input {...form.register("name")} placeholder="e.g. Priya Mehta" />
          </label>
          <label>
            Assigned username
            <input
              {...form.register("username")}
              autoComplete="off"
              placeholder="e.g. field.pune01"
            />
          </label>
          <label>
            Temporary password
            <input
              type="password"
              {...form.register("password")}
              autoComplete="new-password"
              placeholder="At least 12 characters"
            />
          </label>
          <label>
            Role
            <select {...form.register("role")}>
              <option value="surveyor">Field surveyor</option>
              <option value="admin">Administrator</option>
            </select>
          </label>
          {Object.entries(form.formState.errors).map(([key, error]) => (
            <p className="error" key={key}>
              {key}: {error?.message}
            </p>
          ))}
          {demo && (
            <p className="muted tiny">
              Demo creates a synthetic team record. Credentials are never stored
              on this device.
            </p>
          )}
          <Button disabled={busy} className="full">
            {busy ? "Creating…" : "Create team member"}
          </Button>
        </form>
      </Modal>
      <Modal
        title="Reset temporary password"
        open={!!reset}
        onClose={() => setReset(null)}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (password.length < 12)
              return toast.error("Use at least 12 characters.");
            setBusy(true);
            try {
              if (demo)
                await update((d) => {
                  d.profiles.find(
                    (p) => p.id === reset!.id,
                  )!.must_change_password = true;
                }, "Demo account flagged for password change");
              else {
                await edge("manage-user", {
                  action: "reset",
                  id: reset!.id,
                  password,
                });
                await refresh();
                toast.success("Temporary password reset.");
              }
              setReset(null);
              setPassword("");
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>
            Set a temporary password for <strong>{reset?.name}</strong>. Their
            next sign-in will require a new password.
          </p>
          <label>
            Temporary password
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={12}
              required
            />
          </label>
          <Button disabled={busy}>Reset password</Button>
        </form>
      </Modal>
    </>
  );
}
export function Assignments() {
  const { data, update } = useWorkspace(),
    [open, setOpen] = useState(false),
    [survey, setSurvey] = useState(""),
    [user, setUser] = useState(""),
    [quota, setQuota] = useState(100),
    [geo, setGeo] = useState("");
  return (
    <>
      <PageTitle
        eyebrow="RESEARCH IN MOTION"
        title="Survey assignments"
        description="Connect your field team to the right surveys and communities."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus size={15} />
            Assign survey
          </Button>
        }
      />
      <div className="card table-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Survey</th>
                <th>Field surveyor</th>
                <th>Coverage</th>
                <th>Progress</th>
                <th>Quota</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.assignments.map((a) => {
                const count = data.responses.filter(
                  (r) =>
                    r.survey_id === a.survey_id &&
                    r.surveyor_id === a.surveyor_id,
                ).length;
                return (
                  <tr key={a.id}>
                    <td>
                      <strong>
                        {data.surveys.find((s) => s.id === a.survey_id)
                          ?.title || "Unavailable survey"}
                      </strong>
                    </td>
                    <td>
                      {data.profiles.find((p) => p.id === a.surveyor_id)?.name}
                    </td>
                    <td>
                      {data.geographies.find((g) => g.id === a.geography_id)
                        ?.name || "Survey coverage"}
                    </td>
                    <td>
                      <div className="assignment-progress">
                        <span>{count} collected</span>
                        <div className="bar-track">
                          <div
                            style={{
                              width: `${Math.min(100, (count / a.quota) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>{a.quota}</td>
                    <td>
                      <button
                        aria-label="Remove assignment"
                        className="icon-button"
                        onClick={() => {
                          if (
                            confirm(
                              "Remove this assignment? Existing responses will remain.",
                            )
                          )
                            update((d) => {
                              d.assignments = d.assignments.filter(
                                (x) => x.id !== a.id,
                              );
                            }, "Assignment removed");
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!data.assignments.length && (
          <Empty
            title="Ready to start fieldwork?"
            description="Assign a published survey to an active field surveyor."
          />
        )}
      </div>
      <Modal
        title="Create a field assignment"
        open={open}
        onClose={() => setOpen(false)}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              data.assignments.some(
                (a) => a.survey_id === survey && a.surveyor_id === user,
              )
            )
              return toast.error(
                "This survey is already assigned to that surveyor.",
              );
            await update((d) => {
              d.assignments.push({
                id: crypto.randomUUID(),
                survey_id: survey,
                surveyor_id: user,
                quota,
                geography_id: geo || undefined,
              });
            }, "Survey assigned");
            setOpen(false);
          }}
        >
          <label>
            Published survey
            <select
              required
              value={survey}
              onChange={(e) => setSurvey(e.target.value)}
            >
              <option value="">Choose survey…</option>
              {data.surveys
                .filter((s) => s.status === "published")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Active field surveyor
            <select
              required
              value={user}
              onChange={(e) => setUser(e.target.value)}
            >
              <option value="">Choose surveyor…</option>
              {data.profiles
                .filter((p) => p.role === "surveyor" && p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Geographic coverage
            <select value={geo} onChange={(e) => setGeo(e.target.value)}>
              <option value="">All survey coverage</option>
              {data.geographies.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.level})
                </option>
              ))}
            </select>
          </label>
          <label>
            Response quota
            <input
              type="number"
              min="1"
              required
              value={quota}
              onChange={(e) => setQuota(Number(e.target.value))}
            />
          </label>
          <Button>Save assignment</Button>
        </form>
      </Modal>
    </>
  );
}
export function Responses({ own = false }: { own?: boolean }) {
  const { data, profile, demo } = useWorkspace(),
    [survey, setSurvey] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    [detail, setDetail] = useState<ResponseRecord | null>(null);
  const filtered = data.responses
      .filter(
        (r) =>
          (!own || r.surveyor_id === profile.id) &&
          (!survey || r.survey_id === survey) &&
          `${r.id} ${r.state} ${r.district}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    rows = filtered.slice(page * 15, page * 15 + 15);
  return (
    <>
      <PageTitle
        eyebrow="THE CONVERSATIONS BEHIND THE NUMBERS"
        title={own ? "Your survey history" : "Research responses"}
        description="Trace each interview to its survey version and collection context."
        action={
          !own && (
            <ExportButton
              name="authorized-research-data"
              rows={filtered.map((r) => ({
                ID: r.id,
                Survey: r.survey_id,
                Version: r.version,
                Surveyor: r.surveyor_id,
                Collected: r.created_at,
                State: r.state,
                District: r.district,
                Consent: r.consent,
                Status: r.status,
                Synthetic: r.synthetic,
                Answers: r.answers,
              }))}
            />
          )
        }
      />
      <div className="privacy-banner">
        <ShieldCheck size={17} />
        <span>
          {demo ? "Synthetic demo records" : "Authorized research records"}.
          Individual answers stay separate from aggregate dashboards. Submitted
          records are immutable.
        </span>
      </div>
      <div className="section-toolbar">
        <select
          value={survey}
          onChange={(e) => {
            setSurvey(e.target.value);
            setPage(0);
          }}
          aria-label="Filter survey"
        >
          <option value="">All surveys</option>
          {data.surveys.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <div className="search-input">
          <Search size={15} />
          <input
            placeholder="Search location or ID…"
            aria-label="Search responses"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
      </div>
      <div className="card table-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Response ID</th>
                <th>Collection date</th>
                <th>Geography</th>
                <th>Surveyor</th>
                <th>Version</th>
                <th>Consent / status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <code>{r.id.slice(0, 16)}</code>
                    {r.synthetic && (
                      <small className="synthetic-label">SYNTHETIC</small>
                    )}
                  </td>
                  <td>
                    {new Date(r.created_at).toLocaleDateString("en-IN")}
                    <small className="cell-sub">
                      {new Date(r.created_at).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  </td>
                  <td>
                    {r.district || "Not collected"}
                    <small className="cell-sub">{r.state}</small>
                  </td>
                  <td>
                    {data.profiles.find((p) => p.id === r.surveyor_id)?.name ||
                      profile.name}
                  </td>
                  <td>v{r.version}</td>
                  <td>
                    <Badge tone={r.consent ? "teal" : "gray"}>{r.status}</Badge>
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label="View response"
                      onClick={() => setDetail(r)}
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <Empty
            title="No responses found"
            description="Completed field interviews appear here after synchronization."
          />
        )}
        <div className="pagination">
          <span>
            {filtered.length} records · Page {page + 1} of{" "}
            {Math.max(1, Math.ceil(filtered.length / 15))}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!page}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={(page + 1) * 15 >= filtered.length}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
      <Modal
        title="Interview record"
        description="Read-only historical response, interpreted against its immutable survey version."
        open={!!detail}
        onClose={() => setDetail(null)}
        wide
      >
        {detail && (
          <>
            <Badge tone={detail.synthetic ? "orange" : "teal"}>
              {detail.synthetic ? "Synthetic sample" : "Research record"} · v
              {detail.version}
            </Badge>
            <div className="review-answers">
              {Object.entries(detail.answers).map(([key, value]) => (
                <div key={key}>
                  <span>
                    {data.surveys
                      .find((s) => s.id === detail.survey_id)
                      ?.published?.find((v) => v.version === detail.version)
                      ?.questions.find((q) => q.id === key)?.label || key}
                  </span>
                  <strong>
                    {typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value)}
                  </strong>
                </div>
              ))}
            </div>
            <p className="muted tiny">
              Validation: {detail.validation_status || "valid"} · Sync:{" "}
              {detail.sync_status || "synced"} · Collection mode: {detail.mode}
            </p>
          </>
        )}
      </Modal>
    </>
  );
}
export function GeographyPage() {
  const { data, update } = useWorkspace(),
    [open, setOpen] = useState(false),
    [editingId, setEditingId] = useState<string | null>(null),
    [form, setForm] = useState({
      name: "",
      level: "state",
      parent_id: "",
      code: "",
    }),
    [level, setLevel] = useState("all"),
    [error, setError] = useState("");
  const levels = [
    "country",
    "state",
    "district",
    "constituency",
    "locality",
    "ward",
  ];
  function validateGeo(g: Geography, all: Geography[]) {
    if (!g.name.trim() || !levels.includes(g.level))
      throw Error("Geography needs a valid name and level.");
    if (g.parent_id) {
      const parent = all.find((p) => p.id === g.parent_id);
      if (!parent || levels.indexOf(parent.level) >= levels.indexOf(g.level))
        throw Error(
          `${g.name}: parent must exist at an earlier hierarchy level.`,
        );
    } else if (!["country", "state"].includes(g.level))
      throw Error(`${g.name}: choose a parent.`);
  }
  async function importCSV(file: File) {
    try {
      const items = parseCSV(await file.text());
      if (!items.length) throw Error("CSV is empty.");
      const imported = items.map((i) => ({
        id: i.id || crypto.randomUUID(),
        name: i.name,
        level: i.level,
        parent_id: i.parent_id || null,
        code: i.code || undefined,
      }));
      const all = [...data.geographies, ...imported];
      if (new Set(all.map((g) => g.id)).size !== all.length)
        throw Error("Duplicate geography IDs.");
      for (const g of imported) validateGeo(g, all);
      await update((d) => {
        d.geographies.push(...imported);
      }, `${imported.length} geography records imported`);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="PUT YOUR RESEARCH IN CONTEXT"
        title="Geography"
        description="A flexible hierarchy for the communities your research serves."
        action={
          <>
            <label className="btn btn-outline import-label">
              <Upload size={15} />
              Import CSV
              <input
                type="file"
                accept=".csv"
                hidden
                onChange={(e) => {
                  if (e.target.files?.[0]) importCSV(e.target.files[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <Button
              onClick={() => {
                setEditingId(null);
                setForm({ name: "", level: "state", parent_id: "", code: "" });
                setOpen(true);
              }}
            >
              <Plus size={15} />
              Add location
            </Button>
          </>
        }
      />
      <div className="info-banner">
        <MapPin size={17} />
        <span>
          Country → State/UT → District → Constituency → City/Town/Village →
          Ward. Demo names are illustrative references without official codes.
          Import verified data for field use.
        </span>
      </div>
      {error && <div className="validation-alert">{error}</div>}
      <div className="section-toolbar">
        <select
          aria-label="Geography level"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
        >
          <option value="all">All hierarchy levels</option>
          {levels.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
        <Button
          variant="ghost"
          onClick={() =>
            download("geography-import-template", [
              {
                id: crypto.randomUUID(),
                name: "Example state",
                level: "state",
                parent_id: "",
                code: "",
              },
            ])
          }
        >
          <Download size={14} />
          CSV template
        </Button>
      </div>
      <div className="card table-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Location</th>
                <th>Level</th>
                <th>Parent</th>
                <th>Official code</th>
                <th>Reference ID</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.geographies
                .filter((g) => level === "all" || g.level === level)
                .map((g) => (
                  <tr key={g.id}>
                    <td>
                      <strong>{g.name}</strong>
                    </td>
                    <td>
                      <Badge>{g.level}</Badge>
                    </td>
                    <td>
                      {data.geographies.find((p) => p.id === g.parent_id)
                        ?.name || "Root level"}
                    </td>
                    <td>{g.code || "Not provided"}</td>
                    <td>
                      <code className="tiny">{g.id}</code>
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingId(g.id);
                          setForm({
                            name: g.name,
                            level: g.level,
                            parent_id: g.parent_id || "",
                            code: g.code || "",
                          });
                          setOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      <Modal
        title={
          editingId ? "Edit geographic reference" : "Add a geographic reference"
        }
        open={open}
        onClose={() => setOpen(false)}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const g = {
                ...form,
                id: editingId || crypto.randomUUID(),
                parent_id: form.parent_id || null,
              };
              const all = [
                ...data.geographies.filter((item) => item.id !== g.id),
                g,
              ];
              for (const item of all) validateGeo(item, all);
              await update(
                (d) => {
                  d.geographies = all;
                },
                editingId
                  ? "Geographic reference updated"
                  : "Geographic reference added",
              );
              setOpen(false);
              setForm({ name: "", level: "state", parent_id: "", code: "" });
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          <label>
            Location name
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Hierarchy level
            <select
              value={form.level}
              onChange={(e) =>
                setForm({ ...form, level: e.target.value, parent_id: "" })
              }
            >
              {levels.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label>
            Parent
            <select
              value={form.parent_id}
              onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
            >
              <option value="">No parent / root</option>
              {data.geographies
                .filter(
                  (g) => levels.indexOf(g.level) < levels.indexOf(form.level),
                )
                .map((g) => (
                  <option value={g.id} key={g.id}>
                    {g.name} ({g.level})
                  </option>
                ))}
            </select>
          </label>
          <label>
            Verified official code (optional)
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </label>
          <Button>
            {editingId
              ? "Save geographic reference"
              : "Add geographic reference"}
          </Button>
        </form>
      </Modal>
    </>
  );
}
export function SettingsPage() {
  const { data, update, demo, profile } = useWorkspace(),
    [organization, setOrganization] = useState(data.settings.organization),
    [min, setMin] = useState(data.settings.minSample),
    [income, setIncome] = useState(data.settings.incomeBands.join("\n")),
    [rules, setRules] = useState(JSON.stringify(data.classifiers, null, 2)),
    [clearing, setClearing] = useState(false);
  return (
    <>
      <PageTitle
        eyebrow="A WORKSPACE THAT WORKS FOR YOU"
        title="Workspace settings"
        description="Set the standards for responsible, consistent research."
      />
      <div className="two-column">
        <Card
          title="Research preferences"
          subtitle="Applied across your workspace"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await update((d) => {
                d.settings = {
                  organization,
                  minSample: min,
                  incomeBands: income.split("\n").filter(Boolean),
                };
              }, "Workspace settings saved");
            }}
          >
            <label>
              Organization name
              <input
                value={organization}
                required
                onChange={(e) => setOrganization(e.target.value)}
              />
            </label>
            <label>
              Minimum subgroup sample
              <input
                type="number"
                min={5}
                required
                value={min}
                onChange={(e) => setMin(Number(e.target.value))}
              />
              <small>
                Groups smaller than this are suppressed in aggregate views.
                Minimum: 5.
              </small>
            </label>
            <label>
              Monthly household income bands
              <textarea
                rows={6}
                value={income}
                onChange={(e) => setIncome(e.target.value)}
              />
              <small>
                One band per line. Changes apply to newly loaded templates.
              </small>
            </label>
            <Button>
              <Save size={15} />
              Save preferences
            </Button>
          </form>
        </Card>
        <Card
          title="Experimental issue classifier"
          subtitle="Transparent English and Hindi keyword rules"
        >
          <Badge tone="orange">Experimental · admin review required</Badge>
          <p className="muted">
            This dictionary suggests issue categories from open text. It does
            not infer political beliefs or use an AI API.
          </p>
          <textarea
            className="code-editor small"
            aria-label="Classification dictionary"
            value={rules}
            onChange={(e) => setRules(e.target.value)}
          />
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const parsed = JSON.parse(rules);
                if (
                  !Array.isArray(parsed) ||
                  parsed.some(
                    (r) =>
                      !r.id ||
                      !r.category ||
                      !Array.isArray(r.keywords) ||
                      r.keywords.some((k: unknown) => typeof k !== "string"),
                  )
                )
                  throw Error(
                    "Use category records with id, category and a keyword array.",
                  );
                await update((d) => {
                  d.classifiers = parsed;
                }, "Classification rules saved");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Save classifier rules
          </Button>
        </Card>
        <Card
          title="Synthetic demo data"
          subtitle="For development and demonstrations only"
        >
          <p className="muted">
            Reproducible seed: 2026. Synthetic interviews are labeled
            individually and never claimed as real public opinion.
          </p>
          <div className="stack-actions">
            <Button
              disabled={!demo}
              variant="outline"
              onClick={() => {
                if (
                  confirm(
                    "Replace the demo workspace with a fresh fixed-seed sample? Your demo edits will be replaced.",
                  )
                )
                  update(
                    (d) => Object.assign(d, generateDemo()),
                    "Synthetic demo workspace regenerated",
                  );
              }}
            >
              <RefreshCw size={15} />
              Regenerate demo workspace
            </Button>
            <Button variant="destructive" onClick={() => setClearing(true)}>
              <Trash2 size={15} />
              Clear synthetic responses
            </Button>
          </div>
          {!demo && (
            <p className="muted tiny">
              Production synthetic generation is intentionally disabled. Seed
              into a separate development project.
            </p>
          )}
        </Card>
        <Card
          title="Connection & integrations"
          subtitle="Built to grow at your pace"
        >
          <div className="settings-detail">
            <span>Data connection</span>
            <Badge tone={demo ? "orange" : "teal"}>
              {demo ? "Browser demo" : "Supabase"}
            </Badge>
          </div>
          <div className="settings-detail">
            <span>Survey links</span>
            <strong>Authenticated collection</strong>
          </div>
          <div className="settings-detail">
            <span>SMS / WhatsApp / IVR</span>
            <strong>Not configured</strong>
          </div>
          <p className="muted">
            External messaging requires a provider, credentials and a separate
            budget. This application does not send messages.
          </p>
          <div className="info-banner">
            <ShieldCheck size={18} />
            Authentication credentials are never stored in offline drafts.
          </div>
        </Card>
      </div>
      <ClassificationReview />
      <Modal
        title="Clear all synthetic responses?"
        description="Only records explicitly marked synthetic will be removed. Real research responses are preserved."
        open={clearing}
        onClose={() => setClearing(false)}
      >
        <p>
          {data.responses.filter((r) => r.synthetic).length} synthetic records
          will be deleted.
        </p>
        <div className="modal-actions">
          <Button variant="outline" onClick={() => setClearing(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              if (demo)
                await update((d) => {
                  d.responses = d.responses.filter((r) => !r.synthetic);
                }, "Synthetic responses cleared");
              else {
                await edge("clear-synthetic");
                location.reload();
              }
              setClearing(false);
            }}
          >
            Clear synthetic records
          </Button>
        </div>
      </Modal>
    </>
  );
}
function ClassificationReview() {
  const { data, demo, update } = useWorkspace(),
    [reviewed, setReviewed] = useState<Record<string, string>>({});
  const entries = data.responses
    .filter((r) => String(r.answers.other_issue || "").trim())
    .slice(0, 20);
  return (
    <Card
      title="Review suggested classifications"
      subtitle="Experimental suggestions from open-ended responses. No suggestion is treated as a verified finding."
    >
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Research text</th>
              <th>Keyword suggestions</th>
              <th>Admin review</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((r) => (
              <tr key={r.id}>
                <td>{String(r.answers.other_issue)}</td>
                <td>
                  {classify(
                    String(r.answers.other_issue),
                    data.classifiers,
                  ).join(", ") || "No match"}
                </td>
                <td>
                  <select
                    aria-label={`Review ${r.id}`}
                    value={reviewed[r.id] || ""}
                    onChange={async (e) => {
                      const category = e.target.value;
                      try {
                        if (demo)
                          await update((d) => {
                            d.audit.unshift({
                              id: crypto.randomUUID(),
                              actor: "Admin classifier review",
                              action: `${r.id}: ${category || "Unclassified"}`,
                              created_at: new Date().toISOString(),
                            });
                          }, "Classification reviewed");
                        else
                          await edge("review-classification", {
                            response_id: r.id,
                            category,
                          });
                        setReviewed({ ...reviewed, [r.id]: category });
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    <option value="">Unreviewed</option>
                    <option>No category</option>
                    {data.classifiers.map((c) => (
                      <option key={c.id}>{c.category}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
export function AuditLogs() {
  const { data } = useWorkspace(),
    [search, setSearch] = useState("");
  const rows = data.audit.filter((a) =>
    `${a.actor} ${a.action}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        eyebrow="ACCOUNTABILITY, BUILT IN"
        title="Audit trail"
        description="A clear record of the changes that shape your research."
        action={<ExportButton name="audit-trail" rows={rows} />}
      />
      <div className="section-toolbar">
        <span className="muted">
          Latest {data.audit.length} workspace events
        </span>
        <div className="search-input">
          <Search size={15} />
          <input
            aria-label="Search audit trail"
            placeholder="Search events…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="card table-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Event</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.created_at).toLocaleString("en-IN")}</td>
                  <td>
                    <strong>{a.actor}</strong>
                  </td>
                  <td>{a.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
export function SyncQueue() {
  const { profile, refresh } = useWorkspace(),
    [drafts, setDrafts] = useState<Draft[]>([]),
    [busy, setBusy] = useState(false);
  const load = async () =>
    setDrafts(
      (await localStore.drafts()).filter((d) => d.owner_id === profile.id),
    );
  useEffect(() => {
    load();
  }, [profile.id]);
  async function sync() {
    if (!navigator.onLine)
      return toast.error("You are offline. Reconnect before syncing.");
    setBusy(true);
    try {
      for (const d of drafts.filter(
        (d) => ["pending", "conflict"].includes(d.status) && d.response,
      )) {
        try {
          await submitResponse(d.response!);
          await localStore.saveDraft({
            ...d,
            status: "synced",
            error: undefined,
            response: { ...d.response!, sync_status: "synced" },
          });
        } catch (e) {
          await localStore.saveDraft({
            ...d,
            status: "conflict",
            error: (e as Error).message,
          });
        }
      }
      await load();
      await refresh();
      toast.success("Sync attempt finished. Review any unresolved conflicts.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="RELIABLE IN THE FIELD"
        title="Synchronization"
        description="Keep a clear view of interviews saved on this device."
        action={
          <Button disabled={busy} onClick={sync}>
            <CloudUpload size={16} />
            {busy ? "Synchronizing…" : "Sync pending interviews"}
          </Button>
        }
      />
      <div className="info-banner">
        Server rejections are kept as conflicts. Published versions, quotas,
        assignments and account permissions are rechecked when syncing.
        Submitted answers are never silently changed.
      </div>
      <div className="card table-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Interview</th>
                <th>Version</th>
                <th>Last saved</th>
                <th>Status</th>
                <th>Details</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {drafts.map((d) => (
                <tr key={d.id}>
                  <td>
                    <code>{d.id.slice(0, 8)}</code>
                  </td>
                  <td>v{d.version}</td>
                  <td>{new Date(d.updated_at).toLocaleString("en-IN")}</td>
                  <td>
                    <Badge
                      tone={
                        d.status === "synced"
                          ? "teal"
                          : d.status === "conflict"
                            ? "red"
                            : "orange"
                      }
                    >
                      {d.status}
                    </Badge>
                  </td>
                  <td>
                    {d.error ||
                      `${Object.keys(d.answers).length} answers saved`}
                  </td>
                  <td>
                    {d.status !== "synced" && (
                      <button
                        className="icon-button"
                        aria-label="Discard local interview"
                        onClick={async () => {
                          if (
                            confirm("Discard this local interview permanently?")
                          ) {
                            await localStore.deleteDraft(d.id);
                            load();
                          }
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!drafts.length && (
          <Empty
            title="All clear on this device"
            description="Drafts and queued submissions will appear here."
          />
        )}
      </div>
    </>
  );
}
