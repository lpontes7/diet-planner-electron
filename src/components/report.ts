import type { Diet, Food } from '../types/models';
import { dayNutrition, itemNutrition, mealNutrition, NUTRIENTS } from '../core/nutrition';
import { ACTIVITIES, basalMetabolism, GOALS } from '../core/strategy';
import { escapeHtml as e, compact as f } from './ui';
import { reviewFood } from '../services/food-service';

export function reportHtml(diet: Diet, foods: ReadonlyMap<string, Food>): string {
  const totals = dayNutrition(diet.meals, foods);
  const warnings = [...new Set(diet.meals.flatMap(m => m.items.flatMap(item => {
    const food = foods.get(item.foodId);
    return food ? reviewFood(food).map(reason => `${food.name}: ${reason}`) : [`Alimento ${item.foodId} ausente do catálogo`];
  })))];
  return `<article class="report-sheet"><header class="report-heading"><div><span class="eyebrow">DIETAS APP · PLANEJAMENTO ALIMENTAR</span><h1>${e(diet.name)}</h1><p>Atualizado em ${e(new Date(diet.updatedAt).toLocaleString('pt-BR'))}</p></div><span class="report-mark">DA</span></header>
  <div class="report-profile"><p><strong>Perfil</strong> ${diet.profile.sex === 'female' ? 'Feminino' : 'Masculino'} · ${diet.profile.age} anos · ${f(diet.profile.weightKg)} kg · ${f(diet.profile.heightCm)} cm</p><p><strong>Atividade</strong> ${ACTIVITIES.find(a => a.factor === diet.profile.activityFactor)?.label ?? ''} · <strong>Objetivo</strong> ${GOALS[diet.strategy.goal]}</p><p><strong>TMB</strong> ${f(basalMetabolism(diet.profile))} kcal · <strong>Estratégia</strong> ${diet.strategy.mode === 'standard' ? 'Padrão da planilha' : diet.strategy.mode === 'custom-percent' ? 'Percentuais personalizados' : 'Gramas personalizados'}</p></div>
  <table class="report-summary"><thead><tr><th>Resumo diário</th><th>Energia (kcal)</th><th>Proteínas (g)</th><th>Carboidratos (g)</th><th>Gorduras (g)</th></tr></thead><tbody><tr><th>Meta</th><td>${f(diet.strategy.targetKcal)}</td><td>${f(diet.strategy.proteinG)}</td><td>${f(diet.strategy.carbsG)}</td><td>${f(diet.strategy.fatG)}</td></tr><tr><th>Planejado</th>${NUTRIENTS.map(k => `<td>${f(totals[k])}</td>`).join('')}</tr></tbody></table>
  ${diet.meals.map((meal, index) => {
    const total = mealNutrition(meal, foods);
    return `<section class="report-meal"><h2>${index + 1}. ${e(meal.name)} <span>${e(meal.time)}</span></h2><table><thead><tr><th>Alimento</th><th>Qtd. (g)</th><th>kcal</th><th>P (g)</th><th>C (g)</th><th>G (g)</th></tr></thead><tbody>${meal.items.length ? meal.items.map(item => {
      const food = foods.get(item.foodId), n = itemNutrition(item, food);
      return `<tr><td>${e(food?.name ?? 'Alimento não encontrado')}${food?.needsReview ? ' ⚠' : ''}</td><td>${f(item.quantityG)}</td>${NUTRIENTS.map(k => `<td>${f(n[k])}</td>`).join('')}</tr>`;
    }).join('') : '<tr><td colspan="6" class="report-empty">Sem alimentos nesta refeição.</td></tr>'}<tr class="report-subtotal"><th>Total</th><td></td>${NUTRIENTS.map(k => `<td>${f(total[k])}</td>`).join('')}</tr></tbody></table></section>`;
  }).join('')}
  ${warnings.length ? `<aside class="report-warnings"><h2>Observações sobre os dados</h2><p>— indica valor desconhecido. Totais com dados ausentes não são calculados como zero. Valores suspeitos foram preservados da origem.</p><ul>${warnings.map(w => `<li>${e(w)}</li>`).join('')}</ul></aside>` : ''}
  <footer class="report-footer">Fórmulas históricas reproduzidas da planilha original. Este planejamento não constitui recomendação clínica individual. Documento gerado localmente pelo Dietas App.</footer></article>`;
}
