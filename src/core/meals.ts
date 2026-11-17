import type { Diet, Meal, MealItem } from '../types/models';
import { calculateStrategy } from './strategy';
export const MAX_MEALS = 8;
export const MAX_ITEMS = 6;
export const newId = (): string => globalThis.crypto.randomUUID();
export function createMeals(): Meal[] {
  return ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Pré-treino', 'Jantar', 'Ceia', 'Refeição extra']
    .map((name, i) => ({ id: newId(), name, time: ['07:00', '10:00', '12:30', '15:30', '17:00', '19:30', '21:00', '22:00'][i]!, items: [] }));
}
export function createDiet(name = 'Minha dieta'): Diet {
  const profile = { sex: 'female' as const, age: 20, weightKg: 75, heightCm: 170, activityFactor: 1.2 };
  return { id: newId(), name, profile, strategy: calculateStrategy(profile, 'maintenance'), meals: createMeals(), updatedAt: new Date().toISOString() };
}
export function addItem(meal: Meal, foodId: string, quantityG = 100): MealItem {
  if (meal.items.length >= MAX_ITEMS) throw new Error('Cada refeição pode ter até seis alimentos.');
  if (!foodId || !Number.isFinite(quantityG) || quantityG <= 0 || quantityG > 10000) throw new Error('Alimento ou quantidade inválidos.');
  const item = { id: newId(), foodId, quantityG };
  meal.items.push(item);
  return item;
}
export function duplicateDiet(diet: Diet): Diet {
  const copy = structuredClone(diet);
  copy.id = newId();
  copy.name = (diet.name.slice(0, 110) + ' (cópia)');
  copy.updatedAt = new Date().toISOString();
  copy.meals.forEach(m => { m.id = newId(); m.items.forEach(i => { i.id = newId(); }); });
  return copy;
}
export function clearMeals(diet: Diet): void { diet.meals.forEach(m => { m.items = []; }); }
