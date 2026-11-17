import type { Food, Meal, MealItem, Nutrients } from '../types/models';
export const NUTRIENTS = ['kcal', 'protein', 'carbs', 'fat'] as const;
const fields = { kcal: 'kcalPer100g', protein: 'proteinPer100g', carbs: 'carbsPer100g', fat: 'fatPer100g' } as const;
export const emptyNutrients = (): Nutrients => ({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
export function itemNutrition(item: MealItem, food: Food | undefined): Nutrients {
  if (!Number.isFinite(item.quantityG) || item.quantityG <= 0 || item.quantityG > 10000) throw new Error('A quantidade deve ser maior que zero e até 10.000 g.');
  const result = emptyNutrients();
  for (const key of NUTRIENTS) {
    const value = food?.[fields[key]];
    result[key] = typeof value === 'number' && Number.isFinite(value) ? value * item.quantityG / 100 : null;
  }
  return result;
}
export function sumNutrients(values: Nutrients[]): Nutrients {
  const result = emptyNutrients();
  for (const value of values) for (const key of NUTRIENTS) {
    const a = result[key], b = value[key];
    result[key] = a === null || b === null ? null : a + b;
  }
  return result;
}
export function mealNutrition(meal: Meal, foods: ReadonlyMap<string, Food>): Nutrients {
  return sumNutrients(meal.items.map(item => itemNutrition(item, foods.get(item.foodId))));
}
export function dayNutrition(meals: Meal[], foods: ReadonlyMap<string, Food>): Nutrients { return sumNutrients(meals.map(m => mealNutrition(m, foods))); }
export function deviation(consumed: number | null, target: number): { difference: number | null; outside: boolean; percent: number | null } {
  if (consumed === null) return { difference: null, outside: false, percent: null };
  const difference = consumed - target;
  const percent = target === 0 ? (consumed === 0 ? 0 : Infinity) : difference / target * 100;
  return { difference, percent, outside: Math.abs(percent) > 10 + 1e-9 };
}
