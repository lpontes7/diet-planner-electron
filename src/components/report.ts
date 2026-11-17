import type { Diet, Food } from "../types/models";
import {
  dayNutrition,
  itemNutrition,
  mealNutrition,
  NUTRIENTS,
} from "../core/nutrition";
import {
  ACTIVITIES,
  basalMetabolism,
  GOALS,
  targetEnergy,
} from "../core/strategy";
import { escapeHtml as e, compact as f } from "./ui";
import { reviewFood } from "../services/food-service";
import { reportSettings, reportTitle } from "../core/report";
import { macroLegendHtml, macroPieSvg } from "./macro-chart";

export function reportHtml(
  diet: Diet,
  foods: ReadonlyMap<string, Food>,
): string {
  const totals = dayNutrition(diet.meals, foods);
  const header = reportSettings(diet);
  const warnings = [
    ...new Set(
      diet.meals.flatMap((m) =>
        m.items.flatMap((item) => {
          const food = foods.get(item.foodId);
          return food
            ? reviewFood(food).map((reason) => `${food.name}: ${reason}`)
            : [`Alimento ${item.foodId} ausente do catálogo`];
        }),
      ),
    ),
  ];
  return `<article class="report-sheet"><header class="report-heading"><div class="report-heading-main">${header.subtitle ? `<p class="report-subtitle">${e(header.subtitle)}</p>` : ""}<h1>${e(reportTitle(diet))}</h1>${header.showUpdatedAt ? `<p class="report-updated">Atualizado em ${e(new Date(diet.updatedAt).toLocaleString("pt-BR"))}</p>` : ""}</div>${header.professionalName || header.contact ? `<div class="report-identity">${header.professionalName ? `<strong>${e(header.professionalName)}</strong>` : ""}${header.contact ? `<p>${e(header.contact)}</p>` : ""}</div>` : ""}</header>
  <svg class="report-accent" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 1" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="1" fill="${e(header.accentColor)}"/></svg>
  <div class="report-overview"><section class="report-profile" aria-label="Dados pessoais"><h2>DADOS PESSOAIS</h2><dl><div><dt>Nome</dt><dd>${e(header.patientName || "Não informado")}</dd></div><div><dt>Sexo</dt><dd>${diet.profile.sex === "female" ? "Feminino" : "Masculino"}</dd></div><div><dt>Idade</dt><dd>${diet.profile.age} anos</dd></div><div><dt>Altura</dt><dd>${f(diet.profile.heightCm)} cm</dd></div><div><dt>Peso</dt><dd>${f(diet.profile.weightKg)} kg</dd></div><div><dt>Atividade física</dt><dd>${ACTIVITIES.find((a) => a.factor === diet.profile.activityFactor)?.label ?? ""}</dd></div><div><dt>Objetivo</dt><dd>${GOALS[diet.strategy.goal]}</dd></div><div><dt>TMB</dt><dd>${f(basalMetabolism(diet.profile), 2)} kcal</dd></div><div><dt>Meta automática do objetivo</dt><dd>${f(targetEnergy(diet.profile, diet.strategy.goal))} kcal</dd></div></dl></section><div class="report-chart">${macroPieSvg(diet.strategy)}</div>${macroLegendHtml(diet.strategy)}</div>
  <table class="report-summary"><thead><tr><th>Resumo diário</th><th>Energia (kcal)</th><th>Proteínas (g)</th><th>Carboidratos (g)</th><th>Gorduras (g)</th></tr></thead><tbody><tr><th>Meta</th><td>${f(diet.strategy.targetKcal)}</td><td>${f(diet.strategy.proteinG)}</td><td>${f(diet.strategy.carbsG)}</td><td>${f(diet.strategy.fatG)}</td></tr><tr><th>Planejado</th>${NUTRIENTS.map((k) => `<td>${f(totals[k])}</td>`).join("")}</tr></tbody></table>
  ${diet.meals
    .map((meal, index) => {
      const total = mealNutrition(meal, foods);
      return `<section class="report-meal"><h2>${index + 1}. ${e(meal.name)} <span>${e(meal.time)}</span></h2><table><thead><tr><th>Alimento</th><th>Qtd. (g)</th><th>kcal</th><th>P (g)</th><th>C (g)</th><th>G (g)</th></tr></thead><tbody>${
        meal.items.length
          ? meal.items
              .map((item) => {
                const food = foods.get(item.foodId),
                  n = itemNutrition(item, food);
                return `<tr><td>${e(food?.name ?? "Alimento não encontrado")}${food?.needsReview ? " ⚠" : ""}</td><td>${f(item.quantityG)}</td>${NUTRIENTS.map((k) => `<td>${f(n[k])}</td>`).join("")}</tr>`;
              })
              .join("")
          : '<tr><td colspan="6" class="report-empty">Sem alimentos nesta refeição.</td></tr>'
      }<tr class="report-subtotal"><th>Total</th><td></td>${NUTRIENTS.map((k) => `<td>${f(total[k])}</td>`).join("")}</tr></tbody></table></section>`;
    })
    .join("")}
  ${warnings.length ? `<aside class="report-warnings"><h2>Observações sobre os dados</h2><p>— indica valor desconhecido. Totais com dados ausentes não são calculados como zero. Valores suspeitos foram preservados da origem.</p><ul>${warnings.map((w) => `<li>${e(w)}</li>`).join("")}</ul></aside>` : ""}
  </article>`;
}
