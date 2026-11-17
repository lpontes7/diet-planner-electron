import type { Goal, MacroValues, Profile, Strategy, StrategyMode } from '../types/models';

export const ACTIVITIES = [
  { factor: 1.2, label: 'Sedentário', description: 'Pouco ou nenhum exercício' },
  { factor: 1.375, label: 'Levemente ativo', description: 'Exercício leve de 1 a 3 dias por semana' },
  { factor: 1.55, label: 'Moderadamente ativo', description: 'Exercício moderado de 3 a 5 dias por semana' },
  { factor: 1.725, label: 'Muito ativo', description: 'Exercício intenso de 6 a 7 dias por semana' },
  { factor: 1.9, label: 'Extremamente ativo', description: 'Exercício intenso e prolongado diariamente' },
] as const;
export const GOALS: Record<Goal, string> = { bulking: 'Hipertrofia', maintenance: 'Manutenção', cutting: 'Definição' };

export function validateProfile(p: Profile): void {
  if (!p || !['male', 'female'].includes(p.sex)) throw new Error('Selecione o sexo.');
  if (!Number.isInteger(p.age) || p.age < 1 || p.age > 120) throw new Error('Informe uma idade inteira entre 1 e 120 anos.');
  if (!Number.isFinite(p.weightKg) || p.weightKg < 10 || p.weightKg > 500) throw new Error('Informe um peso entre 10 e 500 kg.');
  if (!Number.isFinite(p.heightCm) || p.heightCm < 50 || p.heightCm > 250) throw new Error('Informe uma altura entre 50 e 250 cm.');
  if (!ACTIVITIES.some(a => a.factor === p.activityFactor)) throw new Error('Selecione um nível de atividade válido.');
}
export function basalMetabolism(p: Profile): number {
  validateProfile(p);
  const value = p.sex === 'male'
    ? 66 + 13.7 * p.weightKg + 5 * p.heightCm - 6.8 * p.age
    : 655 + 9.6 * p.weightKg + 1.8 * p.heightCm - 4.7 * p.age;
  if (value <= 0) throw new Error('O perfil resulta em metabolismo basal impossível. Confira as medidas.');
  return value;
}
export function energyExpenditure(p: Profile): number { return basalMetabolism(p) * p.activityFactor; }
export function targetEnergy(p: Profile, goal: Goal): number {
  if (!(goal in GOALS)) throw new Error('Selecione um objetivo válido.');
  const result = energyExpenditure(p) + ({ bulking: 500, maintenance: 0, cutting: -500 }[goal]);
  assertEnergy(result);
  return result;
}
function assertEnergy(n: number): void {
  if (!Number.isFinite(n) || n <= 0 || n > 20000) throw new Error('A meta calórica deve ser maior que zero e até 20.000 kcal.');
}
export function macroEnergy(m: MacroValues): number { return m.proteinG * 4 + m.fatG * 9 + m.carbsG * 4; }
function assertMacros(m: MacroValues): void {
  if ([m.proteinG, m.carbsG, m.fatG].some(n => !Number.isFinite(n) || n < 0 || n > 5000)) {
    throw new Error('Os macronutrientes devem ter valores finitos e não negativos, até 5.000 g.');
  }
}
export function calculateStrategy(p: Profile, goal: Goal, mode: StrategyMode = 'standard', custom?: { targetKcal?: number; macros: MacroValues }): Strategy {
  const automaticKcal = targetEnergy(p, goal);
  let targetKcal = automaticKcal;
  let macros: MacroValues;
  if (mode === 'standard') {
    const proteinG = p.weightKg * (targetKcal <= 1500 ? 1 : targetKcal <= 2000 ? 1.5 : 2);
    const fatG = proteinG * 4 * 1.3 / 9;
    macros = { proteinG, fatG, carbsG: (targetKcal - proteinG * 4 - fatG * 9) / 4 };
  } else if (mode === 'custom-percent' && custom) {
    targetKcal = custom.targetKcal ?? automaticKcal;
    assertEnergy(targetKcal);
    const m = custom.macros;
    if ([m.proteinG, m.carbsG, m.fatG].some(v => !Number.isFinite(v) || v < 0 || v > 100) || Math.abs(m.proteinG + m.carbsG + m.fatG - 100) > 1e-8) {
      throw new Error('Os percentuais de proteína, carboidrato e gordura devem somar 100%.');
    }
    macros = { proteinG: targetKcal * m.proteinG / 100 / 4, carbsG: targetKcal * m.carbsG / 100 / 4, fatG: targetKcal * m.fatG / 100 / 9 };
  } else if (mode === 'custom-grams' && custom) {
    macros = custom.macros;
    assertMacros(macros);
    targetKcal = macroEnergy(macros);
  } else throw new Error('Estratégia personalizada inválida.');
  assertEnergy(targetKcal);
  assertMacros(macros);
  return { goal, mode, targetKcal, ...macros };
}
