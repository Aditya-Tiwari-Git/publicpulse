import type { Answers, Geography } from "../types.ts";
export function geographicReference(
  answers: Answers,
  geographies: Geography[],
): string {
  const state = geographies.find(
    (g) => g.level === "state" && g.name === answers.state,
  );
  if (!state) return "";
  let selected =
    geographies.find(
      (g) =>
        g.level === "district" &&
        g.name === answers.district &&
        g.parent_id === state.id,
    ) || state;
  const byId = new Map(geographies.map((g) => [g.id, g]));
  for (const level of ["constituency", "locality", "ward"]) {
    const candidate = geographies.find((g) => {
      if (g.level !== level || g.name !== answers[level]) return false;
      let parent = g.parent_id;
      const seen = new Set<string>();
      while (parent && !seen.has(parent)) {
        if (parent === selected.id) return true;
        seen.add(parent);
        parent = byId.get(parent)?.parent_id || null;
      }
      return false;
    });
    if (candidate) selected = candidate;
  }
  return selected.id;
}
