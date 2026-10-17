import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import {
  SlidersHorizontal,
  ShieldCheck,
  Download,
  RotateCcw,
  Info,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
import { useWorkspace } from "../context";
import {
  PageTitle,
  Card,
  ExportButton,
  Badge,
  Empty,
} from "../components/common";
import { Button } from "../components/ui/button";
import { distribution } from "../lib/engine";
import { metricOptions } from "../lib/metrics";
import type { ResponseRecord, Widget } from "../types";
import { COLORS } from "./Dashboard";
export type Filters = {
  survey: string;
  from: string;
  to: string;
  state: string;
  district: string;
  constituency: string;
  rural_urban: string;
  age: string;
  income: string;
  occupation: string;
  priority: string;
};
export const blankFilters: Filters = {
  survey: "",
  from: "",
  to: "",
  state: "",
  district: "",
  constituency: "",
  rural_urban: "",
  age: "",
  income: "",
  occupation: "",
  priority: "",
};
export function filterResponses(rows: ResponseRecord[], f: Filters) {
  return rows.filter(
    (r) =>
      r.status === "completed" &&
      (!f.survey || r.survey_id === f.survey) &&
      (!f.from || r.created_at.slice(0, 10) >= f.from) &&
      (!f.to || r.created_at.slice(0, 10) <= f.to) &&
      (!f.state || r.state === f.state) &&
      (!f.district || r.district === f.district) &&
      [
        "constituency",
        "rural_urban",
        "age",
        "income",
        "occupation",
        "priority",
      ].every(
        (key) =>
          !f[key as keyof Filters] ||
          r.answers[key] === f[key as keyof Filters],
      ),
  );
}
export function FilterBar({
  filters: f,
  onChange,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const { data } = useWorkspace();
  const [expanded, setExpanded] = useState(false);
  function select(key: keyof Filters, label: string, options: string[]) {
    return (
      <label key={key}>
        {label}
        <select
          value={f[key]}
          onChange={(e) =>
            onChange({
              ...f,
              [key]: e.target.value,
              ...(key === "state" ? { district: "" } : {}),
            })
          }
        >
          <option value="">All {label.toLowerCase()}</option>
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <div className="filter-panel">
      <div className="filter-row">
        <label>
          Survey
          <select
            value={f.survey}
            onChange={(e) => onChange({ ...f, survey: e.target.value })}
          >
            <option value="">All surveys</option>
            {data.surveys.map((s) => (
              <option value={s.id} key={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        {select(
          "state",
          "States",
          data.geographies
            .filter((g) => g.level === "state")
            .map((g) => g.name),
        )}
        <label>
          From
          <input
            type="date"
            value={f.from}
            onChange={(e) => onChange({ ...f, from: e.target.value })}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={f.to}
            onChange={(e) => onChange({ ...f, to: e.target.value })}
          />
        </label>
        <Button variant="outline" onClick={() => setExpanded(!expanded)}>
          <SlidersHorizontal size={15} />
          {expanded ? "Fewer filters" : "More filters"}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Clear filters"
          onClick={() => onChange(blankFilters)}
        >
          <RotateCcw size={15} />
        </Button>
      </div>
      {expanded && (
        <div className="filter-row expanded-filters">
          {select(
            "district",
            "Districts",
            data.geographies
              .filter(
                (g) =>
                  g.level === "district" &&
                  (!f.state ||
                    g.parent_id ===
                      data.geographies.find((p) => p.name === f.state)?.id),
              )
              .map((g) => g.name),
          )}
          {select(
            "constituency",
            "Constituency",
            data.geographies
              .filter((g) => g.level === "constituency")
              .map((g) => g.name),
          )}
          {(
            ["rural_urban", "age", "income", "occupation", "priority"] as const
          ).map((key) =>
            select(
              key,
              {
                rural_urban: "Area type",
                age: "Age bracket",
                income: "Income band",
                occupation: "Occupation",
                priority: "Issue category",
              }[key],
              [
                ...new Set(
                  data.responses
                    .map((r) => String(r.answers[key] || ""))
                    .filter(Boolean),
                ),
              ],
            ),
          )}
        </div>
      )}
    </div>
  );
}
export function WidgetChart({
  widget: w,
  rows,
  minSample,
}: {
  widget: Widget;
  rows: ResponseRecord[];
  minSample: number;
}) {
  const metric =
    w.type === "geography"
      ? "state"
      : w.type === "severity"
        ? "severity"
        : w.metric;
  const filtered = w.filter
    ? rows.filter(
        (r) =>
          String(r.answers[w.dimension || "state"] ?? r.state) === w.filter,
      )
    : rows;
  const raw = distribution(filtered, metric, minSample);
  const grouped = raw.map((r) => ({
    ...r,
    count:
      w.aggregation === "percent" && r.count !== null
        ? Math.round((r.count / Math.max(filtered.length, 1)) * 100)
        : r.count,
  }));
  if (filtered.length < minSample)
    return (
      <Empty
        title="Insufficient sample"
        description={`At least ${minSample} responses are needed. n = ${filtered.length}`}
      />
    );
  if (w.type === "kpi")
    return (
      <div className="widget-kpi">
        <strong>{filtered.length}</strong>
        <span>completed responses · n = {filtered.length}</span>
      </div>
    );
  if (["table", "geography"].includes(w.type))
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Group</th>
              <th>{w.aggregation === "percent" ? "Percent" : "Responses"}</th>
              <th>Sample protection</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((g) => (
              <tr key={g.name}>
                <td>{g.name}</td>
                <td>{g.count ?? "—"}</td>
                <td>{g.suppressed ? "Suppressed" : "Minimum met"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  if (w.type === "heatmap")
    return (
      <div className="heatmap">
        {grouped.map((g) => (
          <div
            key={g.name}
            style={{
              background:
                g.count === null
                  ? "#f3f5f4"
                  : `rgba(24,135,114,${0.08 + (g.count / Math.max(...grouped.map((r) => r.count || 0), 1)) * 0.65})`,
            }}
          >
            <span>{g.name}</span>
            <strong>{g.count ?? "Suppressed"}</strong>
          </div>
        ))}
      </div>
    );
  const chartData = grouped.filter((g) => g.count !== null);
  if (w.type === "donut")
    return (
      <div className="widget-chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="name"
              innerRadius={55}
              outerRadius={86}
              paddingAngle={3}
              stroke="none"
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend
              iconType="circle"
              iconSize={7}
              wrapperStyle={{ fontSize: 10 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  if (w.type === "line" || w.type === "trend") {
    const dates = [
      ...new Set(filtered.map((r) => r.created_at.slice(0, 10))),
    ].sort();
    const series = dates.map((date) => {
      const n = filtered.filter((r) => r.created_at.startsWith(date)).length;
      return { date, count: n < minSample ? null : n };
    });
    return (
      <div className="widget-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series}>
            <CartesianGrid stroke="#edf0f2" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={25} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Line
              dataKey="count"
              stroke="#198777"
              strokeWidth={2}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }
  if (w.type === "stacked") {
    const dimension = w.dimension || "rural_urban";
    const groups = distribution(filtered, dimension, minSample);
    const names = [
      ...new Set(
        filtered.map((r) => String(r.answers[metric] || "Not answered")),
      ),
    ];
    const stacked = groups.map((g) => {
      const bucket = filtered.filter(
        (r) => String(r.answers[dimension] || "Not answered") === g.name,
      );
      return Object.assign(
        { name: g.name },
        ...names.map((n) => {
          const count = bucket.filter(
            (r) => String(r.answers[metric] || "Not answered") === n,
          ).length;
          return { [n]: count < minSample ? null : count };
        }),
      );
    });
    return (
      <div className="widget-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stacked}>
            <CartesianGrid vertical={false} stroke="#edf0f2" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {names.map((n, i) => (
              <Bar
                key={n}
                dataKey={n}
                stackId="a"
                fill={COLORS[i % COLORS.length]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }
  return (
    <div className="widget-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout={w.type === "horizontal" ? "vertical" : "horizontal"}
          margin={{
            left: w.type === "horizontal" ? 25 : 0,
            right: 20,
            bottom: 20,
          }}
        >
          <CartesianGrid stroke="#edf0f2" vertical={false} />
          {w.type === "horizontal" ? (
            <>
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={95}
                tick={{ fontSize: 10 }}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                interval={0}
                angle={-15}
                textAnchor="end"
              />
              <YAxis tick={{ fontSize: 10 }} />
            </>
          )}
          <Tooltip />
          <Bar
            dataKey="count"
            fill="#268d79"
            radius={[4, 4, 0, 0]}
            barSize={24}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export default function Analytics() {
  const { data, demo } = useWorkspace(),
    [filters, setFilters] = useState<Filters>(blankFilters),
    [metric, setMetric] = useState("priority"),
    [cross, setCross] = useState("rural_urban");
  const rows = useMemo(
      () => filterResponses(data.responses, filters),
      [data.responses, filters],
    ),
    min = data.settings.minSample,
    distributionRows = distribution(rows, metric, min);
  const answered = rows.filter(
    (r) =>
      r.answers[metric] != null &&
      r.answers[metric] !== "" &&
      (!Array.isArray(r.answers[metric]) ||
        (r.answers[metric] as unknown[]).length),
  ).length;
  const crossGroups = distribution(rows, cross, min),
    values = distributionRows.map((r) => r.name);
  const compare =
    filters.from && filters.to
      ? (() => {
          const start = new Date(filters.from).getTime(),
            end = new Date(filters.to).getTime(),
            duration = end - start + 86400000;
          return filterResponses(data.responses, {
            ...filters,
            from: new Date(start - duration).toISOString().slice(0, 10),
            to: new Date(start - 86400000).toISOString().slice(0, 10),
          }).length;
        })()
      : null;
  const widget = (
    title: string,
    type: Widget["type"],
    metric: string,
    dimension?: string,
  ): Widget => ({
    id: title,
    title,
    type,
    metric,
    width: "half",
    aggregation: "count",
    dimension,
  });
  return (
    <>
      <PageTitle
        eyebrow="FROM RESPONSES TO PERSPECTIVE"
        title="Research analytics"
        description="Explore the patterns behind your conversations, with context and care."
        action={
          <ExportButton
            name="publicpulse-aggregate"
            rows={distributionRows.map((r) => ({
              Group: r.name,
              Responses: r.count ?? "Suppressed",
              Sample: rows.length,
              Synthetic: demo,
            }))}
          />
        }
      />
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="privacy-banner">
        <ShieldCheck size={18} />
        <div>
          <strong>
            {demo ? "Synthetic research sample" : "Unweighted research sample"}
          </strong>
          <span>
            n = {rows.length} · Subgroups below {min} suppressed · These results
            do not establish population representativeness.
          </span>
        </div>
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <span>Completed responses</span>
          <strong>{rows.length}</strong>
          <small className="muted">Current selection</small>
        </div>
        <div className="stat-card">
          <span>Question answered</span>
          <strong>{answered}</strong>
          <small className="muted">
            {rows.length ? Math.round((answered / rows.length) * 100) : 0}%
            answered
          </small>
        </div>
        <div className="stat-card">
          <span>Missing answers</span>
          <strong>{rows.length - answered}</strong>
          <small className="muted">Includes optional or hidden questions</small>
        </div>
        <div className="stat-card">
          <span>Previous period</span>
          <strong>{compare === null ? "—" : compare}</strong>
          <small className="muted">
            {compare === null
              ? "Select from and to dates"
              : "Same-length preceding date range"}
          </small>
        </div>
      </div>
      <div className="section-toolbar">
        <h2 className="section-heading">Question-level insights</h2>
        <select
          aria-label="Question metric"
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
        >
          {metricOptions(data.surveys, filters.survey).map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="two-column">
        <Card
          title="Answer distribution"
          subtitle={`Multiple selections count individually · n = ${rows.length}`}
        >
          <WidgetChart
            widget={widget("Answers", "horizontal", metric)}
            rows={rows}
            minSample={min}
          />
        </Card>
        <Card
          title="A closer look"
          subtitle="Distribution across the current sample"
        >
          <WidgetChart
            widget={widget("Share", "donut", metric)}
            rows={rows}
            minSample={min}
          />
        </Card>
        <Card
          title="Collection over time"
          subtitle="Daily groups below the privacy minimum are omitted"
        >
          <WidgetChart
            widget={widget("Trend", "trend", metric)}
            rows={rows}
            minSample={min}
          />
        </Card>
        <Card
          title="Issue severity"
          subtitle="How serious respondents say their priority issue is"
        >
          <WidgetChart
            widget={widget("Severity", "severity", "severity")}
            rows={rows}
            minSample={min}
          />
        </Card>
      </div>
      <Card
        title="Cross-tabulation"
        subtitle="Each cell is independently protected by the sample minimum."
        action={
          <select
            aria-label="Cross-tab dimension"
            value={cross}
            onChange={(e) => setCross(e.target.value)}
          >
            {["rural_urban", "age", "income", "occupation", "state"].map(
              (k) => (
                <option key={k}>{k}</option>
              ),
            )}
          </select>
        }
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{cross}</th>
                {values.map((v) => (
                  <th key={v}>{v}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {crossGroups.map((g) => (
                <tr key={g.name}>
                  <td>{g.name}</td>
                  {values.map((v) => {
                    const n = rows.filter(
                      (r) =>
                        (cross === "state" ? r.state : r.answers[cross]) ===
                          g.name &&
                        (Array.isArray(r.answers[metric])
                          ? (r.answers[metric] as unknown[]).includes(v)
                          : (metric === "state"
                              ? r.state
                              : metric === "district"
                                ? r.district
                                : r.answers[metric]) === v),
                    ).length;
                    return (
                      <td key={v}>
                        {n < min ? (
                          <span className="suppressed">Suppressed</span>
                        ) : (
                          n
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
