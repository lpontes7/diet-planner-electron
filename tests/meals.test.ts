import { expect, it } from "vitest";
import {
  addItem,
  addMeal,
  clearMeals,
  createDiet,
  duplicateDiet,
  moveMeal,
} from "../src/core/meals";
import { validateDiet } from "../src/core/validation";
it("inicia com as cinco refeições solicitadas e identificadores independentes", () => {
  const diet = createDiet();
  expect(diet.meals.map((m) => m.name)).toEqual([
    "Café da manhã",
    "Lanche da manhã",
    "Almoço",
    "Lanche da tarde",
    "Janta",
  ]);
  expect(new Set(diet.meals.map((m) => m.id)).size).toBe(5);
  expect(createDiet().meals[0]!.id).not.toBe(diet.meals[0]!.id);
  expect(validateDiet(diet).meals).toEqual(diet.meals);
});
it("aceita vinte refeições e rejeita a vigésima primeira, mantendo seis alimentos por refeição", () => {
  const diet = createDiet();
  for (let i = 0; i < 15; i++) addMeal(diet);
  expect(diet.meals).toHaveLength(20);
  expect(() => addMeal(diet)).toThrow("20 refeições");
  expect(validateDiet(diet).meals).toHaveLength(20);
  for (let i = 0; i < 6; i++) addItem(diet.meals[0]!, "1");
  expect(() => addItem(diet.meals[0]!, "2")).toThrow("seis");
  diet.meals.push(structuredClone(diet.meals[0]!));
  expect(() => validateDiet(diet)).toThrow("20 refeições");
});
it("move refeições nas duas direções preservando nome, horário e alimentos", () => {
  const diet = createDiet(),
    before = [...diet.meals];
  addItem(before[0]!, "1", 150);
  const meal = structuredClone(before[0]!);
  expect(moveMeal(diet, meal.id, 4)).toBe(true);
  expect(diet.meals.map((m) => m.id)).toEqual([
    ...before.slice(1).map((m) => m.id),
    meal.id,
  ]);
  expect(diet.meals[4]).toEqual(meal);
  moveMeal(diet, meal.id, 0);
  expect(diet.meals).toEqual(before);
  expect(moveMeal(diet, meal.id, 0)).toBe(false);
});
it("rejeita posições inválidas sem modificar refeições", () => {
  const diet = createDiet(),
    before = structuredClone(diet.meals);
  for (const position of [-1, 5, 0.5, NaN])
    expect(() => moveMeal(diet, before[0]!.id, position)).toThrow("Posição");
  expect(() => moveMeal(diet, "inexistente", 0)).toThrow("Posição");
  expect(diet.meals).toEqual(before);
});
it("duplica sem compartilhar dados e limpa somente alimentos", () => {
  const diet = createDiet();
  addItem(diet.meals[0]!, "1");
  const copy = duplicateDiet(diet);
  expect(copy.id).not.toBe(diet.id);
  expect(copy.meals[0]!.items[0]!.id).not.toBe(diet.meals[0]!.items[0]!.id);
  clearMeals(copy);
  expect(diet.meals[0]!.items).toHaveLength(1);
  expect(copy.meals[0]!.items).toHaveLength(0);
  expect(copy.profile).toEqual(diet.profile);
});
