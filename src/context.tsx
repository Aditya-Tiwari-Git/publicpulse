import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AppData, Profile } from "./types";
import { loadData, saveData, demoMode } from "./lib/api";
import { demoAdmin } from "./lib/demo";
type Context = {
  data: AppData;
  profile: Profile;
  setProfile: (p: Profile) => void;
  update: (fn: (d: AppData) => void, action: string) => Promise<void>;
  refresh: () => Promise<void>;
  demo: boolean;
};
const Workspace = createContext<Context | null>(null);
export function WorkspaceProvider({
  children,
  initialProfile,
}: {
  children: ReactNode;
  initialProfile: Profile;
}) {
  const [profile, setProfile] = useState(initialProfile),
    client = useQueryClient();
  const query = useQuery({
    queryKey: ["workspace", profile.id],
    queryFn: loadData,
    retry: 1,
    enabled: !profile.must_change_password,
  });
  if (!profile.must_change_password && query.isLoading)
    return (
      <div className="loading">
        <span className="loader" />
        Preparing your research workspace…
      </div>
    );
  if (!profile.must_change_password && (query.isError || !query.data))
    return (
      <div className="loading">
        <h2>Couldn’t open the workspace</h2>
        <p>{String(query.error)}</p>
        <button className="btn btn-primary" onClick={() => query.refetch()}>
          Try again
        </button>
      </div>
    );
  const update = async (fn: (d: AppData) => void, action: string) => {
    const next = structuredClone(query.data!);
    fn(next);
    next.audit.unshift({
      id: crypto.randomUUID(),
      actor: profile.name,
      action,
      created_at: new Date().toISOString(),
    });
    try {
      await saveData(next);
      client.setQueryData(["workspace", profile.id], next);
      toast.success(action);
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    }
  };
  const empty: AppData = {
    surveys: [],
    responses: [],
    profiles: [],
    geographies: [],
    assignments: [],
    dashboards: [],
    classifiers: [],
    audit: [],
    settings: {
      minSample: 5,
      organization: "PublicPulse Research",
      incomeBands: [],
    },
  };
  return (
    <Workspace.Provider
      value={{
        data: query.data || empty,
        profile,
        setProfile,
        update,
        refresh: async () => {
          await query.refetch();
        },
        demo: demoMode,
      }}
    >
      {children}
    </Workspace.Provider>
  );
}
export function useWorkspace() {
  const ctx = useContext(Workspace);
  if (!ctx) throw Error("Workspace unavailable");
  return ctx;
}
export { demoAdmin };
