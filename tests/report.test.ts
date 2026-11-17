import { expect, it } from 'vitest';
import { addItem, createDiet } from '../src/core/meals';
import { reportHtml } from '../src/components/report';
import { foodMap, originalFoods } from '../src/services/food-service';
it('inclui as oito refeições e escapa conteúdo importado', () => {
  const diet = createDiet('<img src=x onerror=alert(1)>');
  addItem(diet.meals[7]!, originalFoods[0]!.id);
  const report = reportHtml(diet, foodMap([]));
  expect(report.match(/class="report-meal"/g)).toHaveLength(8);
  expect(report).toContain('8. Refeição extra'); expect(report).toContain(originalFoods[0]!.name);
  expect(report).not.toContain('<img'); expect(report).toContain('&lt;img');
});
it('inclui avisos e não representa calorias desconhecidas como zero', () => {
  const diet = createDiet(); addItem(diet.meals[0]!, '223');
  const report = reportHtml(diet, foodMap([]));
  expect(report).toContain('Observações sobre os dados'); expect(report).toContain('valor desconhecido');
  expect(report).toContain('—');
});
