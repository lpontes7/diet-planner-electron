import rawFoods from '../data/alimentos.json';
import type { Diet, Food } from '../types/models';
export const originalFoods: readonly Food[] = rawFoods as Food[];
export function foodMap(custom: Food[]): Map<string, Food> { return new Map([...originalFoods, ...custom].map(f => [f.id, f])); }
export function searchFoods(foods: readonly Food[], query: string): Food[] {
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const terms = normalize(query).trim().split(/\s+/);
  return foods.filter(food => terms.every(term => normalize(food.name).includes(term)));
}
export function foodInUse(id: string, diets: Diet[]): boolean { return diets.some(d => d.meals.some(m => m.items.some(i => i.foodId === id))); }
export function reviewFood(food: Food): string[] {
  const reasons = [...food.reviewReasons];
  for (const [key, label, limit] of [['kcalPer100g', 'Calorias', 1000], ['proteinPer100g', 'Proteínas', 100], ['carbsPer100g', 'Carboidratos', 100], ['fatPer100g', 'Gorduras', 100]] as const) {
    const v = food[key];
    if (v === null) reasons.push(`${label}: valor desconhecido`);
    else if (v < 0 || v > limit) reasons.push(`${label}: valor fora da escala de 100 g`);
  }
  if (food.unit !== '100g') reasons.push('Unidade não verificada. Confira a base de 100 g antes do uso.');
  return [...new Set(reasons)];
}
