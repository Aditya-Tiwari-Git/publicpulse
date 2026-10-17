import { createClient } from "@supabase/supabase-js";
import type { AppData, Profile, ResponseRecord } from "../types";
import { generateDemo } from "./demo";
import { localStore } from "./storage";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: true },
      })
    : null;
export const demoMode =
  import.meta.env.VITE_DEMO_MODE === "true" ||
  (!supabase && import.meta.env.DEV);
export async function edge<T>(
  action: string,
  payload: unknown = {},
): Promise<T> {
  if (!supabase) throw Error("Connect Supabase to use this feature.");
  const { data, error } = await supabase.functions.invoke("api", {
    body: { action, payload },
  });
  if (error) {
    const context = error.context;
    if (context instanceof Response) {
      const body = await context.json().catch(() => null);
      if (body?.error) throw Error(body.error);
    }
    throw error;
  }
  if (data?.error) throw Error(data.error);
  return data as T;
}
export async function loadData(): Promise<AppData> {
  if (demoMode) {
    let data = await localStore.get();
    if (!data) {
      data = generateDemo();
      await localStore.set(data);
    }
    return data;
  }
  const result = await edge<AppData>("workspace");
  return result;
}
export async function saveData(data: AppData) {
  if (demoMode) {
    await localStore.set(data);
    return;
  }
  await edge("save-workspace", data);
}
export async function login(
  username: string,
  password: string,
  role: string,
): Promise<Profile> {
  if (demoMode) throw Error("Demo uses the explicit sandbox entry buttons.");
  const result = await edge<{
    profile: Profile;
    access_token: string;
    refresh_token: string;
  }>("login", { username, password, role });
  const { error } = await supabase!.auth.setSession({
    access_token: result.access_token,
    refresh_token: result.refresh_token,
  });
  if (error) throw error;
  return result.profile;
}
export async function submitResponse(record: ResponseRecord) {
  if (demoMode) {
    const data = await loadData();
    if (!data.responses.some((r) => r.id === record.id)) {
      data.responses.push(record);
      await saveData(data);
    }
    return;
  }
  await edge("submit-response", record);
}
export async function getProfile() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  return edge<Profile>("profile");
}
export async function logout() {
  if (supabase) await supabase.auth.signOut();
}
