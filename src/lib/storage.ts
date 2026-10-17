import { openDB } from "idb";
import type { AppData, Draft } from "../types";
const database = () =>
  openDB("publicpulse-v1", 1, {
    upgrade(db) {
      db.createObjectStore("workspace");
      db.createObjectStore("drafts", { keyPath: "id" });
    },
  });
export const localStore = {
  async get(): Promise<AppData | undefined> {
    return (await database()).get("workspace", "data");
  },
  async set(data: AppData) {
    await (await database()).put("workspace", data, "data");
  },
  async drafts(): Promise<Draft[]> {
    return (await database()).getAll("drafts");
  },
  async saveDraft(draft: Draft) {
    await (await database()).put("drafts", draft);
  },
  async deleteDraft(id: string) {
    await (await database()).delete("drafts", id);
  },
};
