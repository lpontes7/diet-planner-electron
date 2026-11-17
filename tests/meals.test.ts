import { expect, it } from 'vitest';
import { addItem, clearMeals, createDiet, duplicateDiet } from '../src/core/meals';
import { validateDiet } from '../src/core/validation';
it('limita refeições a oito e alimentos a seis', () => {
  const diet = createDiet(); expect(diet.meals).toHaveLength(8);
  for (let i = 0; i < 6; i++) addItem(diet.meals[0]!, '1');
  expect(() => addItem(diet.meals[0]!, '2')).toThrow('seis');
  diet.meals.push(structuredClone(diet.meals[0]!));
  expect(() => validateDiet(diet)).toThrow('oito');
});
it('duplica sem compartilhar dados e limpa somente alimentos', () => {
  const diet = createDiet(); addItem(diet.meals[0]!, '1');
  const copy = duplicateDiet(diet);
  expect(copy.id).not.toBe(diet.id);
  expect(copy.meals[0]!.items[0]!.id).not.toBe(diet.meals[0]!.items[0]!.id);
  clearMeals(copy);
  expect(diet.meals[0]!.items).toHaveLength(1); expect(copy.meals[0]!.items).toHaveLength(0);
  expect(copy.profile).toEqual(diet.profile);
});
