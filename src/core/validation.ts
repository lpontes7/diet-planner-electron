import type { Bundle, Diet, DietFile, Food, Workspace } from '../types/models';
import { basalMetabolism, macroEnergy, calculateStrategy } from './strategy';

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}: objeto inválido.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max = 120): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) throw new Error(`${label}: texto inválido (máximo ${max} caracteres).`);
}
function id(value: unknown): asserts value is string { if (typeof value !== 'string' || !/^[\w-]{1,100}$/.test(value)) throw new Error('Identificador inválido.'); }
function unique(ids: string[]): void { if (new Set(ids).size !== ids.length) throw new Error('Identificadores duplicados no arquivo.'); }
export function validateDiet(value: unknown): Diet {
  const o = object(value, 'Dieta');
  id(o.id); text(o.name, 'Nome da dieta');
  const profile = object(o.profile, 'Perfil') as unknown as Diet['profile'];
  basalMetabolism(profile);
  const s = object(o.strategy, 'Estratégia') as unknown as Diet['strategy'];
  if (!['bulking', 'maintenance', 'cutting'].includes(s.goal) || !['standard', 'custom-percent', 'custom-grams'].includes(s.mode)) throw new Error('Estratégia inválida.');
  if ([s.targetKcal, s.proteinG, s.fatG, s.carbsG].some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0) || s.targetKcal <= 0 || s.targetKcal > 20000 || Math.abs(macroEnergy(s) - s.targetKcal) > 0.01) throw new Error('Calorias e macronutrientes inconsistentes.');
  if (s.mode === 'standard') {
    const expected = calculateStrategy(profile, s.goal);
    if ((['targetKcal', 'proteinG', 'fatG', 'carbsG'] as const).some(k => Math.abs(s[k] - expected[k]) > 0.01)) throw new Error('Estratégia padrão não corresponde ao perfil.');
  }
  if (!Array.isArray(o.meals) || o.meals.length < 1 || o.meals.length > 8) throw new Error('A dieta deve ter entre uma e oito refeições.');
  const ids: string[] = [];
  for (const raw of o.meals) {
    const m = object(raw, 'Refeição'); id(m.id); ids.push(m.id); text(m.name, 'Nome da refeição', 80);
    if (typeof m.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(m.time)) throw new Error('Horário inválido.');
    if (!Array.isArray(m.items) || m.items.length > 6) throw new Error('Uma refeição pode ter até seis alimentos.');
    for (const rawItem of m.items) {
      const i = object(rawItem, 'Item'); id(i.id); id(i.foodId); ids.push(i.id);
      if (typeof i.quantityG !== 'number' || !Number.isFinite(i.quantityG) || i.quantityG <= 0 || i.quantityG > 10000) throw new Error('Quantidade inválida.');
    }
  }
  unique(ids);
  if (typeof o.updatedAt !== 'string' || !Number.isFinite(Date.parse(o.updatedAt))) throw new Error('Data da dieta inválida.');
  // Reconstruct validated shapes, excluding unrecognized properties from imported JSON.
  return { id: o.id, name: o.name, profile: { sex: profile.sex, age: profile.age, weightKg: profile.weightKg, heightCm: profile.heightCm, activityFactor: profile.activityFactor }, strategy: { goal: s.goal, mode: s.mode, targetKcal: s.targetKcal, proteinG: s.proteinG, fatG: s.fatG, carbsG: s.carbsG }, meals: (o.meals as Diet['meals']).map(m => ({ id: m.id, name: m.name, time: m.time, items: m.items.map(i => ({ id: i.id, foodId: i.foodId, quantityG: i.quantityG })) })), updatedAt: o.updatedAt };
}
export function validateCustomFood(value: unknown): Food {
  const f = object(value, 'Alimento');
  id(f.id); if (!f.id.startsWith('custom-')) throw new Error('O identificador personalizado deve começar com custom-.');
  text(f.name, 'Nome do alimento', 180);
  if (f.source !== 'custom' || f.unit !== '100g') throw new Error('Informe nutrientes referentes a 100 g.');
  for (const [key, max] of [['kcalPer100g', 1000], ['proteinPer100g', 100], ['carbsPer100g', 100], ['fatPer100g', 100]] as const) {
    const n = f[key];
    if (n !== null && (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > max)) throw new Error(`${key}: informe um número entre 0 e ${max}, ou deixe desconhecido.`);
  }
  const reasons = ['kcalPer100g', 'proteinPer100g', 'carbsPer100g', 'fatPer100g'].filter(k => f[k] === null).map(k => `${k}: valor desconhecido`);
  return { id: f.id, name: f.name.trim(), source: 'custom', unit: '100g', kcalPer100g: f.kcalPer100g as number | null, proteinPer100g: f.proteinPer100g as number | null, carbsPer100g: f.carbsPer100g as number | null, fatPer100g: f.fatPer100g as number | null, needsReview: reasons.length > 0, reviewReasons: reasons };
}
export function validateCustomFoods(value: unknown): Food[] {
  if (!Array.isArray(value) || value.length > 10000) throw new Error('Catálogo personalizado inválido.');
  const foods = value.map(validateCustomFood); unique(foods.map(f => f.id)); return foods;
}
export function validateWorkspace(value: unknown): Workspace {
  const w = object(value, 'Dados locais');
  if (w.schemaVersion !== 1 || !Array.isArray(w.diets) || w.diets.length < 1 || w.diets.length > 500) throw new Error('Formato de dados locais inválido ou versão incompatível.');
  const diets = w.diets.map(validateDiet); unique(diets.map(d => d.id)); id(w.activeDietId);
  if (!diets.some(d => d.id === w.activeDietId)) throw new Error('Dieta ativa não encontrada.');
  const settings = object(w.settings, 'Configurações');
  if (!['profile', 'strategy', 'diet', 'report'].includes(settings.section as string)) throw new Error('Seção inválida.');
  return { schemaVersion: 1, diets, activeDietId: w.activeDietId, settings: { section: settings.section as Workspace['settings']['section'] } };
}
export function assertReferences(diets: Diet[], customFoods: Food[], originalIds: Set<string>): void {
  const ids = new Set([...originalIds, ...customFoods.map(f => f.id)]);
  if (diets.some(d => d.meals.some(m => m.items.some(i => !ids.has(i.foodId))))) throw new Error('A dieta referencia um alimento ausente. Importe também os alimentos personalizados.');
}
export function validateBundle(value: unknown, originalIds: Set<string>): Bundle {
  const b = object(value, 'Dados');
  const workspace = validateWorkspace(b.workspace), customFoods = validateCustomFoods(b.customFoods);
  assertReferences(workspace.diets, customFoods, originalIds);
  return { workspace, customFoods };
}
export function validateDietFile(value: unknown, originalIds: Set<string>): DietFile {
  const file = object(value, 'Arquivo da dieta');
  if (file.schemaVersion !== 1) throw new Error('Versão de arquivo incompatível.');
  const diet = validateDiet(file.diet), customFoods = validateCustomFoods(file.customFoods);
  assertReferences([diet], customFoods, originalIds);
  return { schemaVersion: 1, diet, customFoods };
}
