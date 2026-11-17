import { afterEach, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { addItem, addMeal, createDiet, moveMeal } from "../src/core/meals";
import { StorageService } from "../src/services/storage-service";
import type { Bundle } from "../src/types/models";
import { DEFAULT_REPORT_SETTINGS } from "../src/core/report";
const folders: string[] = [];
afterEach(async () => {
  for (const folder of folders.splice(0))
    await rm(folder, { recursive: true, force: true });
});
async function setup(): Promise<{
  folder: string;
  storage: StorageService;
  bundle: Bundle;
}> {
  const folder = await mkdtemp(path.join(os.tmpdir(), "dietas-test-"));
  folders.push(folder);
  const storage = new StorageService(folder, new Set(["1"]));
  const diet = createDiet();
  return {
    folder,
    storage,
    bundle: {
      customFoods: [],
      workspace: {
        schemaVersion: 1,
        diets: [diet],
        activeDietId: diet.id,
        settings: { section: "diet" },
      },
    },
  };
}
it("persiste e reabre o JSON e suas configurações", async () => {
  const { folder, storage, bundle } = await setup();
  await storage.save(bundle);
  const reopened = await new StorageService(folder, new Set(["1"])).load();
  expect(reopened.workspace).toEqual(bundle.workspace);
  expect(reopened.customFoods).toEqual([]);
  expect(await readdir(folder)).toContain("alimentos-personalizados.json");
});
it("preserva o cabeçalho personalizado ao fechar e reabrir os dados", async () => {
  const { storage, bundle } = await setup();
  bundle.workspace.diets[0]!.report = {
    ...DEFAULT_REPORT_SETTINGS,
    title: "Plano personalizado",
    professionalName: "Clínica Silva",
    patientName: "Ana",
    showUpdatedAt: false,
  };
  await storage.save(bundle);
  expect((await storage.load()).workspace.diets[0]!.report).toEqual(
    bundle.workspace.diets[0]!.report,
  );
});
it("preserva quantidade, ordem e conteúdo de refeições novas e antigas", async () => {
  const { storage, bundle } = await setup();
  const diet = bundle.workspace.diets[0]!;
  addItem(diet.meals[0]!, "1", 150);
  moveMeal(diet, diet.meals[0]!.id, 4);
  await storage.save(bundle);
  expect((await storage.load()).workspace.diets[0]!.meals).toEqual(diet.meals);
  for (let i = 0; i < 15; i++) addMeal(diet);
  moveMeal(diet, diet.meals[19]!.id, 1);
  await storage.save(bundle);
  expect((await storage.load()).workspace.diets[0]!.meals).toEqual(diet.meals);
});
it("recupera backup e preserva o arquivo corrompido", async () => {
  const { folder, storage, bundle } = await setup();
  await storage.save(bundle);
  bundle.workspace.diets[0]!.name = "Segunda versão";
  await storage.save(bundle);
  await writeFile(path.join(folder, "dietas.json"), "{broken");
  const restored = await storage.load();
  expect(restored.workspace.diets[0]!.name).toBe("Minha dieta");
  expect(restored.warnings).toHaveLength(1);
  expect(
    (await readdir(folder)).some((f) => f.startsWith("dietas.json.corrupt-")),
  ).toBe(true);
  expect(
    JSON.parse(await readFile(path.join(folder, "dietas.json.bak"), "utf-8"))
      .diets[0].name,
  ).toBe("Minha dieta");
});
it("não sobrescreve dados quando ambos os arquivos estão corrompidos", async () => {
  const { folder, storage } = await setup();
  await writeFile(path.join(folder, "dietas.json"), "{broken");
  await writeFile(path.join(folder, "dietas.json.bak"), "{broken backup");
  await expect(storage.load()).rejects.toThrow("preservados");
  expect(await readFile(path.join(folder, "dietas.json"), "utf-8")).toBe(
    "{broken",
  );
});
it("serializa gravações simultâneas e o backup contém a versão anterior completa", async () => {
  const { folder, storage, bundle } = await setup();
  const next = structuredClone(bundle);
  next.workspace.diets[0]!.name = "Versão final";
  await Promise.all([storage.save(bundle), storage.save(next)]);
  expect((await storage.load()).workspace.diets[0]!.name).toBe("Versão final");
  expect(
    JSON.parse(await readFile(path.join(folder, "dietas.json.bak"), "utf-8"))
      .diets[0].name,
  ).toBe("Minha dieta");
});
it("recupera a coerência se a energia cair entre as gravações do catálogo e das dietas", async () => {
  const { folder, storage, bundle } = await setup();
  bundle.customFoods.push({
    id: "custom-test",
    name: "Alimento teste",
    source: "custom",
    unit: "100g",
    kcalPer100g: 100,
    proteinPer100g: 10,
    carbsPer100g: 10,
    fatPer100g: 2,
    needsReview: false,
    reviewReasons: [],
  });
  addItem(bundle.workspace.diets[0]!.meals[0]!, "custom-test");
  await storage.save(bundle);
  await storage.save(bundle);
  // Simulates a newer catalog (deletion) being renamed while old diets remain.
  await writeFile(path.join(folder, "alimentos-personalizados.json"), "[]");
  const restored = await storage.load();
  expect(restored.customFoods[0]!.id).toBe("custom-test");
  expect(restored.workspace.diets[0]!.meals[0]!.items[0]!.foodId).toBe(
    "custom-test",
  );
  expect(restored.warnings[0]).toContain("consistente");
});
