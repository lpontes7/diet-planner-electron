import type { Strategy } from '../types/models';
import { macroCalories, macroEnergy, macroPercentages } from '../core/strategy';
import { compact as f, escapeHtml as e } from './ui';

export const MACRO_CATEGORIES = [
  { key: 'protein', gramsKey: 'proteinG', label: 'Proteínas', color: '#4F81BD' },
  { key: 'fat', gramsKey: 'fatG', label: 'Gorduras', color: '#C0504D' },
  { key: 'carbs', gramsKey: 'carbsG', label: 'Carboidratos', color: '#9BBB59' },
] as const;

/** Inline vector artwork works with CSP, offline and in the script-free PDF window. */
export function macroPieSvg(strategy: Strategy): string {
  const calories = macroCalories(strategy);
  const percentages = macroPercentages(strategy);
  const total = macroEnergy(strategy);
  const hasData = Number.isFinite(total) && total > 0 && Number.isFinite(strategy.targetKcal) && strategy.targetKcal > 0
    && Object.values(calories).every(n => Number.isFinite(n) && n >= 0);
  const description = hasData
    ? `Distribuição calórica da estratégia adotada: ${MACRO_CATEGORIES.map(m => `${m.label} ${f(percentages[m.key])}%`).join('; ')}.`
    : 'Distribuição indisponível: informe uma meta calórica e macronutrientes maiores que zero.';
  const point = (angle: number, radius = 90): [number, number] => [110 + radius * Math.cos(angle), 110 + radius * Math.sin(angle)];
  const coord = (n: number) => n.toFixed(6);
  let angle = -Math.PI / 2;
  const slices: string[] = [], labels: string[] = [];
  if (hasData) for (const category of MACRO_CATEGORIES) {
    const energy = calories[category.key];
    if (energy === 0) continue;
    const fraction = energy / total;
    const span = fraction * Math.PI * 2;
    const next = angle + span;
    const percent = percentages[category.key];
    const title = `${category.label}: ${f(strategy[category.gramsKey], 2)} g · ${f(percent)}%`;
    const attributes = `data-macro="${category.key}" data-percentage="${percent}" fill="${category.color}"`;
    if (fraction >= 1 - 1e-12) {
      slices.push(`<circle ${attributes} cx="110" cy="110" r="90"><title>${e(title)}</title></circle>`);
      labels.push(`<text class="pie-label pie-label-${category.key}" x="110" y="110" text-anchor="middle" dominant-baseline="central">${f(percent)}%</text>`);
    } else {
      const start = point(angle), end = point(next);
      slices.push(`<path ${attributes} d="M 110 110 L ${coord(start[0])} ${coord(start[1])} A 90 90 0 ${span > Math.PI ? 1 : 0} 1 ${coord(end[0])} ${coord(end[1])} Z"><title>${e(title)}</title></path>`);
      const mid = angle + span / 2;
      const small = fraction < 0.08;
      const label = point(mid, small ? 70 : 55);
      const rotation = small ? ` transform="rotate(${mid * 180 / Math.PI} ${coord(label[0])} ${coord(label[1])})"` : '';
      labels.push(`<text class="pie-label pie-label-${category.key}${small ? ' pie-label-small' : ''}" x="${coord(label[0])}" y="${coord(label[1])}" text-anchor="middle" dominant-baseline="central"${rotation}>${f(percent)}%</text>`);
    }
    angle = next;
  }
  return `<svg class="macro-pie" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220" role="img" aria-label="${e(description)}"><title>${e(description)}</title>${hasData ? slices.join('') + labels.join('') : '<circle cx="110" cy="110" r="90" fill="#edf0e9"/><text class="pie-empty" x="110" y="106" text-anchor="middle">Sem distribuição</text><text class="pie-empty" x="110" y="124" text-anchor="middle">0 kcal</text>'}</svg>`;
}

export function macroLegendHtml(strategy: Strategy): string {
  const percentages = macroPercentages(strategy);
  return `<div class="adopted-strategy"><h2>DIETA ADOTADA</h2><p class="adopted-calories"><strong>${f(strategy.targetKcal, 2)}</strong> <span>kcal</span></p><ul class="macro-legend">${MACRO_CATEGORIES.map(m => `<li data-legend="${m.key}"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect width="12" height="12" rx="3" fill="${m.color}"/></svg><div><span>${m.label}</span><strong>${f(strategy[m.gramsKey], 2)} g <small>· ${f(percentages[m.key])}%</small></strong></div></li>`).join('')}</ul></div>`;
}
