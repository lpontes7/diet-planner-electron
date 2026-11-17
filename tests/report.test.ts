import { expect, it } from 'vitest';
import { addItem, createDiet } from '../src/core/meals';
import { reportHtml } from '../src/components/report';
import { foodMap, originalFoods } from '../src/services/food-service';
import { DEFAULT_REPORT_SETTINGS, reportSettings } from '../src/core/report';
import { calculateStrategy } from '../src/core/strategy';
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

it('mostra a estratégia no gráfico mesmo quando os alimentos planejados mudam', () => {
  const diet = createDiet();
  const svg = (html: string) => html.match(/<svg class="macro-pie"[\s\S]*?<\/svg>/)![0];
  const before = svg(reportHtml(diet, foodMap([])));
  addItem(diet.meals[0]!, '1', 345);
  expect(svg(reportHtml(diet, foodMap([])))).toBe(before);
  diet.strategy = calculateStrategy(diet.profile, 'bulking', 'custom-percent', { targetKcal: 2400, macros: { proteinG: 50, fatG: 20, carbsG: 30 } });
  const changed = reportHtml(diet, foodMap([]));
  expect(svg(changed)).not.toBe(before);
  expect(changed).toContain('data-macro="protein" data-percentage="50"');
  expect(changed).toContain('DIETA ADOTADA'); expect(changed).toContain('2.400');
});

it('preserva informações pessoais e tabelas e remove marca, estratégia e rodapé solicitados', () => {
  const html = reportHtml(createDiet(), foodMap([]));
  for (const field of ['Altura', 'Peso', 'Idade', 'Atividade física', 'Objetivo', 'TMB', 'Resumo diário']) expect(html).toContain(field);
  expect(html).not.toContain('report-mark');
  expect(html).not.toContain('Padrão da planilha');
  expect(html).not.toContain('Fórmulas históricas reproduzidas');
  expect(html).not.toContain('recomendação clínica');
  expect(html).not.toContain('Documento gerado localmente');
  expect(html).not.toContain('<footer');
});

it('personaliza cabeçalho, pessoa, cor e data com texto escapado', () => {
  const diet = createDiet();
  diet.report = { ...DEFAULT_REPORT_SETTINGS, title: 'Plano <script>alert(1)</script>', subtitle: 'Acompanhamento mensal', patientName: 'Ana & Maria', professionalName: 'Dra. Silva', contact: 'contato@exemplo.test', accentColor: '#123456', showUpdatedAt: false };
  const html = reportHtml(diet, foodMap([]));
  expect(html).toContain('Plano &lt;script&gt;alert(1)&lt;/script&gt;');
  expect(html).not.toContain('<script>');
  for (const text of ['Acompanhamento mensal', 'Ana &amp; Maria', 'Dra. Silva', 'contato@exemplo.test', 'fill="#123456"']) expect(html).toContain(text);
  expect(html).not.toContain('Atualizado em');
});

it('abre dietas antigas com cabeçalho padrão e título baseado no nome do plano', () => {
  const diet = createDiet('Meu plano anterior');
  expect(diet.report).toBeUndefined();
  expect(reportSettings(diet)).toEqual(DEFAULT_REPORT_SETTINGS);
  expect(reportHtml(diet, foodMap([]))).toContain('<h1>Meu plano anterior</h1>');
});
