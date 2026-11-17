/* Real Electron acceptance test. Run `npm run build` first; needs a desktop/display. */
const { _electron: electron, expect } = require('playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
// Point to a copy of app.asar outside the repo to test the distributed bundle.
const packagedArchive = process.env.DIETAS_E2E_APP ? path.resolve(process.env.DIETAS_E2E_APP) : null;
let appEntry = root;
const expectedVersion = require('../package.json').version;
const foods = require('../src/data/alimentos.json');
const uid = () => crypto.randomUUID();
const errors = [];
let app;

(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dietas-e2e-'));
  if (packagedArchive) {
    appEntry = path.join(directory, 'app.asar');
    await fs.copyFile(packagedArchive, appEntry);
  }
  const artifacts = path.join(root, 'artifacts'); await fs.mkdir(artifacts, { recursive: true });
  const launch = async () => {
    const env = { ...process.env, DIETAS_DATA_DIR: directory }; delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_PATH;
    if (process.platform === 'linux') env.XDG_CONFIG_HOME = path.join(directory, 'config');
    if (process.platform === 'win32') {
      env.APPDATA = path.join(directory, 'roaming');
      env.LOCALAPPDATA = path.join(directory, 'local');
    }
    app = await electron.launch({ args: [appEntry, '--disable-gpu', ...(process.env.DIETAS_E2E_NO_SANDBOX === '1' ? ['--no-sandbox'] : [])], env, timeout: 30000 });
    const page = await app.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.dismiss());
    await page.waitForSelector('#diet-name', { timeout: 20000 });
    await page.getByText('Salvo localmente', { exact: true }).waitFor();
    return page;
  };
  let page = await launch();
  assert.equal(await app.evaluate(({ app }) => app.getVersion()), expectedVersion);
  const storageDirectory = await page.evaluate(async () => {
    const result = await window.dietas.load();
    if (!result.ok) throw new Error(result.error);
    return result.data.dataPath;
  });
  assert.ok(storageDirectory === directory || storageDirectory.startsWith(directory + path.sep), 'Dados de teste devem ficar na pasta temporária');
  const preferences = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
  assert.equal(preferences.contextIsolation, true); assert.equal(preferences.nodeIntegration, false); assert.equal(preferences.sandbox, true);
  assert.deepEqual(await page.evaluate(() => [typeof window.require, typeof window.process, typeof window.dietas.save]), ['undefined', 'undefined', 'function']);
  await expect(page.locator('.energy-estimate').first()).toContainText('1.587');
  await page.screenshot({ path: path.join(artifacts, 'perfil.png'), fullPage: true });

  await page.locator('[data-section="strategy"]').click();
  await expect(page.locator('#strategy-preview')).toContainText('1.904,4');
  await page.locator('[name="mode"]').selectOption('custom-percent');
  await page.locator('[name="proteinG"]').fill('30');
  await expect(page.locator('#strategy-preview')).toContainText('100%');
  await page.locator('[name="mode"]').selectOption('standard');
  await page.getByRole('button', { name: 'Aplicar estratégia' }).click();
  await page.locator('[data-section="diet"]').click();
  assert.equal(await page.locator('.meal-card').count(), 8);
  await page.locator('.add-food').first().click();
  await page.locator('#food-search').fill('banana prata crua');
  await expect(page.locator('#food-results')).toContainText('Banana, prata, crua');
  await page.locator('[data-select]').first().click();
  const banana = foods.find(f => f.name === 'Banana, prata, crua');
  await page.locator('[data-quantity]').first().fill('150');
  const expectedKcal = (banana.kcalPer100g * 1.5).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  await expect(page.locator('[data-nutrient="kcal"]').first()).toHaveText(expectedKcal);
  await page.locator('[data-quantity]').first().fill('0');
  await page.locator('.page-heading h1').click();
  await expect(page.locator('[data-quantity]').first()).toHaveValue('150');

  // Unknown nutrients stay unknown and require an explicit acknowledgement.
  await page.locator('.add-food').nth(1).click();
  await page.locator('#food-search').fill('Coco, verde, cru');
  await page.locator('[data-select="223"]').click();
  await page.getByRole('button', { name: 'Usar valores originais' }).click();
  await expect(page.locator('.daily-card')).toContainText('Total calórico incompleto');
  await page.locator('.remove-food').nth(1).click();

  // Custom catalog, input validation, editing and use in the eighth meal.
  await page.locator('#open-catalog').click();
  await page.locator('#new-food').click();
  await page.locator('#food-form [name="name"]').fill('Iogurte de teste');
  for (const [field, value] of Object.entries({ kcalPer100g: '100', proteinPer100g: '10', carbsPer100g: '12', fatPer100g: '2' })) await page.locator(`#food-form [name="${field}"]`).fill(value);
  await page.getByRole('button', { name: 'Salvar alimento', exact: true }).click();
  await page.locator('#food-filter').selectOption('custom');
  await expect(page.locator('#food-results')).toContainText('Iogurte de teste');
  await page.locator('[data-edit]').click();
  await page.locator('#food-form [name="name"]').fill('Iogurte editado');
  await page.getByRole('button', { name: 'Salvar alimento', exact: true }).click();
  await page.locator('#new-food').click();
  await page.locator('#food-form [name="name"]').fill('Alimento descartável');
  await page.getByRole('button', { name: 'Salvar alimento', exact: true }).click();
  await page.locator('#food-search').fill('Alimento descartável');
  await page.locator('[data-delete]').click();
  await page.getByRole('button', { name: 'Excluir alimento', exact: true }).click();
  await expect(page.locator('#food-results')).not.toContainText('Alimento descartável');
  await page.locator('[data-close]').click();
  await page.locator('.add-food').nth(7).click();
  await page.locator('#food-search').fill('Iogurte editado');
  await page.locator('[data-select]').click();
  await page.locator('#open-catalog').click();
  await page.locator('#food-filter').selectOption('custom');
  await page.locator('[data-delete]').click();
  await expect(page.locator('#toast')).toContainText('está em uma dieta');
  await page.locator('[data-close]').click();
  await page.locator('#diet-name').fill('Plano de aceitação');
  await page.locator('#save-diet').click();
  await page.getByText('Salvo localmente', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(artifacts, 'dieta.png'), fullPage: true });
  const saved = JSON.parse(await fs.readFile(path.join(storageDirectory, 'dietas.json'), 'utf-8'));
  assert.equal(saved.diets[0].meals[7].items.length, 1);
  assert.equal(JSON.parse(await fs.readFile(path.join(storageDirectory, 'alimentos-personalizados.json'), 'utf-8'))[0].name, 'Iogurte editado');

  // Exercise the native PDF and JSON IPC paths; only the OS picker is replaced.
  await page.locator('[data-section="report"]').click();
  assert.equal(await page.locator('.report-meal').count(), 8);
  await expect(page.locator('.report-meal').nth(7)).toContainText('Iogurte editado');
  const pdfPath = path.join(directory, 'relatorio.pdf');
  await app.evaluate(({ dialog }, target) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: target }); }, pdfPath);
  await page.locator('#action-pdf').click();
  await expect(page.locator('#toast')).toContainText('PDF completo salvo', { timeout: 20000 });
  const pdf = await fs.readFile(pdfPath); assert.equal(pdf.subarray(0, 5).toString(), '%PDF-'); assert.ok(pdf.length > 10000);
  await fs.copyFile(pdfPath, path.join(artifacts, 'relatorio.pdf'));
  const jsonPath = path.join(directory, 'exportacao.json');
  await app.evaluate(({ dialog }, target) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: target }); }, jsonPath);
  await page.locator('#action-exportDiet').click();
  await expect(page.locator('#toast')).toContainText('Dieta exportada');
  const exported = JSON.parse(await fs.readFile(jsonPath, 'utf-8')); assert.equal(exported.customFoods.length, 1);
  await app.evaluate(({ dialog }, target) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [target] }); }, jsonPath);
  await page.locator('#import-diet').click();
  await expect(page.locator('#toast')).toContainText('Dieta importada');
  assert.equal(await page.locator('.saved-diet').count(), 2);
  await page.getByText('Salvo localmente', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(artifacts, 'relatorio.png'), fullPage: true });

  // Reopen the actual Electron app and prove that all references persisted.
  await app.close(); page = await launch();
  await expect(page.locator('#diet-name')).toHaveValue('Plano de aceitação (importada)');
  await page.locator('[data-section="diet"]').click();
  await expect(page.locator('.meal-card').nth(7)).toContainText('Iogurte editado');
  await page.locator('#duplicate-diet').click();
  await expect(page.locator('#diet-name')).toHaveValue('Plano de aceitação (importada) (cópia)');
  await page.locator('#clear-diet').click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  assert.equal(await page.locator('[data-item]').count(), 2);
  await page.locator('#clear-diet').click();
  await page.getByRole('button', { name: 'Limpar refeições', exact: true }).click();
  await expect(page.locator('[data-item]')).toHaveCount(0);

  // Import a full 48-item plan, then check the sixth-item limit and eighth-meal total.
  const full = structuredClone(exported); full.diet.id = uid(); full.diet.name = 'Plano completo 48 alimentos';
  full.diet.meals.forEach(meal => { meal.items = Array.from({ length: 6 }, () => ({ id: uid(), foodId: banana.id, quantityG: 100 })); });
  const fullPath = path.join(directory, 'completo.json'); await fs.writeFile(fullPath, JSON.stringify(full));
  await page.locator('[data-section="report"]').click();
  await app.evaluate(({ dialog }, target) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [target] }); }, fullPath);
  await page.locator('#import-diet').click();
  await expect(page.locator('#toast')).toContainText('Dieta importada');
  await page.locator('[data-section="diet"]').click();
  assert.equal(await page.locator('[data-item]').count(), 48);
  assert.equal(await page.locator('.add-food:disabled').count(), 8);
  await page.setViewportSize({ width: 800, height: 900 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: path.join(artifacts, 'dieta-800px.png'), fullPage: true });
  await page.getByText('Salvo localmente', { exact: true }).waitFor();
  await app.close(); app = null;
  assert.deepEqual(errors, []);
  console.log(`Dietas App ${expectedVersion} acceptance passed (${packagedArchive ? 'isolated app.asar without project node_modules' : 'development build'}): calculations, 620 foods, custom CRUD, unknown values, eight meals/48 items, JSON import/export, PDF, persistence, confirmation and responsive layout. Artifacts: ${artifacts}. Temporary data: ${directory}`);
})().catch(async error => {
  console.error(error);
  if (app) { try { const page = await app.firstWindow(); await page.screenshot({ path: path.join(root, 'artifacts', 'failure.png') }); } catch {} try { await app.evaluate(({ app }) => app.exit(1)); } catch {} }
  process.exitCode = 1;
});
