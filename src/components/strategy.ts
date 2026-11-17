import type { Diet, Goal, Strategy, StrategyMode } from "../types/models";
import {
  basalMetabolism,
  calculateStrategy,
  energyExpenditure,
  GOALS,
  targetEnergy,
} from "../core/strategy";
import { bindForm, formNumber, format, numberInput } from "./ui";
export function renderStrategy(
  root: HTMLElement,
  diet: Diet,
  save: (strategy: Strategy) => void,
): void {
  const s = diet.strategy;
  root.innerHTML = `<div class="panel strategy-panel"><div class="panel-heading"><span class="step-label">02</span><div><h2>Uma estratégia para o seu objetivo</h2><p>Escolha a meta e como deseja distribuir os macronutrientes.</p></div></div><form id="strategy-form"><fieldset class="goal-fieldset"><legend>Qual é seu objetivo?</legend><div class="goal-options">${(["bulking", "maintenance", "cutting"] as Goal[]).map((goal, i) => `<label class="goal-card"><input type="radio" name="goal" value="${goal}" ${s.goal === goal ? "checked" : ""}><span class="goal-icon" aria-hidden="true">${["↗", "↔", "↘"][i]}</span><strong>${GOALS[goal]}</strong><span>${["Gasto diário + 500 kcal", "Manter o gasto diário", "Gasto diário − 500 kcal"][i]}</span></label>`).join("")}</div></fieldset><div class="strategy-estimates"><div><span>Metabolismo basal</span><strong>${format(basalMetabolism(diet.profile))} <small>kcal</small></strong></div><div><span>Gasto energético</span><strong>${format(energyExpenditure(diet.profile))} <small>kcal</small></strong></div><div><span>Meta automática do objetivo</span><strong id="automatic-energy"></strong></div></div><div class="field-grid"><label class="field span-2"><span>Distribuição de macronutrientes</span><select name="mode"><option value="standard" ${s.mode === "standard" ? "selected" : ""}>Padrão da planilha · cálculo automático</option><option value="custom-percent" ${s.mode === "custom-percent" ? "selected" : ""}>Personalizada · percentuais (%)</option><option value="custom-grams" ${s.mode === "custom-grams" ? "selected" : ""}>Personalizada · gramas (g)</option></select></label></div><div id="custom-macros"></div><div id="strategy-preview" class="macro-preview"></div><p data-form-error class="form-error" role="alert"></p><div class="form-footer"><span>As metas são atualizadas ao aplicar a estratégia.</span><button class="button primary" type="submit">Aplicar estratégia →</button></div></form></div>`;
  const form = root.querySelector("form")!;
  const custom = root.querySelector<HTMLElement>("#custom-macros")!;
  const modeSelect = form.querySelector<HTMLSelectElement>('[name="mode"]')!;
  function goal(): Goal {
    return new FormData(form).get("goal") as Goal;
  }
  function mode(): StrategyMode {
    return modeSelect.value as StrategyMode;
  }
  function inputs(): void {
    const m = mode();
    const percent = m === "custom-percent";
    const sameMode = s.mode === m;
    const values =
      sameMode && !percent
        ? s
        : sameMode && percent
          ? {
              proteinG: ((s.proteinG * 4) / s.targetKcal) * 100,
              carbsG: ((s.carbsG * 4) / s.targetKcal) * 100,
              fatG: ((s.fatG * 9) / s.targetKcal) * 100,
            }
          : percent
            ? { proteinG: 25, carbsG: 45, fatG: 30 }
            : s;
    custom.innerHTML =
      m === "standard"
        ? '<div class="info-box">Lógica original: proteína por faixa calórica; gordura proporcional à proteína; carboidrato como energia restante.</div>'
        : `<div class="field-grid custom-fields">${percent ? numberInput("targetKcal", "Meta diária (kcal)", s.targetKcal, 1, 20000) : '<p class="span-2 info-box">A meta calórica será a soma da energia dos macros: proteínas × 4 + carboidratos × 4 + gorduras × 9.</p>'}${numberInput("proteinG", `Proteínas (${percent ? "%" : "g"})`, values.proteinG, 0, percent ? 100 : 5000)}${numberInput("carbsG", `Carboidratos (${percent ? "%" : "g"})`, values.carbsG, 0, percent ? 100 : 5000)}${numberInput("fatG", `Gorduras (${percent ? "%" : "g"})`, values.fatG, 0, percent ? 100 : 5000)}</div>`;
  }
  function calculate(): Strategy {
    const data = new FormData(form);
    return calculateStrategy(
      diet.profile,
      goal(),
      mode(),
      mode() === "standard"
        ? undefined
        : {
            targetKcal:
              mode() === "custom-percent"
                ? formNumber(data, "targetKcal")
                : undefined,
            macros: {
              proteinG: formNumber(data, "proteinG"),
              carbsG: formNumber(data, "carbsG"),
              fatG: formNumber(data, "fatG"),
            },
          },
    );
  }
  function preview(): void {
    const output = root.querySelector("#strategy-preview")!;
    try {
      root.querySelector("#automatic-energy")!.textContent =
        `${format(targetEnergy(diet.profile, goal()))} kcal`;
      const next = calculate();
      output.innerHTML = `<div><span>Meta diária</span><strong>${format(next.targetKcal)} <small>kcal</small></strong></div><div><span class="protein-dot">Proteínas</span><strong>${format(next.proteinG)} <small>g</small></strong></div><div><span class="carbs-dot">Carboidratos</span><strong>${format(next.carbsG)} <small>g</small></strong></div><div><span class="fat-dot">Gorduras</span><strong>${format(next.fatG)} <small>g</small></strong></div>`;
    } catch (error) {
      output.textContent =
        error instanceof Error ? error.message : "Confira os valores.";
    }
  }
  inputs();
  preview();
  modeSelect.addEventListener("change", () => {
    inputs();
    preview();
  });
  form.addEventListener("input", preview);
  bindForm(form, () => save(calculate()));
}
