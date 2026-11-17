import { expect, it } from "vitest";
import { createDiet } from "../src/core/meals";
import {
  macroCalories,
  macroEnergy,
  macroPercentages,
} from "../src/core/strategy";
import { macroPieSvg } from "../src/components/macro-chart";

it("calcula percentuais por contribuição calórica, sem usar a proporção em gramas", () => {
  const strategy = {
    ...createDiet().strategy,
    targetKcal: 300,
    proteinG: 25,
    fatG: 100 / 9,
    carbsG: 25,
  };
  const kcal = macroCalories(strategy);
  expect(kcal).toEqual({ protein: 100, fat: 100, carbs: 100 });
  expect(macroEnergy(strategy)).toBe(300);
  const percent = macroPercentages(strategy);
  for (const n of Object.values(percent)) expect(n).toBeCloseTo(100 / 3, 12);
});

it("usa os resultados da estratégia histórica sem arredondamento intermediário", () => {
  const strategy = createDiet().strategy;
  const percent = macroPercentages(strategy);
  expect(percent.protein).toBeCloseTo(23.629489603024577, 12);
  expect(percent.fat).toBeCloseTo(30.71833648393195, 12);
  expect(percent.carbs).toBeCloseTo(45.65217391304347, 12);
  const svg = macroPieSvg(strategy);
  expect(svg.match(/<path /g)).toHaveLength(3);
  for (const color of ["#4F81BD", "#C0504D", "#9BBB59"])
    expect(svg).toContain(`fill="${color}"`);
  for (const label of ["23,6%", "30,7%", "45,7%"])
    expect(svg).toContain(`>${label}</text>`);
});

it("trata estratégia zerada e calorias inválidas sem divisão por zero", () => {
  const zero = {
    ...createDiet().strategy,
    targetKcal: 0,
    proteinG: 0,
    fatG: 0,
    carbsG: 0,
  };
  expect(macroPercentages(zero)).toEqual({ protein: 0, fat: 0, carbs: 0 });
  for (const targetKcal of [0, NaN, Infinity]) {
    const svg = macroPieSvg({ ...zero, targetKcal });
    expect(svg).toContain("Sem distribuição");
    expect(svg).not.toMatch(/NaN|Infinity|data-macro=/);
  }
});

it("renderiza uma fatia de 100% como círculo completo", () => {
  const strategy = {
    ...createDiet().strategy,
    targetKcal: 400,
    proteinG: 100,
    fatG: 0,
    carbsG: 0,
  };
  const svg = macroPieSvg(strategy);
  expect(svg).toContain('<circle data-macro="protein" data-percentage="100"');
  expect(svg).toContain(">100%</text>");
  expect(svg).not.toContain("<path ");
});

it("omite fatias zeradas e mantém os percentuais das demais", () => {
  const svg = macroPieSvg({
    ...createDiet().strategy,
    targetKcal: 800,
    proteinG: 100,
    fatG: 0,
    carbsG: 100,
  });
  expect(svg.match(/<path /g)).toHaveLength(2);
  expect(svg).not.toContain('data-macro="fat"');
  expect(svg.match(/>50%<\/text>/g)).toHaveLength(2);
});
