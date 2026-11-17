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

// HTML dragover needs a second move in some browsers/runners:
// https://playwright.dev/docs/input#drag-and-drop
async function dragMeal(page, sourceCard, targetCard) {
  const handle = sourceCard.locator('.meal-drag-handle');
  const target = targetCard.locator('.meal-header');
  await handle.hover();
  const sourceBox = await handle.boundingBox();
  assert.ok(sourceBox, 'A alça de arraste deve estar visível');
  await page.mouse.down();
  try {
    // Start the gesture while still over the handle, before scrolling to a target.
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + 2, { steps: 8 });
    await expect(sourceCard).toHaveClass(/meal-dragging/);
    // Drop on header padding, away from the editable name/time fields.
    await target.hover({ position: { x: 8, y: 8 } });
    await target.hover({ position: { x: 10, y: 10 } });
    await expect(targetCard).toHaveClass(/meal-drop-(before|after)/);
  } finally {
    await page.mouse.up();
  }
}

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
  // The person's name is entered with the physical profile and shared with reports.
  await expect(page.locator('#profile-form [name="patientName"]')).toHaveValue('');
  await page.locator('#profile-form [name="patientName"]').fill('   ');
  await page.getByRole('button', { name: 'Aplicar perfil' }).click();
  await expect(page.locator('[data-form-error]')).toContainText('Informe o nome da pessoa');
  await page.locator('#profile-form [name="patientName"]').fill('  Maria & João  ');
  await page.getByRole('button', { name: 'Aplicar perfil' }).click();
  await expect(page.locator('#profile-form [name="patientName"]')).toHaveValue('Maria & João');
  await expect(page.locator('.energy-estimate').first()).toContainText('1.587');
  await page.locator('[data-section="report"]').click();
  await expect(page.locator('.report-profile')).toContainText('Maria & João');
  await page.locator('[data-section="profile"]').click();
  await expect(page.locator('#profile-form [name="patientName"]')).toHaveValue('Maria & João');
  await page.screenshot({ path: path.join(artifacts, 'perfil.png'), fullPage: true });

  await page.locator('[data-section="strategy"]').click();
  await expect(page.locator('#strategy-preview')).toContainText('1.904,4');
  await page.locator('[name="mode"]').selectOption('custom-percent');
  await page.locator('[name="proteinG"]').fill('30');
  await expect(page.locator('#strategy-preview')).toContainText('100%');
  await page.locator('[name="mode"]').selectOption('standard');
  await page.getByRole('button', { name: 'Aplicar estratégia' }).click();
  await page.locator('[data-section="diet"]').click();
  await expect(page.locator('.meal-card')).toHaveCount(5);
  const defaultMeals = ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Janta'];
  assert.deepEqual(await page.locator('[data-name]').evaluateAll(inputs => inputs.map(input => input.value)), defaultMeals);
  await expect(page.locator('.move-meal-up').first()).toBeDisabled();
  await expect(page.locator('.move-meal-down').last()).toBeDisabled();
  await page.locator('[data-section="report"]').click();
  await expect(page.locator('.report-meal')).toHaveCount(5);
  await page.locator('[data-section="diet"]').click();
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

  // Native dragging and keyboard controls move the complete meal with its foods.
  // Exercise the smaller viewport seen on the Windows runner as well.
  const originalViewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  await page.setViewportSize({ width: 1000, height: 680 });
  for (let gesture = 0; gesture < 3; gesture++) {
    await dragMeal(page, page.locator('.meal-card').first(), page.locator('.meal-card').nth(1));
    await expect(page.locator('[data-name]').nth(1)).toHaveValue('Café da manhã');
    await expect(page.locator('.meal-card').nth(1).locator('[data-quantity]')).toHaveValue('150');
    await expect(page.locator('.meal-card').nth(1).locator('[data-time]')).toHaveValue('07:00');
    await dragMeal(page, page.locator('.meal-card').nth(1), page.locator('.meal-card').first());
    await expect(page.locator('[data-name]').first()).toHaveValue('Café da manhã');
  }
  await page.locator('.move-meal-down').first().press('Enter');
  await expect(page.locator('[data-name]').nth(1)).toHaveValue('Café da manhã');
  await page.setViewportSize(originalViewport);
  for (let i = 0; i < 15; i++) await page.locator('#add-meal').click();
  await expect(page.locator('.meal-card')).toHaveCount(20);
  await expect(page.locator('#add-meal')).toBeDisabled();
  const mealOrder = [defaultMeals[1], defaultMeals[0], ...defaultMeals.slice(2), ...Array.from({ length: 15 }, (_, i) => `Refeição ${i + 6}`)];
  assert.deepEqual(await page.locator('[data-name]').evaluateAll(inputs => inputs.map(input => input.value)), mealOrder);

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
  assert.deepEqual(saved.diets[0].meals.map(meal => meal.name), mealOrder);
  assert.equal(saved.diets[0].meals[1].items[0].quantityG, 150);
  assert.equal(saved.diets[0].meals[7].items.length, 1);
  assert.equal(JSON.parse(await fs.readFile(path.join(storageDirectory, 'alimentos-personalizados.json'), 'utf-8'))[0].name, 'Iogurte editado');

  // Exercise the native PDF and JSON IPC paths; only the OS picker is replaced.
  await page.locator('[data-section="report"]').click();
  assert.equal(await page.locator('.report-meal').count(), 20);
  await expect(page.locator('.report-meal').first()).toContainText('1. Lanche da manhã');
  await expect(page.locator('.report-meal').nth(1)).toContainText('2. Café da manhã');
  await expect(page.locator('.report-meal').nth(7)).toContainText('Iogurte editado');
  await expect(page.locator('.macro-pie [data-macro]')).toHaveCount(3);
  assert.ok(Math.abs(Number(await page.locator('.macro-pie [data-macro="protein"]').getAttribute('data-percentage')) - 23.629489603024577) < 1e-10);
  await expect(page.locator('.adopted-calories')).toContainText('1.904,4');
  await expect(page.locator('.report-mark')).toHaveCount(0);
  await expect(page.locator('.report-sheet')).not.toContainText('Padrão da planilha');
  await expect(page.locator('.report-sheet')).not.toContainText('Fórmulas históricas reproduzidas');

  await page.getByText('Personalizar cabeçalho', { exact: true }).click();
  const header = page.locator('#report-header-form');
  await header.locator('[name="title"]').fill('Plano alimentar personalizado');
  await header.locator('[name="subtitle"]').fill('Acompanhamento nutricional');
  await header.locator('[name="patientName"]').fill('Ana Maria');
  await header.locator('[name="professionalName"]').fill('Nutricionista Silva');
  await header.locator('[name="contact"]').fill('contato@exemplo.test');
  await header.locator('[name="accentColor"]').evaluate(input => { input.value = '#6D597A'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await header.locator('[name="showUpdatedAt"]').uncheck();
  await expect(page.locator('.report-heading h1')).toHaveText('Plano alimentar personalizado');
  await expect(page.locator('.report-profile')).toContainText('Ana Maria');
  await expect(page.locator('.report-identity')).toContainText('Nutricionista Silva');
  await expect(page.locator('.report-updated')).toHaveCount(0);
  await expect(page.locator('.report-accent rect')).toHaveAttribute('fill', '#6d597a');
  await page.locator('[data-section="profile"]').click();
  await expect(page.locator('#profile-form [name="patientName"]')).toHaveValue('Ana Maria');
  await page.getByRole('button', { name: 'Aplicar perfil' }).click();
  await page.locator('[data-section="report"]').click();
  await expect(page.locator('.report-heading h1')).toHaveText('Plano alimentar personalizado');
  await expect(page.locator('.report-identity')).toContainText('Nutricionista Silva');
  await expect(page.locator('.report-accent rect')).toHaveAttribute('fill', '#6d597a');

  // The report follows goal, target and macro changes; meal totals are independent.
  await page.locator('[data-section="strategy"]').click();
  await page.locator('[name="goal"][value="bulking"]').check();
  await page.getByRole('button', { name: 'Aplicar estratégia' }).click();
  await page.locator('[data-section="report"]').click();
  await expect(page.locator('.adopted-calories')).toContainText('2.404,4');
  await page.locator('[data-section="strategy"]').click();
  await page.locator('[name="goal"][value="maintenance"]').check();
  await page.locator('[name="mode"]').selectOption('custom-percent');
  await page.locator('[name="targetKcal"]').fill('2000');
  for (const [key, value] of Object.entries({ proteinG: '30', fatG: '20', carbsG: '50' })) await page.locator(`[name="${key}"]`).fill(value);
  await page.getByRole('button', { name: 'Aplicar estratégia' }).click();
  await page.locator('[data-section="report"]').click();
  await expect(page.locator('.adopted-calories')).toContainText('2.000');
  await expect(page.locator('.macro-pie [data-macro="protein"]')).toHaveAttribute('data-percentage', '30');
  await expect(page.locator('.macro-legend [data-legend="protein"]')).toContainText('150 g');
  await page.locator('[data-section="strategy"]').click();
  for (const [key, value] of Object.entries({ proteinG: '0', fatG: '0', carbsG: '100' })) await page.locator(`[name="${key}"]`).fill(value);
  await page.getByRole('button', { name: 'Aplicar estratégia' }).click();
  await page.locator('[data-section="report"]').click();
  await expect(page.locator('.macro-pie circle[data-macro="carbs"]')).toHaveAttribute('data-percentage', '100');
  await expect(page.locator('.macro-pie [data-macro]')).toHaveCount(1);
  await page.locator('[data-section="strategy"]').click();
  await page.locator('[name="mode"]').selectOption('standard');
  await page.getByRole('button', { name: 'Aplicar estratégia' }).click();
  await page.locator('[data-section="report"]').click();
  await expect(page.locator('.macro-pie [data-macro]')).toHaveCount(3);
  await expect(page.locator('.report-heading h1')).toHaveText('Plano alimentar personalizado');
  await page.locator('.report-overview').screenshot({ path: path.join(artifacts, 'grafico-macros.png') });
  for (const width of [800, 600]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await expect(page.locator('.macro-pie')).toBeVisible();
  }
  await page.screenshot({ path: path.join(artifacts, 'relatorio-600px.png'), fullPage: true });
  await page.setViewportSize({ width: 1360, height: 920 });
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#report-header-controls')).toBeHidden();
  await expect(page.locator('.macro-pie')).toBeVisible();
  assert.equal(await page.locator('.report-meal').count(), 20);
  await page.emulateMedia({ media: 'screen' });
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
  assert.equal(exported.diet.report.patientName, 'Ana Maria');
  assert.equal(exported.diet.report.title, 'Plano alimentar personalizado');
  await app.evaluate(({ dialog }, target) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [target] }); }, jsonPath);
  await page.locator('#import-diet').click();
  await expect(page.locator('#toast')).toContainText('Dieta importada');
  assert.equal(await page.locator('.saved-diet').count(), 2);
  await page.getByText('Salvo localmente', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(artifacts, 'relatorio.png'), fullPage: true });

  // Reopen the actual Electron app and prove that all references persisted.
  await app.close(); page = await launch();
  await expect(page.locator('#diet-name')).toHaveValue('Plano de aceitação (importada)');
  await expect(page.locator('.report-heading h1')).toHaveText('Plano alimentar personalizado');
  await expect(page.locator('.report-profile')).toContainText('Ana Maria');
  await expect(page.locator('.report-accent rect')).toHaveAttribute('fill', '#6d597a');
  await page.locator('[data-section="profile"]').click();
  await expect(page.locator('#profile-form [name="patientName"]')).toHaveValue('Ana Maria');
  await page.locator('[data-section="diet"]').click();
  assert.deepEqual(await page.locator('[data-name]').evaluateAll(inputs => inputs.map(input => input.value)), mealOrder);
  await expect(page.locator('.meal-card').nth(7)).toContainText('Iogurte editado');
  await page.locator('#duplicate-diet').click();
  await expect(page.locator('#diet-name')).toHaveValue('Plano de aceitação (importada) (cópia)');
  await page.locator('#clear-diet').click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  assert.equal(await page.locator('[data-item]').count(), 2);
  await page.locator('#clear-diet').click();
  await page.getByRole('button', { name: 'Limpar refeições', exact: true }).click();
  await expect(page.locator('[data-item]')).toHaveCount(0);

  // Import a full 120-item plan and check both meal and food limits.
  const full = structuredClone(exported); full.diet.id = uid(); full.diet.name = 'Plano completo 120 alimentos';
  full.diet.meals.forEach(meal => { meal.items = Array.from({ length: 6 }, () => ({ id: uid(), foodId: banana.id, quantityG: 100 })); });
  const fullPath = path.join(directory, 'completo.json'); await fs.writeFile(fullPath, JSON.stringify(full));
  await page.locator('[data-section="report"]').click();
  await app.evaluate(({ dialog }, target) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [target] }); }, fullPath);
  await page.locator('#import-diet').click();
  await expect(page.locator('#toast')).toContainText('Dieta importada');
  await page.locator('[data-section="diet"]').click();
  assert.equal(await page.locator('[data-item]').count(), 120);
  assert.equal(await page.locator('.add-food:disabled').count(), 20);
  await expect(page.locator('#add-meal')).toBeDisabled();
  await page.locator('[data-section="report"]').click();
  await expect(page.locator('.report-meal')).toHaveCount(20);
  await page.locator('[data-section="diet"]').click();
  await page.setViewportSize({ width: 800, height: 900 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: path.join(artifacts, 'dieta-800px.png'), fullPage: true });

  // A shorter import stays at five meals, including after closing and reopening.
  const short = structuredClone(exported); short.diet.meals = short.diet.meals.slice(0, 5);
  const shortPath = path.join(directory, 'cinco-refeicoes.json'); await fs.writeFile(shortPath, JSON.stringify(short));
  await page.locator('[data-section="report"]').click();
  await app.evaluate(({ dialog }, target) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [target] }); }, shortPath);
  await page.locator('#import-diet').click();
  await expect(page.locator('#toast')).toContainText('Dieta importada');
  await expect(page.locator('.report-meal')).toHaveCount(5);
  await page.locator('[data-section="diet"]').click();
  await expect(page.locator('.meal-card')).toHaveCount(5);
  await page.getByText('Salvo localmente', { exact: true }).waitFor();
  await app.close(); page = await launch();
  await expect(page.locator('.meal-card')).toHaveCount(5);
  assert.deepEqual(await page.locator('[data-name]').evaluateAll(inputs => inputs.map(input => input.value)), mealOrder.slice(0, 5));
  await expect(page.locator('.meal-card').nth(1).locator('[data-quantity]')).toHaveValue('150');
  await expect(page.locator('#add-meal')).toBeEnabled();
  await page.screenshot({ path: path.join(artifacts, 'cinco-refeicoes.png'), fullPage: true });
  await page.getByText('Salvo localmente', { exact: true }).waitFor();
  await app.close(); app = null;
  assert.deepEqual(errors, []);
  console.log(`Dietas App ${expectedVersion} acceptance passed (${packagedArchive ? 'isolated app.asar without project node_modules' : 'development build'}): calculations, 620 foods, custom CRUD, unknown values, five default meals, adding up to twenty/120 items, native drag and keyboard reordering, live macro chart, report customization, JSON import/export, PDF/print styles, persistence, confirmation and responsive layout. Artifacts: ${artifacts}. Temporary data: ${directory}`);
})().catch(async error => {
  console.error(error);
  if (app) { try { const page = await app.firstWindow(); await page.screenshot({ path: path.join(root, 'artifacts', 'failure.png') }); } catch {} try { await app.evaluate(({ app }) => app.exit(1)); } catch {} }
  process.exitCode = 1;
});
