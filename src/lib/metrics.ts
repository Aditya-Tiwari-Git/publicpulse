import type { Survey } from "../types";
export function metricOptions(surveys: Survey[], surveyId = "") {
  const options = new Map<string, string>([
    ["state", "State"],
    ["district", "District"],
  ]);
  for (const survey of surveys.filter((s) => !surveyId || s.id === surveyId)) {
    for (const question of survey.questions) {
      if (!["section", "instruction"].includes(question.type))
        options.set(question.id, question.label);
    }
    for (const version of survey.published || [])
      for (const question of version.questions) {
        if (
          !options.has(question.id) &&
          !["section", "instruction"].includes(question.type)
        )
          options.set(question.id, question.label);
      }
  }
  return [...options].map(([id, label]) => ({ id, label }));
}
