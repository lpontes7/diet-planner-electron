import { describe, expect, it } from "vitest";
import {
  ACTIVITIES,
  basalMetabolism,
  calculateStrategy,
  targetEnergy,
} from "../src/core/strategy";
import type { Profile } from "../src/types/models";
const profile: Profile = {
  sex: "female",
  age: 20,
  weightKg: 75,
  heightCm: 170,
  activityFactor: 1.2,
};
describe("Fidelidade às fórmulas da planilha", () => {
  it("reproduz todos os valores do caso de referência", () => {
    expect(basalMetabolism(profile)).toBe(1587);
    const strategy = calculateStrategy(profile, "maintenance");
    expect(strategy.targetKcal).toBeCloseTo(1904.4, 10);
    expect(strategy.proteinG).toBe(112.5);
    expect(strategy.fatG).toBe(65);
    expect(strategy.carbsG).toBeCloseTo(217.35, 10);
  });
  it("preserva a fórmula masculina e os cinco fatores de atividade", () => {
    const p = { ...profile, sex: "male" as const };
    expect(basalMetabolism(p)).toBe(1807.5);
    for (const a of ACTIVITIES)
      expect(
        targetEnergy({ ...p, activityFactor: a.factor }, "maintenance"),
      ).toBeCloseTo(1807.5 * a.factor);
  });
  it("aplica ±500 kcal", () => {
    expect(targetEnergy(profile, "bulking")).toBeCloseTo(2404.4);
    expect(targetEnergy(profile, "cutting")).toBeCloseTo(1404.4);
    expect(calculateStrategy(profile, "cutting").proteinG).toBe(75);
    expect(calculateStrategy(profile, "bulking").proteinG).toBe(150);
  });
  it("mantém os limites exatos de 1500 e 2000 kcal", () => {
    for (const [target, factor] of [
      [1500, 1],
      [1500.001, 1.5],
      [2000, 1.5],
      [2000.001, 2],
    ]) {
      const p = {
        ...profile,
        heightCm: (target! / 1.2 - 655 - 9.6 * 75 + 4.7 * 20) / 1.8,
      };
      // Use male profiles for the lower boundary to stay inside physical input limits.
      const q = {
        ...p,
        sex: "male" as const,
        heightCm: (target! / 1.2 - 66 - 13.7 * 75 + 6.8 * 20) / 5,
      };
      expect(calculateStrategy(q, "maintenance").proteinG).toBe(75 * factor!);
    }
  });
  it("converte percentuais e calcula energia a partir de gramas", () => {
    const s = calculateStrategy(profile, "maintenance", "custom-percent", {
      targetKcal: 2000,
      macros: { proteinG: 30, carbsG: 50, fatG: 20 },
    });
    expect(s.proteinG).toBe(150);
    expect(s.carbsG).toBe(250);
    expect(s.fatG).toBeCloseTo(400 / 9);
    const g = calculateStrategy(profile, "maintenance", "custom-grams", {
      macros: { proteinG: 150, carbsG: 250, fatG: 60 },
    });
    expect(g.targetKcal).toBe(2140);
  });
  it("rejeita percentuais, medidas e resultados impossíveis", () => {
    expect(() =>
      calculateStrategy(profile, "maintenance", "custom-percent", {
        macros: { proteinG: 30, carbsG: 30, fatG: 30 },
      }),
    ).toThrow("100%");
    expect(() => basalMetabolism({ ...profile, weightKg: NaN })).toThrow();
    expect(() => basalMetabolism({ ...profile, age: 20.5 })).toThrow();
    expect(() =>
      calculateStrategy(profile, "maintenance", "custom-grams", {
        macros: { proteinG: -1, carbsG: 250, fatG: 60 },
      }),
    ).toThrow();
    expect(() =>
      calculateStrategy({ ...profile, weightKg: 500, heightCm: 50 }, "cutting"),
    ).toThrow();
  });
});
