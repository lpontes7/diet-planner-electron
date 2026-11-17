import type { Diet, Meal, MealItem } from "../types/models";
import { calculateStrategy } from "./strategy";
export const MAX_MEALS = 20;
export const MAX_ITEMS = 6;
export const newId = (): string => globalThis.crypto.randomUUID();
export function createMeals(): Meal[] {
  return [
    "Café da manhã",
    "Lanche da manhã",
    "Almoço",
    "Lanche da tarde",
    "Janta",
  ].map((name, i) => ({
    id: newId(),
    name,
    time: ["07:00", "10:00", "13:00", "16:00", "19:00"][i]!,
    items: [],
  }));
}
export function addMeal(diet: Diet): Meal {
  if (diet.meals.length >= MAX_MEALS)
    throw new Error(`A dieta pode ter até ${MAX_MEALS} refeições.`);
  const meal: Meal = {
    id: newId(),
    name: `Refeição ${diet.meals.length + 1}`,
    time: "20:00",
    items: [],
  };
  diet.meals.push(meal);
  return meal;
}
/** Move a complete meal to its final zero-based position, preserving its contents. */
export function moveMeal(
  diet: Diet,
  mealId: string,
  position: number,
): boolean {
  const from = diet.meals.findIndex((meal) => meal.id === mealId);
  if (
    from < 0 ||
    !Number.isInteger(position) ||
    position < 0 ||
    position >= diet.meals.length
  )
    throw new Error("Posição da refeição inválida.");
  if (from === position) return false;
  const [meal] = diet.meals.splice(from, 1);
  diet.meals.splice(position, 0, meal!);
  return true;
}
export function createDiet(name = "Minha dieta"): Diet {
  const profile = {
    sex: "female" as const,
    age: 20,
    weightKg: 75,
    heightCm: 170,
    activityFactor: 1.2,
  };
  return {
    id: newId(),
    name,
    profile,
    strategy: calculateStrategy(profile, "maintenance"),
    meals: createMeals(),
    updatedAt: new Date().toISOString(),
  };
}
export function addItem(meal: Meal, foodId: string, quantityG = 100): MealItem {
  if (meal.items.length >= MAX_ITEMS)
    throw new Error("Cada refeição pode ter até seis alimentos.");
  if (
    !foodId ||
    !Number.isFinite(quantityG) ||
    quantityG <= 0 ||
    quantityG > 10000
  )
    throw new Error("Alimento ou quantidade inválidos.");
  const item = { id: newId(), foodId, quantityG };
  meal.items.push(item);
  return item;
}
export function duplicateDiet(diet: Diet): Diet {
  const copy = structuredClone(diet);
  copy.id = newId();
  copy.name = diet.name.slice(0, 110) + " (cópia)";
  copy.updatedAt = new Date().toISOString();
  copy.meals.forEach((m) => {
    m.id = newId();
    m.items.forEach((i) => {
      i.id = newId();
    });
  });
  return copy;
}
export function clearMeals(diet: Diet): void {
  diet.meals.forEach((m) => {
    m.items = [];
  });
}
