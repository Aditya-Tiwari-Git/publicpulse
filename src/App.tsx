import { useEffect, useState, type ReactNode } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import {
  Activity,
  LayoutDashboard,
  PenTool,
  ClipboardList,
  Users,
  UserCheck,
  MessageSquareText,
  ChartNoAxesCombined,
  PanelsTopLeft,
  MapPinned,
  Settings,
  ScrollText,
  Search,
  Bell,
  ChevronDown,
  ChevronsUpDown,
  LogOut,
  PanelLeft,
  HelpCircle,
  WifiOff,
  ShieldCheck,
  ArrowUpRight,
  ArrowLeft,
  KeyRound,
  RefreshCw,
  History,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { WorkspaceProvider, useWorkspace } from "./context";
import PublicSurvey from "./pages/PublicSurvey";
import { demoMode, login, logout, getProfile, edge } from "./lib/api";
import { demoAdmin } from "./lib/demo";
import type { Profile } from "./types";
import { Button } from "./components/ui/button";
import { Modal } from "./components/common";
import Dashboard from "./pages/Dashboard";
import Surveys from "./pages/Surveys";
import Builder from "./pages/Builder";
import Collection from "./pages/Collection";
import Analytics from "./pages/Analytics";
import DashboardBuilder from "./pages/DashboardBuilder";
import {
  UsersPage,
  Assignments,
  Responses,
  GeographyPage,
  SettingsPage,
  AuditLogs,
  SyncQueue,
} from "./pages/Management";
const client = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, refetchOnWindowFocus: false },
  },
});
const nav = [
  { label: "Overview", path: "/", icon: LayoutDashboard },
  { label: "Survey builder", path: "/builder", icon: PenTool },
  { label: "Surveys", path: "/surveys", icon: ClipboardList },
  { label: "Field team", path: "/users", icon: Users },
  { label: "Assignments", path: "/assignments", icon: UserCheck },
  { label: "Responses", path: "/responses", icon: MessageSquareText },
  { label: "Analytics", path: "/analytics", icon: ChartNoAxesCombined },
  { label: "Dashboard builder", path: "/dashboards", icon: PanelsTopLeft },
  { label: "Geography", path: "/geography", icon: MapPinned },
];
function Login({ onLogin }: { onLogin: (p: Profile) => void }) {
  const [role, setRole] = useState("admin"),
    [busy, setBusy] = useState(false);
  const schema = z.object({
    username: z.string().min(3, "Enter your assigned username."),
    password: z.string().min(1, "Enter your password."),
  });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });
  return (
    <div className="login-page">
      <div className="login-story">
        <div className="brand">
          <span className="brand-icon">
            <Activity size={26} />
          </span>
          <span>
            PublicPulse<span className="brand-dot">.</span>
          </span>
        </div>
        <div>
          <span className="eyebrow">RESEARCH WITH PURPOSE</span>
          <h1>
            A clearer picture.
            <br />
            One conversation
            <br />
            at a time.
          </h1>
          <p>
            Design thoughtful surveys. Empower your field team.
            <br />
            Understand what matters to your communities.
          </p>
          <div className="login-trust">
            <ShieldCheck />
            Private by design. Grounded in real voices.
          </div>
        </div>
        <small>PUBLIC OPINION & SENTIMENT INTELLIGENCE</small>
      </div>
      <div className="login-form">
        <div className="login-form-inner">
          <span className="eyebrow">WELCOME TO YOUR WORKSPACE</span>
          <h2>Let’s listen better.</h2>
          <p>Sign in to continue your research.</p>
          <div className="tabs">
            <button
              className={role === "admin" ? "active" : ""}
              onClick={() => setRole("admin")}
            >
              Administrator
            </button>
            <button
              className={role === "surveyor" ? "active" : ""}
              onClick={() => setRole("surveyor")}
            >
              Field surveyor
            </button>
          </div>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              setBusy(true);
              try {
                onLogin(await login(values.username, values.password, role));
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            })}
          >
            <label>
              Username
              <input
                {...form.register("username")}
                autoComplete="username"
                placeholder="Your assigned username"
              />
            </label>
            {form.formState.errors.username && (
              <p className="error">{form.formState.errors.username.message}</p>
            )}
            <label>
              Password
              <input
                {...form.register("password")}
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
              />
            </label>
            <button
              type="button"
              className="small-link forgot"
              onClick={async () => {
                const username = form.getValues("username");
                if (!username) return toast.info("Enter your username first.");
                try {
                  await edge("recover", { username });
                  toast.success(
                    "Reset request received. Contact your workspace administrator for a temporary password.",
                  );
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              Forgot password?
            </button>
            <Button type="submit" disabled={busy || demoMode} className="full">
              {busy ? "Signing in…" : "Sign in to workspace"}
              <ArrowUpRight size={16} />
            </Button>
          </form>
          {demoMode && (
            <div className="demo-login">
              <span className="badge badge-teal">SYNTHETIC SANDBOX</span>
              <p>
                Explore the complete workflow with reproducible sample data.
                Demo access does not authenticate with Supabase.
              </p>
              <Button
                variant="outline"
                className="full"
                onClick={() =>
                  onLogin(
                    role === "admin"
                      ? demoAdmin
                      : {
                          id: "demo-surveyor-0",
                          username: "field1",
                          name: "Priya Mehta",
                          role: "surveyor",
                          active: true,
                          must_change_password: false,
                        },
                  )
                }
              >
                Explore {role === "admin" ? "admin" : "surveyor"} demo{" "}
                <ArrowUpRight size={16} />
              </Button>
            </div>
          )}
          <p className="login-foot">
            Authorized research personnel only.
            <br />
            Need an account? Contact your workspace administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
function Guard({ children }: { children: ReactNode }) {
  const { profile } = useWorkspace();
  return profile.role === "admin" ? (
    children
  ) : (
    <Navigate to="/collection" replace />
  );
}
function PasswordChange() {
  const { profile, setProfile } = useWorkspace();
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="loading">
      <KeyRound size={32} />
      <h2>Set your own password</h2>
      <p>
        Your administrator has required a password change before workspace
        access.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (password !== confirm || password.length < 12)
            return toast.error(
              "Use matching passwords of at least 12 characters.",
            );
          setBusy(true);
          try {
            await edge("change-password", { password });
            setProfile({ ...profile, must_change_password: false });
            toast.success("Password changed.");
          } catch (e) {
            toast.error((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          New password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <Button disabled={busy}>Update password</Button>
      </form>
    </div>
  );
}
function Layout({ onLogout }: { onLogout: () => void }) {
  const { data, profile, demo } = useWorkspace(),
    navigate = useNavigate(),
    location = useLocation();
  const [mobile, setMobile] = useState(false),
    [search, setSearch] = useState(""),
    [searchOpen, setSearchOpen] = useState(false),
    [help, setHelp] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    [notifications, setNotifications] = useState(false);
  useEffect(() => {
    const yes = () => setOnline(true),
      no = () => setOnline(false);
    window.addEventListener("online", yes);
    window.addEventListener("offline", no);
    return () => {
      window.removeEventListener("online", yes);
      window.removeEventListener("offline", no);
    };
  }, []);
  if (profile.must_change_password) return <PasswordChange />;
  const items =
    profile.role === "admin"
      ? nav
      : [
          { label: "My surveys", path: "/collection", icon: ClipboardList },
          { label: "Survey history", path: "/history", icon: History },
          { label: "Synchronization", path: "/sync", icon: RefreshCw },
        ];
  return (
    <div className="app-shell">
      {mobile && (
        <div className="sidebar-scrim" onClick={() => setMobile(false)} />
      )}
      <aside className={`sidebar ${mobile ? "sidebar-open" : ""}`}>
        <NavLink
          to={profile.role === "admin" ? "/" : "/collection"}
          className="brand"
        >
          <span className="brand-icon">
            <Activity size={25} strokeWidth={2} />
          </span>
          <span>
            PublicPulse<span className="brand-dot">.</span>
            <small>LISTEN. UNDERSTAND. ACT.</small>
          </span>
        </NavLink>
        <button className="workspace-switch" onClick={() => setHelp(true)}>
          <span className="workspace-avatar">PR</span>
          <span>
            {data.settings.organization}
            <small>{demo ? "Demo workspace" : "Research workspace"}</small>
          </span>
          <ChevronsUpDown size={14} />
        </button>
        <span className="nav-caption">WORKSPACE</span>
        <nav>
          {items.map((item) => (
            <NavLink
              key={item.path}
              end={item.path === "/"}
              to={item.path}
              onClick={() => setMobile(false)}
              className={({ isActive }) =>
                `nav-item ${isActive ? "nav-active" : ""}`
              }
            >
              <item.icon size={17} />
              {item.label}
              {item.path === "/surveys" && (
                <span className="nav-count">{data.surveys.length}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-lower">
          {profile.role === "admin" && (
            <>
              <span className="nav-caption">ADMINISTRATION</span>
              <NavLink to="/settings" className="nav-item">
                <Settings size={17} />
                Settings
              </NavLink>
              <NavLink to="/audit" className="nav-item">
                <ScrollText size={17} />
                Audit logs
              </NavLink>
            </>
          )}
          <div className="help-card">
            <span className="help-icon">
              <HelpCircle size={17} />
            </span>
            <strong>Good research starts here.</strong>
            <p>A little guidance for a bigger impact.</p>
            <button onClick={() => setHelp(true)}>
              Explore the field guide <ArrowUpRight size={13} />
            </button>
          </div>
          <button
            className="profile-switch"
            onClick={onLogout}
            title="Sign out"
          >
            <span className="avatar">
              {profile.name
                .split(" ")
                .map((x) => x[0])
                .join("")}
            </span>
            <span>
              <strong>{profile.name}</strong>
              <small>
                {profile.role === "admin" ? "Administrator" : "Field surveyor"}
              </small>
            </span>
            <LogOut size={15} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
            >
              <PanelLeft size={20} />
            </button>
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>
              {items.find((i) => i.path === location.pathname)?.label ||
                {
                  "/settings": "Settings",
                  "/audit": "Audit logs",
                  "/history": "Survey history",
                  "/sync": "Synchronization",
                }[location.pathname] ||
                "Workspace"}
            </strong>
          </div>
          <div className="topbar-actions">
            <button
              className="search-launch"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={16} />
              <span>Search workspace…</span>
              <kbd>⌕</kbd>
            </button>
            <span className="topbar-divider" />
            {demo && (
              <span className="demo-indicator">
                <i />
                Demo mode
              </span>
            )}
            {!online && (
              <span className="offline-indicator">
                <WifiOff size={14} />
                Offline
              </span>
            )}
            <button
              className="notification-button"
              aria-label="Notifications"
              onClick={() => setNotifications(true)}
            >
              <Bell size={19} />
              <i />
            </button>
            <span className="avatar top-avatar">
              {profile.name
                .split(" ")
                .map((s) => s[0])
                .join("")}
            </span>
          </div>
        </header>
        <main className="main-content">
          <Routes>
            <Route
              path="/"
              element={
                profile.role === "admin" ? (
                  <Dashboard />
                ) : (
                  <Navigate to="/collection" replace />
                )
              }
            />
            <Route
              path="/builder"
              element={
                <Guard>
                  <Builder />
                </Guard>
              }
            />
            <Route
              path="/surveys"
              element={
                <Guard>
                  <Surveys />
                </Guard>
              }
            />
            <Route
              path="/users"
              element={
                <Guard>
                  <UsersPage />
                </Guard>
              }
            />
            <Route
              path="/assignments"
              element={
                <Guard>
                  <Assignments />
                </Guard>
              }
            />
            <Route
              path="/responses"
              element={
                <Guard>
                  <Responses />
                </Guard>
              }
            />
            <Route
              path="/analytics"
              element={
                <Guard>
                  <Analytics />
                </Guard>
              }
            />
            <Route
              path="/dashboards"
              element={
                <Guard>
                  <DashboardBuilder />
                </Guard>
              }
            />
            <Route
              path="/geography"
              element={
                <Guard>
                  <GeographyPage />
                </Guard>
              }
            />
            <Route
              path="/settings"
              element={
                <Guard>
                  <SettingsPage />
                </Guard>
              }
            />
            <Route
              path="/audit"
              element={
                <Guard>
                  <AuditLogs />
                </Guard>
              }
            />
            <Route path="/collection" element={<Collection />} />
            <Route path="/collect/:surveyId" element={<Collection />} />
            <Route path="/history" element={<Responses own />} />
            <Route path="/sync" element={<SyncQueue />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <Modal
        title="Search your workspace"
        description="Find a survey or open a workspace module."
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      >
        <input
          autoFocus
          placeholder="Search surveys, analytics, team…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="search-results">
          {[
            ...items.map((i) => ({ name: i.label, path: i.path })),
            ...data.surveys.map((s) => ({
              name: s.title,
              path:
                profile.role === "admin"
                  ? `/builder?survey=${s.id}`
                  : `/collect/${s.id}`,
            })),
          ]
            .filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
            .map((i) => (
              <button
                key={i.name}
                onClick={() => {
                  navigate(i.path);
                  setSearchOpen(false);
                  setSearch("");
                }}
              >
                {i.name}
                <ArrowUpRight size={15} />
              </button>
            ))}
        </div>
      </Modal>
      <Modal
        title="A practical field guide"
        open={help}
        onClose={() => setHelp(false)}
      >
        <div className="prose">
          <p>
            1. Create a survey from the bilingual India template, or start a
            blank survey. Add questions and validate your branching rules before
            publishing.
          </p>
          <p>
            2. Create field accounts and assign published surveys with clear
            geographic coverage and quotas.
          </p>
          <p>
            3. Ask for consent before collecting answers. Explain that
            participation is voluntary, and record responses neutrally.
          </p>
          <p>
            4. Drafts save automatically on this device. Offline submissions
            stay in Synchronization until the server accepts them. Conflicts
            need your review.
          </p>
          <p>
            5. Analytics reflect collected, unweighted responses. Small groups
            are suppressed. A convenience sample does not represent all
            residents.
          </p>
        </div>
      </Modal>
      <Modal
        title="Workspace activity"
        open={notifications}
        onClose={() => setNotifications(false)}
      >
        <div className="notification-list">
          {data.audit.slice(0, 6).map((a) => (
            <div key={a.id}>
              <span className="legend-dot" />
              <div>
                <strong>{a.action}</strong>
                <p>
                  {a.actor} · {new Date(a.created_at).toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
function Root() {
  const navigate = useNavigate(),
    location = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null),
    [checking, setChecking] = useState(!demoMode);
  useEffect(() => {
    if (!demoMode)
      getProfile()
        .then(setProfile)
        .catch(() => {})
        .finally(() => setChecking(false));
  }, []);
  if (checking)
    return (
      <div className="loading">
        <span className="loader" />
        Checking session…
      </div>
    );
  return profile ? (
    <WorkspaceProvider key={profile.id} initialProfile={profile}>
      <Layout
        onLogout={() => {
          logout();
          client.clear();
          setProfile(null);
        }}
      />
    </WorkspaceProvider>
  ) : (
    <Login
      onLogin={(p) => {
        setProfile(p);
        navigate(
          location.pathname.startsWith("/collect/")
            ? location.pathname
            : p.role === "admin"
              ? "/"
              : "/collection",
          { replace: true },
        );
      }}
    />
  );
}
export default function App() {
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Routes>
          <Route path="/survey/:token" element={<PublicSurvey />} />
          <Route path="*" element={<Root />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="bottom-right" />
    </QueryClientProvider>
  );
}
