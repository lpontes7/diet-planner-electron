export type Goal = 'bulking' | 'maintenance' | 'cutting';
export type StrategyMode = 'standard' | 'custom-percent' | 'custom-grams';
export interface Food {
  id: string;
  name: string;
  kcalPer100g: number | null;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
  source: 'original' | 'custom';
  unit: '100g' | 'unverified';
  needsReview: boolean;
  reviewReasons: string[];
  originalRow?: number;
  originalValues?: Record<string, unknown>;
}
export interface Profile { sex: 'male' | 'female'; age: number; weightKg: number; heightCm: number; activityFactor: number }
export interface Strategy { goal: Goal; mode: StrategyMode; targetKcal: number; proteinG: number; carbsG: number; fatG: number }
export interface MacroValues { proteinG: number; carbsG: number; fatG: number }
export interface MealItem { id: string; foodId: string; quantityG: number }
export interface Meal { id: string; name: string; time: string; items: MealItem[] }
export interface Diet { id: string; name: string; profile: Profile; strategy: Strategy; meals: Meal[]; updatedAt: string }
export interface Nutrients { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null }
export type Section = 'profile' | 'strategy' | 'diet' | 'report';
export interface Workspace { schemaVersion: 1; diets: Diet[]; activeDietId: string; settings: { section: Section } }
export interface Bundle { workspace: Workspace; customFoods: Food[] }
export interface DietFile { schemaVersion: 1; diet: Diet; customFoods: Food[] }
export interface Bootstrap extends Bundle { warnings: string[]; dataPath: string }
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
export interface DesktopAPI {
  load(): Promise<Result<Bootstrap>>;
  save(bundle: Bundle): Promise<Result<void>>;
  exportDiet(file: DietFile): Promise<Result<boolean>>;
  importDiet(): Promise<Result<DietFile | null>>;
  pdf(file: DietFile): Promise<Result<boolean>>;
  print(file: DietFile): Promise<Result<boolean>>;
}
