import type { Diet, Profile } from "../types/models";
import {
  ACTIVITIES,
  basalMetabolism,
  energyExpenditure,
} from "../core/strategy";
import { reportSettings } from "../core/report";
import { validateReportSettings } from "../core/validation";
import {
  bindForm,
  escapeHtml as e,
  formNumber,
  format,
  numberInput,
} from "./ui";

export function renderProfile(
  root: HTMLElement,
  diet: Diet,
  save: (profile: Profile, patientName: string) => void,
): void {
  const profile = diet.profile;
  root.innerHTML = `<div class="profile-layout"><div class="panel"><div class="panel-heading"><span class="step-label">01</span><div><h2>Vamos começar por você</h2><p>Esses dados são a base dos cálculos do seu plano.</p></div></div><form id="profile-form"><div class="field-grid"><label class="field span-2"><span>Nome da pessoa</span><input name="patientName" type="text" autocomplete="name" maxlength="120" required value="${e(reportSettings(diet).patientName)}" placeholder="Ex.: Ana Maria"></label><label class="field"><span>Sexo usado na fórmula</span><select name="sex"><option value="female" ${profile.sex === "female" ? "selected" : ""}>Feminino</option><option value="male" ${profile.sex === "male" ? "selected" : ""}>Masculino</option></select></label>${numberInput("age", "Idade (anos)", profile.age, 1, 120, "1")}${numberInput("weightKg", "Peso (kg)", profile.weightKg, 10, 500)}${numberInput("heightCm", "Altura (cm)", profile.heightCm, 50, 250)}<label class="field span-2"><span>Nível de atividade física</span><select name="activityFactor">${ACTIVITIES.map((a) => `<option value="${a.factor}" ${a.factor === profile.activityFactor ? "selected" : ""}>${a.label} · ${a.description}</option>`).join("")}</select></label></div><p data-form-error class="form-error" role="alert"></p><div class="form-footer"><span>Altere os dados e aplique para recalcular as metas.</span><button class="button primary" type="submit">Aplicar perfil <span aria-hidden="true">→</span></button></div></form></div><aside class="profile-aside"><span class="eyebrow">SEU PONTO DE PARTIDA</span><h2>Entenda sua energia.</h2><p>O metabolismo basal estima a energia em repouso. O nível de atividade transforma essa estimativa em gasto diário.</p><div class="energy-estimate"><span>Metabolismo basal</span><strong>${format(basalMetabolism(profile))}<small> kcal/dia</small></strong></div><div class="energy-estimate"><span>Gasto energético diário</span><strong>${format(energyExpenditure(profile))}<small> kcal/dia</small></strong></div><p class="subtle-note">Cálculos históricos da planilha original. Não constituem recomendação clínica individual.</p></aside></div>`;
  bindForm(root.querySelector("form")!, (data) => {
    const { patientName } = validateReportSettings({
      ...reportSettings(diet),
      patientName: data.get("patientName"),
    });
    if (!patientName) throw new Error("Informe o nome da pessoa.");
    const p: Profile = {
      sex: data.get("sex") as Profile["sex"],
      age: formNumber(data, "age"),
      weightKg: formNumber(data, "weightKg"),
      heightCm: formNumber(data, "heightCm"),
      activityFactor: formNumber(data, "activityFactor"),
    };
    basalMetabolism(p);
    save(p, patientName);
  });
}
