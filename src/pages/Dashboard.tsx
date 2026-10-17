import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ArrowRight,
  ArrowUpRight,
  ClipboardList,
  FileCheck2,
  Users,
  CheckCircle2,
  CalendarDays,
  ChevronDown,
  Activity,
  MapPin,
  Plus,
  ArrowDownRight,
} from "lucide-react";
import { useWorkspace } from "../context";
import { Button } from "../components/ui/button";
import {
  Badge,
  Card,
  ExportButton,
  PageTitle,
  formatNumber,
  SmallLink,
} from "../components/common";
import { distribution } from "../lib/engine";
export const COLORS = [
  "#198777",
  "#58a996",
  "#a6cbbb",
  "#ead8a6",
  "#e6a786",
  "#ce786d",
];
export default function Dashboard() {
  const { data, profile, demo } = useWorkspace(),
    navigate = useNavigate();
  const [period, setPeriod] = useState("30"),
    [state, setState] = useState("All states");
  const responses = useMemo(
    () =>
      data.responses.filter(
        (r) =>
          r.status === "completed" &&
          (state === "All states" || r.state === state) &&
          Date.now() - new Date(r.created_at).getTime() <=
            Number(period) * 86400000,
      ),
    [data.responses, state, period],
  );
  const today = responses.filter(
    (r) =>
      new Date(r.created_at).toLocaleDateString() ===
      new Date().toLocaleDateString(),
  ).length;
  const trends = Array.from({ length: Number(period) }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - Number(period) + i + 1);
    return {
      date: date.toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
      }),
      Responses: responses.filter(
        (r) => new Date(r.created_at).toDateString() === date.toDateString(),
      ).length,
    };
  });
  const issueData = distribution(responses, "issues", data.settings.minSample)
      .filter((x) => x.count !== null)
      .slice(0, 5),
    sat = distribution(
      responses,
      "satisfaction",
      data.settings.minSample,
    ).filter((x) => x.count !== null),
    geo = distribution(responses, "state", data.settings.minSample).slice(0, 5);
  const satisfiedCount = responses.filter((r) =>
    ["Very satisfied", "Somewhat satisfied"].includes(
      String(r.answers.satisfaction),
    ),
  ).length;
  const satisfaction =
    responses.length >= data.settings.minSample &&
    satisfiedCount >= data.settings.minSample &&
    responses.length - satisfiedCount >= data.settings.minSample
      ? Math.round(
          (responses.filter((r) =>
            ["Very satisfied", "Somewhat satisfied"].includes(
              String(r.answers.satisfaction),
            ),
          ).length /
            responses.length) *
            100,
        )
      : null;
  const totalStarted = data.responses.length,
    completion = totalStarted
      ? Math.round(
          (data.responses.filter((r) => r.status === "completed").length /
            totalStarted) *
            100,
        )
      : 0;
  const stats = [
    {
      label: "Total responses",
      value: formatNumber(responses.length),
      note: `${today} collected today`,
      icon: ClipboardList,
      color: "teal",
    },
    {
      label: "Published surveys",
      value: String(
        data.surveys.filter((s) => s.status === "published").length,
      ).padStart(2, "0"),
      note: `${data.surveys.length} surveys in your workspace`,
      icon: FileCheck2,
      color: "blue",
    },
    {
      label: "Active surveyors",
      value: String(
        data.profiles.filter((p) => p.role === "surveyor" && p.active).length,
      ).padStart(2, "0"),
      note: "Authorized field representatives",
      icon: Users,
      color: "purple",
    },
    {
      label: "Completion rate",
      value: `${completion}%`,
      note: "Of completed and declined interviews",
      icon: CheckCircle2,
      color: "orange",
    },
  ];
  return (
    <>
      <PageTitle
        eyebrow="YOUR RESEARCH, AT A GLANCE"
        title="Overview"
        description={`Welcome back, ${profile.name.split(" ")[0]}. Here’s the pulse of your communities.`}
        action={
          <>
            <ExportButton
              rows={geo.map((g) => ({
                State: g.name,
                Responses: g.count ?? "Suppressed",
                Sample: responses.length,
                Synthetic: demo,
              }))}
            />
            <Button onClick={() => navigate("/builder?new=true")}>
              <Plus size={16} />
              Create survey
            </Button>
          </>
        }
      />
      <div className="hero-banner">
        <div className="hero-orb orb-one" />
        <div className="hero-orb orb-two" />
        <div className="hero-copy">
          <div className="hero-kicker">
            <span className="live-dot" /> LISTEN LOCALLY. UNDERSTAND
            COLLECTIVELY.
          </div>
          <h2>
            Every voice adds perspective.
            <br />
            Every insight moves us forward.
          </h2>
          <p>
            Turn everyday conversations into a clearer picture of your
            communities.
          </p>
          <button onClick={() => navigate("/analytics")}>
            Explore your insights <ArrowRight size={16} />
          </button>
        </div>
        <div className="pulse-visual" aria-hidden="true">
          <div className="pulse-ring ring1" />
          <div className="pulse-ring ring2" />
          <div className="pulse-ring ring3" />
          <div className="pulse-center">
            <Activity size={48} strokeWidth={1.5} />
          </div>
          <span className="bubble b1">
            <Users size={17} />
            <i />
            Community voices
          </span>
          <span className="bubble b2">
            <span className="live-dot" /> Connected communities
          </span>
          <span className="pulse-dot pd1" />
          <span className="pulse-dot pd2" />
          <span className="pulse-dot pd3" />
        </div>
      </div>
      <div className="section-toolbar">
        <div className="section-label">
          <span className="live-dot" />
          Research overview<span className="muted tiny">Updated just now</span>
        </div>
        <div className="filters">
          <select
            aria-label="Filter by state"
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            <option>All states</option>
            {[...new Set(data.responses.map((r) => r.state))]
              .sort()
              .map((s) => (
                <option key={s}>{s}</option>
              ))}
          </select>
          <div className="select-icon">
            <CalendarDays size={14} />
            <select
              aria-label="Date range"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>
        </div>
      </div>
      <div className="stats-grid">
        {stats.map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-top">
              <span>{s.label}</span>
              <span className={`stat-icon ${s.color}`}>
                <s.icon size={18} />
              </span>
            </div>
            <strong>{s.value}</strong>
            <div className="stat-foot">
              <span className="stat-change">
                <ArrowUpRight size={12} />
              </span>
              {s.note}
            </div>
          </div>
        ))}
      </div>
      <div className="dashboard-chart-grid">
        <Card
          title="Response collection"
          subtitle="A little more understanding, with every conversation."
          action={
            <span className="chart-legend">
              <i />
              Responses
            </span>
          }
        >
          <div className="chart-summary">
            <strong>{formatNumber(responses.length)}</strong>
            <span>responses in this period</span>
            <Badge tone="teal">{today} today</Badge>
          </div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trends}
                margin={{ top: 10, right: 15, left: -27, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1d927e" stopOpacity={0.23} />
                    <stop offset="100%" stopColor="#1d927e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="#edf0f2"
                  strokeDasharray="4 4"
                />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={44}
                  tick={{ fill: "#929da6", fontSize: 10 }}
                  dy={9}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#929da6", fontSize: 10 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid #e7edeb",
                    fontSize: 12,
                  }}
                />
                <Area
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="Responses"
                  stroke="#198777"
                  strokeWidth={2.4}
                  fill="url(#areaFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-footer">
            <span>
              <span className="legend-dot" /> Field collection activity
            </span>
            <SmallLink onClick={() => navigate("/responses")}>
              View responses
            </SmallLink>
          </div>
        </Card>
        <Card
          title="What matters most"
          subtitle="Top issues reported by respondents"
          action={
            <span className="icon-muted">
              <Activity size={17} />
            </span>
          }
        >
          <div className="issue-bars">
            {issueData.length ? (
              issueData.map((d, i) => (
                <div key={d.name} className="issue-row">
                  <div>
                    <span className="issue-rank">0{i + 1}</span>
                    <span>{d.name}</span>
                    <strong>
                      {Math.round(
                        (d.count! / Math.max(1, responses.length)) * 100,
                      )}
                      <small>%</small>
                    </strong>
                  </div>
                  <div className="bar-track">
                    <div
                      style={{
                        width: `${(d.count! / Math.max(...issueData.map((x) => x.count!))) * 100}%`,
                        background: [
                          "#258c7a",
                          "#55a390",
                          "#87b7a8",
                          "#bad3c5",
                          "#d7e5dc",
                        ][i],
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">No groups meet the minimum sample size.</p>
            )}
          </div>
          <div className="card-note">
            Multiple selections allowed · n = {responses.length}
          </div>
        </Card>
      </div>
      <div className="dashboard-bottom-grid">
        <Card
          title="Voices across regions"
          subtitle="Response distribution by state"
          action={
            <SmallLink onClick={() => navigate("/analytics")}>
              View all
            </SmallLink>
          }
        >
          <div className="geo-list">
            {geo.map((g, i) => (
              <div className="geo-item" key={g.name}>
                <span className="geo-icon">
                  <MapPin size={15} />
                </span>
                <span>
                  {g.name}
                  <small>
                    {g.suppressed
                      ? "Small sample — suppressed"
                      : `${Math.round(((g.count || 0) / Math.max(responses.length, 1)) * 100)}% of responses`}
                  </small>
                </span>
                <strong>
                  {g.count === null ? "—" : formatNumber(g.count)}
                </strong>
                <div className="mini-bar">
                  <i
                    style={{
                      width: `${((g.count || 0) / Math.max(...geo.map((x) => x.count || 0), 1)) * 100}%`,
                      opacity: 1 - i * 0.12,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card
          title="Public service satisfaction"
          subtitle="How communities feel about local services"
        >
          <div className="satisfaction-wrap">
            <div className="donut-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    isAnimationActive={false}
                    data={sat}
                    dataKey="count"
                    innerRadius={56}
                    outerRadius={74}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {sat.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-label">
                <strong>
                  {satisfaction === null ? "—" : `${satisfaction}%`}
                </strong>
                <span>satisfied</span>
              </div>
            </div>
            <div className="donut-legend">
              {sat.slice(0, 4).map((v, i) => (
                <div key={v.name}>
                  <i style={{ background: COLORS[i] }} />
                  <span>{v.name}</span>
                  <strong>
                    {Math.round(
                      (v.count! / Math.max(responses.length, 1)) * 100,
                    )}
                    %
                  </strong>
                </div>
              ))}
            </div>
          </div>
          <div className="card-note">
            Unweighted responses · n = {responses.length}
          </div>
        </Card>
        <Card
          title="From the field"
          subtitle="Recent collection activity"
          action={<span className="activity-live">LIVE</span>}
        >
          <div className="activity-list">
            {[...responses]
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .slice(0, 4)
              .map((r, i) => (
                <div key={r.id} className="activity-row">
                  <span className={`avatar avatar-${i % 3}`}>
                    {data.profiles
                      .find((p) => p.id === r.surveyor_id)
                      ?.name.split(" ")
                      .map((s) => s[0])
                      .join("") || "FS"}
                  </span>
                  <div>
                    <strong>
                      {data.profiles.find((p) => p.id === r.surveyor_id)
                        ?.name || "Field surveyor"}
                    </strong>
                    <p>
                      Collected a response in <b>{r.district}</b>
                    </p>
                    <small>
                      {new Date(r.created_at).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </small>
                  </div>
                  <CheckCircle2 size={14} className="text-teal" />
                </div>
              ))}
          </div>
          <SmallLink onClick={() => navigate("/responses")}>
            View all activity
          </SmallLink>
        </Card>
      </div>
      <div className="workspace-footer">
        <span>
          <span className="legend-dot" />
          Your data stays yours. Insights stay responsible.
        </span>
        <span>
          {demo
            ? "Synthetic demo data · Not real public opinion"
            : "Research sample · Not population estimates"}
          <span className="footer-divider">|</span>Min. subgroup size:{" "}
          {data.settings.minSample}
        </span>
      </div>
    </>
  );
}
