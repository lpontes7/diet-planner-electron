import type { Diet, ReportSettings } from "../types/models";

export const DEFAULT_REPORT_SETTINGS: Readonly<ReportSettings> = Object.freeze({
  title: "",
  subtitle: "Planejamento alimentar",
  patientName: "",
  professionalName: "",
  contact: "",
  accentColor: "#246447",
  showUpdatedAt: true,
});

// Older diets keep working without a migration or a schema version change.
export function reportSettings(diet: Diet): ReportSettings {
  return { ...DEFAULT_REPORT_SETTINGS, ...diet.report };
}

export function reportTitle(diet: Diet): string {
  return reportSettings(diet).title || diet.name;
}
