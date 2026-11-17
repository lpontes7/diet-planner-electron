import type { Diet, Food, Meal } from '../types/models';
import { dayNutrition, deviation, itemNutrition, mealNutrition, NUTRIENTS } from '../core/nutrition';
import { compact as f, escapeHtml as e, toast } from './ui';
import { GOALS } from '../core/strategy';
import { reviewFood } from '../services/food-service';

interface Callbacks { changed(): void; selectFood(meal: Meal): void; report(): void }
export function renderDiet(root: HTMLElement, diet: Diet, foods: ReadonlyMap<string, Food>, callbacks: Callbacks): void {
  root.innerHTML = `<div class="diet-layout"><div class="meals-column"><div class="meal-jumps"><span>Suas refeições</span>${diet.meals.map((_, i) => `<a href="#meal-${i}" aria-label="Ir à refeição ${i + 1}">${String(i + 1).padStart(2, '0')}</a>`).join('')}<span class="meal-count">${diet.meals.reduce((n, m) => n + m.items.length, 0)} / 48 alimentos</span></div>${diet.meals.map((meal, index) => `<article class="meal-card" id="meal-${index}" data-meal="${e(meal.id)}"><header class="meal-header"><span class="meal-number">${String(index + 1).padStart(2, '0')}</span><div class="meal-title"><label class="sr-only" for="name-${meal.id}">Nome da refeição ${index + 1}</label><input id="name-${meal.id}" class="meal-name" data-name maxlength="80" required value="${e(meal.name)}"><span>${meal.items.length} de 6 alimentos</span></div><label class="time-field"><span class="sr-only">Horário da refeição ${index + 1}</span><input aria-label="Horário da refeição ${index + 1}" type="time" data-time value="${e(meal.time)}" required></label></header><div class="table-scroll"><table class="meal-table"><thead><tr><th>Alimento</th><th>Qtd. (g)</th><th>kcal</th><th>P <small>(g)</small></th><th>C <small>(g)</small></th><th>G <small>(g)</small></th><th><span class="sr-only">Ações</span></th></tr></thead><tbody>${meal.items.length ? meal.items.map(item => {
    const food = foods.get(item.foodId), nutrition = itemNutrition(item, food), warnings = food ? reviewFood(food) : ['Alimento não encontrado'];
    return `<tr data-item="${e(item.id)}"><td><span class="food-name">${e(food?.name ?? 'Alimento não encontrado')}</span>${warnings.length ? `<span class="food-warning" title="${e(warnings.join('; '))}">⚠ Dados a revisar</span>` : ''}</td><td><label class="sr-only" for="qty-${item.id}">Quantidade de ${e(food?.name ?? 'alimento')} em gramas</label><input id="qty-${item.id}" type="number" class="quantity" data-quantity min="0.01" max="10000" step="any" required value="${item.quantityG}"></td>${NUTRIENTS.map(k => `<td data-nutrient="${k}">${f(nutrition[k])}</td>`).join('')}<td><button class="icon-button remove-food" aria-label="Remover ${e(food?.name ?? 'alimento')}">×</button></td></tr>`;
  }).join('') : '<tr><td colspan="7"><div class="empty-meal"><span aria-hidden="true">＋</span><p>O que vai entrar nessa refeição?</p><small>Adicione até 6 alimentos do catálogo.</small></div></td></tr>'}</tbody><tfoot><tr><th colspan="2">Total da refeição</th>${NUTRIENTS.map(k => `<td data-meal-total="${k}">${f(mealNutrition(meal, foods)[k])}</td>`).join('')}<td></td></tr></tfoot></table></div><footer class="meal-footer"><button class="add-food" ${meal.items.length >= 6 ? 'disabled' : ''}>＋ Adicionar alimento</button><span>Valores para a quantidade informada</span></footer></article>`).join('')}</div><aside class="daily-aside" id="daily-summary"></aside></div>`;
  function refresh(): void {
    renderDaily(root.querySelector('#daily-summary')!, diet, foods, callbacks.report);
    const count = root.querySelector('.meal-count');
    if (count) count.textContent = `${diet.meals.reduce((n, m) => n + m.items.length, 0)} / 48 alimentos`;
  }
  for (const card of root.querySelectorAll<HTMLElement>('[data-meal]')) {
    const meal = diet.meals.find(m => m.id === card.dataset.meal)!;
    card.querySelector('.add-food')!.addEventListener('click', () => callbacks.selectFood(meal));
    const name = card.querySelector<HTMLInputElement>('[data-name]')!;
    name.addEventListener('input', () => {
      if (name.value.trim()) { meal.name = name.value.trim(); callbacks.changed(); }
      name.setCustomValidity(name.value.trim() ? '' : 'Informe o nome da refeição.');
    });
    name.addEventListener('blur', () => { name.value = meal.name; name.setCustomValidity(''); });
    const time = card.querySelector<HTMLInputElement>('[data-time]')!;
    time.addEventListener('change', () => { if (time.validity.valid && time.value) { meal.time = time.value; callbacks.changed(); } else time.value = meal.time; });
    for (const row of card.querySelectorAll<HTMLElement>('[data-item]')) {
      const item = meal.items.find(i => i.id === row.dataset.item)!;
      const input = row.querySelector<HTMLInputElement>('[data-quantity]')!;
      input.addEventListener('input', () => {
        if (!input.validity.valid || !input.value || !Number.isFinite(input.valueAsNumber)) return;
        item.quantityG = input.valueAsNumber;
        const nutrition = itemNutrition(item, foods.get(item.foodId)), total = mealNutrition(meal, foods);
        for (const k of NUTRIENTS) {
          row.querySelector(`[data-nutrient="${k}"]`)!.textContent = f(nutrition[k]);
          card.querySelector(`[data-meal-total="${k}"]`)!.textContent = f(total[k]);
        }
        callbacks.changed(); refresh();
      });
      input.addEventListener('blur', () => { if (!input.validity.valid || !input.value) { input.value = String(item.quantityG); toast('Quantidade inválida. O último valor válido foi mantido.', true); } });
      row.querySelector('.remove-food')!.addEventListener('click', () => {
        meal.items = meal.items.filter(i => i.id !== item.id); callbacks.changed(); renderDiet(root, diet, foods, callbacks);
      });
    }
  }
  refresh();
}
function renderDaily(root: Element, diet: Diet, foods: ReadonlyMap<string, Food>, report: () => void): void {
  const total = dayNutrition(diet.meals, foods), s = diet.strategy;
  const reviewCount = diet.meals.flatMap(m => m.items).filter(i => { const f = foods.get(i.foodId); return !f || f.needsReview; }).length;
  const target = { kcal: s.targetKcal, protein: s.proteinG, carbs: s.carbsG, fat: s.fatG };
  const pct = total.kcal === null ? 0 : Math.max(0, Math.min(100, total.kcal / s.targetKcal * 100));
  const difference = deviation(total.kcal, s.targetKcal);
  root.innerHTML = `<div class="daily-card"><div class="aside-label"><span class="eyebrow">RESUMO DO DIA</span><span class="goal-badge">${GOALS[s.goal]}</span></div><div class="energy-ring"><svg viewBox="0 0 160 160" aria-hidden="true"><circle class="ring-track" cx="80" cy="80" r="69"/><circle class="ring-value" cx="80" cy="80" r="69" stroke-dasharray="${pct * 4.3354} 433.54"/></svg><div><span>Planejado</span><strong>${f(total.kcal, 0)}</strong><small>de ${f(s.targetKcal, 0)} kcal</small></div></div><div class="energy-difference ${difference.outside ? 'outside' : ''}">${difference.difference === null ? 'Total calórico incompleto' : difference.difference <= 0 ? `${f(-difference.difference, 0)} kcal para a meta` : `${f(difference.difference, 0)} kcal acima da meta`}</div><div class="macro-list">${(['protein', 'carbs', 'fat'] as const).map((k, i) => {
    const d = deviation(total[k], target[k]);
    return `<div class="macro-stat ${k}"><div><span>${['Proteínas', 'Carboidratos', 'Gorduras'][i]}</span><strong>${f(total[k])}<small> / ${f(target[k])} g</small></strong></div><progress aria-label="${['Proteínas', 'Carboidratos', 'Gorduras'][i]}" max="${Math.max(target[k], 1)}" value="${Math.max(0, total[k] ?? 0)}"></progress><small class="${d.outside ? 'outside-text' : ''}">${d.difference === null ? 'Dados incompletos' : `Diferença: ${d.difference > 0 ? '+' : ''}${f(d.difference)} g${d.outside ? ' · fora de ±10%' : ' · dentro de ±10%'}`}</small></div>`;
  }).join('')}</div><p class="tolerance-note">Comparação com tolerância de ±10% da meta.</p><button id="view-report" class="button primary full-width">Visualizar relatório <span>↗</span></button></div>${reviewCount ? `<div class="data-warning"><strong>⚠ ${reviewCount} ${reviewCount === 1 ? 'alimento pede' : 'alimentos pedem'} atenção</strong><p>Há dados ausentes, suspeitos ou unidades a conferir. — significa desconhecido; esses totais ficam incompletos.</p></div>` : '<div class="offline-note"><span aria-hidden="true">◈</span><p>Seu plano fica neste computador.<br>Sem conexão. Sem planilha aberta.</p></div>'}`;
  root.querySelector('#view-report')!.addEventListener('click', report);
}
