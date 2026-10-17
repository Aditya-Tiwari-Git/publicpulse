export type Role = "admin" | "surveyor";
export type Profile = {
  id: string;
  username: string;
  name: string;
  role: Role;
  active: boolean;
  must_change_password: boolean;
};
export type QuestionType =
  | "single"
  | "multi"
  | "dropdown"
  | "short"
  | "long"
  | "number"
  | "date"
  | "rating"
  | "likert"
  | "yesno"
  | "matrix"
  | "geography"
  | "section"
  | "instruction";
export type Operator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "in"
  | "not_in"
  | "is_empty"
  | "is_not_empty";
export type Condition = {
  question: string;
  operator: Operator;
  value?: unknown;
};
export type Rule = {
  id: string;
  logic: "AND" | "OR";
  conditions: Condition[];
  action: "show" | "hide" | "skip" | "end";
  target: string;
};
export type Question = {
  id: string;
  type: QuestionType;
  label: string;
  hi: string;
  help?: string;
  required: boolean;
  options?: string[];
  optionsHi?: string[];
  default?: unknown;
  min?: number;
  max?: number;
  section: string;
  rows?: string[];
  requiredWhen?: Condition[];
};
export type Survey = {
  id: string;
  title: string;
  description: string;
  status: "draft" | "published" | "archived";
  version: number;
  questions: Question[];
  rules: Rule[];
  created_at: string;
  start?: string;
  end?: string;
  quota?: number;
  coverage?: string[];
  published?: SurveyVersion[];
};
export type SurveyVersion = {
  id: string;
  version: number;
  questions: Question[];
  rules: Rule[];
  created_at: string;
};
export type Answers = Record<string, unknown>;
export type ResponseRecord = {
  id: string;
  survey_id: string;
  version: number;
  surveyor_id: string;
  created_at: string;
  geography: string;
  state: string;
  district: string;
  mode: string;
  answers: Answers;
  consent: boolean;
  status: "completed" | "declined";
  synthetic: boolean;
  validation_status?: string;
  sync_status?: string;
};
export type Geography = {
  id: string;
  name: string;
  level: string;
  parent_id: string | null;
  code?: string;
};
export type Assignment = {
  id: string;
  survey_id: string;
  surveyor_id: string;
  quota: number;
  geography_id?: string;
};
export type Widget = {
  id: string;
  title: string;
  type:
    | "kpi"
    | "bar"
    | "horizontal"
    | "donut"
    | "line"
    | "stacked"
    | "trend"
    | "table"
    | "severity"
    | "geography"
    | "heatmap";
  metric: string;
  width: "half" | "full";
  aggregation: "count" | "percent";
  dimension?: string;
  filter?: string;
};
export type DashboardConfig = {
  id: string;
  title: string;
  published: boolean;
  widgets: Widget[];
};
export type Classification = {
  id: string;
  category: string;
  keywords: string[];
};
export type Audit = {
  id: string;
  actor: string;
  action: string;
  created_at: string;
};
export type AppData = {
  surveys: Survey[];
  responses: ResponseRecord[];
  profiles: Profile[];
  geographies: Geography[];
  assignments: Assignment[];
  dashboards: DashboardConfig[];
  classifiers: Classification[];
  audit: Audit[];
  settings: { minSample: number; organization: string; incomeBands: string[] };
};
export type Draft = {
  id: string;
  owner_id: string;
  survey_id: string;
  version: number;
  answers: Answers;
  step: number;
  updated_at: string;
  status: "draft" | "pending" | "conflict" | "synced";
  response?: ResponseRecord;
  error?: string;
};
