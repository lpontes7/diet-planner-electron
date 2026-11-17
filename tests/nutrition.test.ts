import { expect, it } from "vitest";
import {
  dayNutrition,
  deviation,
  itemNutrition,
  sumNutrients,
} from "../src/core/nutrition";
import { createDiet, addMeal, addItem } from "../src/core/meals";
import { originalFoods } from "../src/services/food-service";
const food = originalFoods[0]!;
it("escala por quantidade sem arredondamento intermediário", () => {
  const value = itemNutrition(
    { id: "i", foodId: food.id, quantityG: 33.333 },
    food,
  );
  expect(value.kcal).toBe((food.kcalPer100g! * 33.333) / 100);
});
it("propaga desconhecidos no nutriente, preservando os demais", () => {
  const value = itemNutrition(
    { id: "i", foodId: food.id, quantityG: 150 },
    { ...food, kcalPer100g: null },
  );
  expect(value.kcal).toBeNull();
  expect(value.protein).toBeCloseTo(food.proteinPer100g! * 1.5, 12);
  expect(
    sumNutrients([value, { kcal: 100, protein: 1, carbs: 1, fat: 1 }]).kcal,
  ).toBeNull();
  expect(
    itemNutrition({ id: "i", foodId: "missing", quantityG: 100 }, undefined),
  ).toEqual({ kcal: null, protein: null, carbs: null, fat: null });
});
it("inclui a vigésima refeição no total", () => {
  const diet = createDiet();
  for (let i = 0; i < 15; i++) addMeal(diet);
  const meals = diet.meals;
  addItem(meals[19]!, food.id, 100);
  expect(dayNutrition(meals, new Map([[food.id, food]])).kcal).toBe(
    food.kcalPer100g,
  );
});
it("avisa ao ultrapassar 10%, incluindo meta zero", () => {
  expect(deviation(110, 100).outside).toBe(false);
  expect(deviation(110.001, 100).outside).toBe(true);
  expect(deviation(89.9, 100).outside).toBe(true);
  expect(deviation(null, 100).difference).toBeNull();
  expect(deviation(1, 0).outside).toBe(true);
});
it("preserva 620 identificadores e valores suspeitos da planilha", () => {
  expect(originalFoods).toHaveLength(620);
  expect(new Set(originalFoods.map((f) => f.id)).size).toBe(620);
  expect(originalFoods.filter((f) => f.kcalPer100g === null)).toHaveLength(4);
  expect(
    originalFoods.filter((f) => f.carbsPer100g !== null && f.carbsPer100g < 0),
  ).toHaveLength(4);
  expect(originalFoods.find((f) => f.id === "616")!.kcalPer100g).toBe(5750);
  expect(
    originalFoods.find((f) => f.id === "610")!.originalValues!.kcalPer100g,
  ).toBe("91,5");
});
