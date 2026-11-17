import { expect, it } from 'vitest';
import { addItem, createDiet } from '../src/core/meals';
import { validateBundle, validateCustomFood, validateDiet, validateDietFile } from '../src/core/validation';
const food = { id: 'custom-example', source: 'custom', unit: '100g', name: 'Teste', kcalPer100g: 100, proteinPer100g: 2, carbsPer100g: 10, fatPer100g: 5 };
it('valida todos os campos numéricos independentemente e mantém null', () => {
  for (const field of ['kcalPer100g', 'proteinPer100g', 'carbsPer100g', 'fatPer100g']) expect(() => validateCustomFood({ ...food, [field]: 'texto' })).toThrow();
  expect(validateCustomFood({ ...food, carbsPer100g: null }).carbsPer100g).toBeNull();
  expect(() => validateCustomFood({ ...food, id: '1' })).toThrow();
  expect(() => validateCustomFood({ ...food, carbsPer100g: -0.01 })).toThrow();
  expect(() => validateCustomFood({ ...food, unit: 'unidade' })).toThrow();
});
it('rejeita formato, IDs duplicados, datas, horários e quantidades inválidas', () => {
  const diet = createDiet();
  expect(validateDiet(diet)).toEqual(diet);
  expect(() => validateDiet({ ...diet, meals: undefined })).toThrow();
  diet.meals[1]!.id = diet.meals[0]!.id; expect(() => validateDiet(diet)).toThrow('duplicados');
  const other = createDiet(); other.meals[0]!.time = '25:00'; expect(() => validateDiet(other)).toThrow('Horário');
  expect(() => validateDiet({ ...createDiet(), updatedAt: 'nunca' })).toThrow('Data');
  const quantity = createDiet(); addItem(quantity.meals[0]!, '1'); quantity.meals[0]!.items[0]!.quantityG = Infinity; expect(() => validateDiet(quantity)).toThrow('Quantidade');
});
it('valida arquivos portáveis e impede referências ausentes', () => {
  const diet = createDiet(); addItem(diet.meals[0]!, food.id);
  expect(() => validateDietFile({ schemaVersion: 1, diet, customFoods: [] }, new Set(['1']))).toThrow('ausente');
  expect(validateDietFile({ schemaVersion: 1, diet, customFoods: [food] }, new Set(['1'])).customFoods).toHaveLength(1);
  expect(() => validateDietFile({ schemaVersion: 99, diet, customFoods: [food] }, new Set(['1']))).toThrow('Versão');
  expect(() => validateBundle({ workspace: { schemaVersion: 1, diets: [diet, diet], activeDietId: diet.id, settings: { section: 'diet' } }, customFoods: [food] }, new Set(['1']))).toThrow('duplicados');
});
