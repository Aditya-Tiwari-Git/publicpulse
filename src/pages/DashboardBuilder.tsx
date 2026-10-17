import { useState } from "react";
import {
  Plus,
  Save,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  PanelsTopLeft,
  Globe,
  GripVertical,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "../context";
import { Button } from "../components/ui/button";
import {
  PageTitle,
  Card,
  Modal,
  Badge,
  ExportButton,
  Empty,
} from "../components/common";
import { validateWidget, distribution } from "../lib/engine";
import { metricOptions } from "../lib/metrics";
import {
  FilterBar,
  WidgetChart,
  blankFilters,
  filterResponses,
  type Filters,
} from "./Analytics";
import type { DashboardConfig, Widget } from "../types";
export default function DashboardBuilder() {
  const { data, update } = useWorkspace(),
    [config, setConfig] = useState<DashboardConfig>(
      structuredClone(
        data.dashboards[0] || {
          id: crypto.randomUUID(),
          title: "Untitled dashboard",
          published: false,
          widgets: [],
        },
      ),
    ),
    [editing, setEditing] = useState<Widget | null>(null),
    [filters, setFilters] = useState<Filters>(blankFilters),
    [dirty, setDirty] = useState(false),
    [drag, setDrag] = useState<number | null>(null);
  const rows = filterResponses(data.responses, filters);
  const change = (c: DashboardConfig) => {
    setConfig(c);
    setDirty(true);
  };
  async function save(publish = false) {
    if (!config.title.trim() || config.widgets.some((w) => !validateWidget(w)))
      return toast.error(
        "Give the dashboard and every widget a title and metric.",
      );
    const next = { ...config, published: publish || config.published };
    await update(
      (d) => {
        const i = d.dashboards.findIndex((x) => x.id === next.id);
        if (i < 0) d.dashboards.push(next);
        else d.dashboards[i] = next;
      },
      publish ? "Dashboard published" : "Dashboard layout saved",
    );
    setConfig(next);
    setDirty(false);
  }
  function move(from: number, to: number) {
    if (to < 0 || to >= config.widgets.length) return;
    const widgets = [...config.widgets];
    widgets.splice(to, 0, widgets.splice(from, 1)[0]);
    change({ ...config, widgets });
  }
  return (
    <>
      <PageTitle
        eyebrow="YOUR QUESTIONS. YOUR PERSPECTIVE."
        title="Dashboard studio"
        description="Bring the insights that matter together in one focused view."
        action={
          <>
            <Button variant="outline" onClick={() => save()}>
              <Save size={16} />
              {dirty ? "Save layout" : "Saved"}
            </Button>
            <Button onClick={() => save(true)}>
              <Globe size={15} />
              Publish dashboard
            </Button>
          </>
        }
      />
      <div className="builder-toolbar">
        <select
          aria-label="Dashboard"
          value={config.id}
          onChange={(e) => {
            if (dirty && !confirm("Discard unsaved layout changes?")) return;
            setConfig(
              structuredClone(
                data.dashboards.find((d) => d.id === e.target.value)!,
              ),
            );
            setDirty(false);
          }}
        >
          {!data.dashboards.some((d) => d.id === config.id) && (
            <option value={config.id}>New dashboard</option>
          )}
          {data.dashboards.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
        <Badge tone={config.published ? "teal" : "orange"}>
          {config.published ? "Published" : "Draft"}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            change({
              id: crypto.randomUUID(),
              title: "Untitled dashboard",
              published: false,
              widgets: [],
            })
          }
        >
          <Plus size={14} />
          New
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            change({
              ...structuredClone(config),
              id: crypto.randomUUID(),
              title: config.title + " (copy)",
              published: false,
              widgets: config.widgets.map((w) => ({
                ...w,
                id: crypto.randomUUID(),
              })),
            })
          }
        >
          <Copy size={14} />
          Duplicate
        </Button>
      </div>
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="section-toolbar">
        <input
          className="inline-title"
          aria-label="Dashboard title"
          value={config.title}
          onChange={(e) => change({ ...config, title: e.target.value })}
        />
        <div className="page-actions">
          <ExportButton
            name="dashboard-aggregate"
            rows={config.widgets.flatMap((w) =>
              distribution(rows, w.metric, data.settings.minSample).map(
                (g) => ({
                  Widget: w.title,
                  Group: g.name,
                  Count: g.count ?? "Suppressed",
                  Sample: rows.length,
                }),
              ),
            )}
          />
          <Button
            onClick={() =>
              setEditing({
                id: crypto.randomUUID(),
                title: "New insight",
                type: "bar",
                metric: "priority",
                width: "half",
                aggregation: "count",
                dimension: "rural_urban",
              })
            }
          >
            <Plus size={15} />
            Add widget
          </Button>
        </div>
      </div>
      <div className="info-banner">
        Aggregate views only · n = {rows.length} · Minimum subgroup:{" "}
        {data.settings.minSample}. Published dashboards remain inside this
        authorized workspace.
      </div>
      <div className="widget-grid">
        {config.widgets.map((w, i) => (
          <div
            key={w.id}
            className={`card widget-card widget-${w.width}`}
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (drag !== null) move(drag, i);
              setDrag(null);
            }}
          >
            <div className="card-heading">
              <h3>
                <GripVertical size={15} />
                {w.title}
              </h3>
              <div className="widget-actions">
                <button title="Move up" onClick={() => move(i, i - 1)}>
                  <ArrowUp size={13} />
                </button>
                <button title="Move down" onClick={() => move(i, i + 1)}>
                  <ArrowDown size={13} />
                </button>
                <button
                  title="Resize"
                  onClick={() =>
                    change({
                      ...config,
                      widgets: config.widgets.map((x) =>
                        x.id === w.id
                          ? {
                              ...x,
                              width: x.width === "half" ? "full" : "half",
                            }
                          : x,
                      ),
                    })
                  }
                >
                  <PanelsTopLeft size={14} />
                </button>
                <button
                  title="Configure"
                  onClick={() => setEditing(structuredClone(w))}
                >
                  <Settings2 size={14} />
                </button>
                <button
                  title="Remove"
                  onClick={() =>
                    change({
                      ...config,
                      widgets: config.widgets.filter((x) => x.id !== w.id),
                    })
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <WidgetChart
              widget={w}
              rows={rows}
              minSample={data.settings.minSample}
            />
            <div className="card-note">
              {w.metric} · {w.aggregation} · n = {rows.length}
            </div>
          </div>
        ))}
      </div>
      {!config.widgets.length && (
        <Empty
          title="A fresh perspective starts here"
          description="Add your first widget to bring your research into focus."
          action={
            <Button
              onClick={() =>
                setEditing({
                  id: crypto.randomUUID(),
                  title: "Responses",
                  type: "kpi",
                  metric: "priority",
                  width: "half",
                  aggregation: "count",
                })
              }
            >
              Add a widget
            </Button>
          }
        />
      )}
      <Modal
        title="Configure your insight"
        open={!!editing}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!validateWidget(editing))
                return toast.error("Choose a title, chart type and metric.");
              change({
                ...config,
                widgets: config.widgets.some((w) => w.id === editing.id)
                  ? config.widgets.map((w) =>
                      w.id === editing.id ? editing : w,
                    )
                  : [...config.widgets, editing],
              });
              setEditing(null);
            }}
          >
            <label>
              Widget title
              <input
                required
                value={editing.title}
                onChange={(e) =>
                  setEditing({ ...editing, title: e.target.value })
                }
              />
            </label>
            <div className="form-grid">
              <label>
                Chart type
                <select
                  value={editing.type}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      type: e.target.value as Widget["type"],
                    })
                  }
                >
                  {[
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
                  ].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label>
                Metric / Y dimension
                <select
                  value={editing.metric}
                  onChange={(e) =>
                    setEditing({ ...editing, metric: e.target.value })
                  }
                >
                  {metricOptions(data.surveys, filters.survey).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                X / grouping dimension
                <select
                  value={editing.dimension || "rural_urban"}
                  onChange={(e) =>
                    setEditing({ ...editing, dimension: e.target.value })
                  }
                >
                  {[
                    "rural_urban",
                    "age",
                    "income",
                    "occupation",
                    "state",
                    "district",
                  ].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label>
                Aggregation
                <select
                  value={editing.aggregation}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      aggregation: e.target.value as Widget["aggregation"],
                    })
                  }
                >
                  <option value="count">Count</option>
                  <option value="percent">Percent of respondents</option>
                </select>
              </label>
              <label>
                Width
                <select
                  value={editing.width}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      width: e.target.value as Widget["width"],
                    })
                  }
                >
                  <option value="half">Half width</option>
                  <option value="full">Full width</option>
                </select>
              </label>
              <label>
                Group equals (optional)
                <input
                  value={editing.filter || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, filter: e.target.value })
                  }
                  placeholder="e.g. Urban"
                />
              </label>
            </div>
            <div className="modal-actions">
              <Button
                variant="outline"
                type="button"
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button type="submit">Apply widget</Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
