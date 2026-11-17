import './styles/global.css';
import './styles/print.css';
import type { Bundle, Diet, DietFile, Food, Meal, Result, Section } from './types/models';
import { addItem, clearMeals, createDiet, createMeals, duplicateDiet, newId } from './core/meals';
import { calculateStrategy } from './core/strategy';
import { foodMap } from './services/food-service';
import { renderProfile } from './components/profile';
import { renderStrategy } from './components/strategy';
import { renderDiet } from './components/diet';
import { openCatalog } from './components/food-catalog';
import { reportHtml } from './components/report';
import { renderReportHeaderEditor } from './components/report-header-editor';
import { compact, confirmAction, escapeHtml as e, showModal, toast } from './components/ui';

let bundle: Bundle;
let dataPath = '';
let revision = 0;
let savedRevision = 0;
let saving = false;
let saveTimer: ReturnType<typeof setTimeout>;
const appRoot = document.getElementById('app')!;
const status = document.getElementById('save-status')!;
const headings: Record<Section, [string, string, string]> = {
  profile: ['Seu plano começa com você.', 'Um perfil atualizado deixa os próximos passos mais simples.', 'PERFIL FÍSICO'],
  strategy: ['Um objetivo. O seu caminho.', 'Defina sua meta de energia e encontre a distribuição do seu plano.', 'ESTRATÉGIA NUTRICIONAL'],
  diet: ['Seu plano, refeição por refeição.', 'Escolha os alimentos. Ajuste as porções. Acompanhe seu dia.', 'MONTAGEM DA DIETA'],
  report: ['Tudo pronto para acompanhar.', 'Revise seu planejamento, organize suas dietas e leve uma cópia com você.', 'RELATÓRIOS E DIETAS'],
};
function unwrap<T>(result: Result<T>): T { if (!result.ok) throw new Error(result.error); return result.data; }
function activeDiet(): Diet { return bundle.workspace.diets.find(d => d.id === bundle.workspace.activeDietId)!; }
function changed(updateDiet = true): void {
  if (updateDiet) activeDiet().updatedAt = new Date().toISOString(); revision++;
  status.textContent = 'Alterações pendentes'; status.parentElement!.classList.add('pending');
  clearTimeout(saveTimer); saveTimer = setTimeout(() => { void save(); }, 650);
}
async function save(): Promise<boolean> {
  if (saving) return false;
  saving = true; clearTimeout(saveTimer);
  const currentRevision = revision;
  status.textContent = 'Salvando…';
  try {
    unwrap(await window.dietas.save(structuredClone(bundle)));
    savedRevision = currentRevision;
    if (savedRevision === revision) { status.textContent = 'Salvo localmente'; status.parentElement!.classList.remove('pending'); }
    return true;
  } catch (error) {
    status.textContent = 'Falha ao salvar'; toast(error instanceof Error ? error.message : 'Falha ao salvar.', true); return false;
  } finally {
    saving = false;
    if (currentRevision !== revision) saveTimer = setTimeout(() => { void save(); }, 100);
  }
}
function navigate(section: Section): void {
  bundle.workspace.settings.section = section; changed(false); render(); window.scrollTo({ top: 0 });
}
function catalog(meal?: Meal): void {
  openCatalog({ customFoods: bundle.customFoods, diets: bundle.workspace.diets, meal,
    changed: () => { changed(); render(); },
    select: (food: Food) => { if (meal) { addItem(meal, food.id); changed(); render(); toast(`${food.name} adicionado à refeição.`); } },
  });
}
function fileFor(diet = activeDiet()): DietFile {
  const used = new Set(diet.meals.flatMap(m => m.items.map(i => i.foodId)));
  return { schemaVersion: 1, diet: structuredClone(diet), customFoods: structuredClone(bundle.customFoods.filter(f => used.has(f.id))) };
}
async function exportFile(mode: 'pdf' | 'print' | 'exportDiet'): Promise<void> {
  const button = document.getElementById(`action-${mode}`) as HTMLButtonElement | null;
  if (button) button.disabled = true;
  try {
    const done = unwrap(await window.dietas[mode](fileFor()));
    if (done) toast(mode === 'pdf' ? 'PDF completo salvo com as oito refeições.' : mode === 'print' ? 'Dieta enviada para impressão.' : 'Dieta exportada com os alimentos personalizados.');
  } catch (error) { toast(error instanceof Error ? error.message : 'Não foi possível concluir a operação.', true); }
  finally { if (button) button.disabled = false; }
}
async function importFile(): Promise<void> {
  try {
    const file = unwrap(await window.dietas.importDiet());
    if (!file) return;
    if (bundle.workspace.diets.length >= 500) throw new Error('Limite de 500 dietas atingido. Exporte e exclua dietas antigas.');
    if (bundle.customFoods.length + file.customFoods.length > 10000) throw new Error('A importação ultrapassa o limite de 10.000 alimentos personalizados.');
    const remap = new Map<string, string>();
    for (const food of file.customFoods) {
      const replacement = `custom-${newId()}`; remap.set(food.id, replacement);
      bundle.customFoods.push({ ...food, id: replacement });
    }
    const diet = duplicateDiet(file.diet);
    diet.name = `${file.diet.name.slice(0, 106)} (importada)`;
    diet.meals.forEach(m => m.items.forEach(i => { i.foodId = remap.get(i.foodId) ?? i.foodId; }));
    if (diet.meals.length < 8) diet.meals.push(...createMeals().slice(diet.meals.length));
    bundle.workspace.diets.push(diet); bundle.workspace.activeDietId = diet.id;
    changed(); render(); toast('Dieta importada. Alimentos personalizados foram incluídos sem substituir os existentes.');
  } catch (error) { toast(error instanceof Error ? error.message : 'Não foi possível importar.', true); }
}
function render(): void {
  const diet = activeDiet(), section = bundle.workspace.settings.section;
  document.querySelectorAll<HTMLButtonElement>('[data-section]').forEach(button => {
    button.classList.toggle('active', button.dataset.section === section);
    if (button.dataset.section === section) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
  });
  appRoot.innerHTML = `<div class="page-heading no-print"><div><span class="eyebrow">${headings[section][2]}</span><h1>${headings[section][0]}</h1><p>${headings[section][1]}</p></div><button id="open-catalog" class="button secondary">▤ <span>Catálogo de alimentos</span></button></div><div class="diet-toolbar no-print"><div class="diet-name-wrap"><span class="plan-icon" aria-hidden="true">▧</span><div><label for="diet-name">PLANO ATUAL</label><input id="diet-name" value="${e(diet.name)}" maxlength="120" required aria-label="Nome da dieta"></div><span class="local-chip">Somente neste computador</span></div><div class="toolbar-actions"><button id="new-diet" class="text-button">＋ Nova dieta</button><button id="duplicate-diet" class="text-button">Duplicar</button><button id="clear-diet" class="text-button danger-text">Limpar</button><button id="save-diet" class="button primary small">Salvar dieta</button></div></div><section id="section-content" aria-label="${headings[section][2]}"></section>`;
  const content = document.getElementById('section-content')!;
  document.getElementById('open-catalog')!.addEventListener('click', () => catalog());
  const name = document.getElementById('diet-name') as HTMLInputElement;
  name.addEventListener('input', () => {
    if (name.value.trim()) {
      diet.name = name.value.trim(); changed();
      const title = content.querySelector('.report-heading h1'); if (title && !diet.report?.title) title.textContent = diet.name;
      const savedTitle = content.querySelector('.saved-diet.current h3'); if (savedTitle) savedTitle.textContent = diet.name;
    }
  });
  name.addEventListener('blur', () => { name.value = diet.name; });
  document.getElementById('save-diet')!.addEventListener('click', async () => { if (await save()) toast('Dieta salva neste computador.'); });
  document.getElementById('new-diet')!.addEventListener('click', () => {
    if (bundle.workspace.diets.length >= 500) { toast('Limite de 500 dietas atingido.', true); return; }
    const fresh = createDiet(`Minha dieta ${bundle.workspace.diets.length + 1}`);
    bundle.workspace.diets.push(fresh); bundle.workspace.activeDietId = fresh.id; changed(); render(); toast('Nova dieta criada. O plano anterior continua salvo.');
  });
  document.getElementById('duplicate-diet')!.addEventListener('click', () => {
    if (bundle.workspace.diets.length >= 500) { toast('Limite de 500 dietas atingido.', true); return; }
    const copy = duplicateDiet(diet); bundle.workspace.diets.push(copy); bundle.workspace.activeDietId = copy.id; changed(); render(); toast('Dieta duplicada.');
  });
  document.getElementById('clear-diet')!.addEventListener('click', async () => {
    if (await confirmAction('Limpar todas as refeições?', `Todos os alimentos de “${diet.name}” serão removidos. O perfil, a estratégia e os horários serão mantidos.`, 'Limpar refeições')) {
      clearMeals(diet); changed(); render(); toast('Refeições limpas.');
    }
  });
  if (section === 'profile') renderProfile(content, diet.profile, profile => {
    const s = diet.strategy;
    const strategy = calculateStrategy(profile, s.goal, s.mode, s.mode === 'standard' ? undefined : { targetKcal: s.targetKcal, macros: s.mode === 'custom-percent' ? { proteinG: s.proteinG * 4 / s.targetKcal * 100, carbsG: s.carbsG * 4 / s.targetKcal * 100, fatG: s.fatG * 9 / s.targetKcal * 100 } : s });
    diet.profile = profile; diet.strategy = strategy; changed(); render(); toast('Perfil e metas atualizados.');
  });
  if (section === 'strategy') renderStrategy(content, diet, strategy => { diet.strategy = strategy; changed(); render(); toast('Estratégia aplicada.'); });
  if (section === 'diet') renderDiet(content, diet, foodMap(bundle.customFoods), { changed, selectFood: catalog, report: () => navigate('report') });
  if (section === 'report') renderReports(content);
}
function renderReports(root: HTMLElement): void {
  root.innerHTML = `<div class="report-actions no-print"><div><h2>Seu planejamento completo</h2><p>Perfil, metas e as oito refeições em um só documento.</p></div><div><button id="action-exportDiet" class="button secondary">Exportar JSON</button><button id="action-print" class="button secondary">Imprimir</button><button id="action-pdf" class="button primary">↓ Salvar PDF</button></div></div><div id="report-header-controls" class="no-print"></div><div class="report-preview">${reportHtml(activeDiet(), foodMap(bundle.customFoods))}</div><div class="saved-section no-print"><div class="section-heading"><div><span class="eyebrow">SUA ORGANIZAÇÃO</span><h2>Dietas salvas <small>${bundle.workspace.diets.length}</small></h2></div><button id="import-diet" class="button secondary">↑ Importar JSON</button></div><div class="saved-diets">${bundle.workspace.diets.map(diet => `<article class="saved-diet ${diet.id === activeDiet().id ? 'current' : ''}"><span class="saved-icon" aria-hidden="true">▧</span><div><h3>${e(diet.name)}</h3><p>${compact(diet.strategy.targetKcal)} kcal · ${diet.meals.reduce((n, m) => n + m.items.length, 0)} alimentos</p><small>${e(new Date(diet.updatedAt).toLocaleString('pt-BR'))}</small></div><div class="saved-actions">${diet.id === activeDiet().id ? '<span class="current-chip">Em edição</span>' : `<button class="text-button" data-open="${e(diet.id)}">Abrir dieta</button>`}<button class="text-button danger-text" data-delete-diet="${e(diet.id)}">Excluir</button></div></article>`).join('')}</div><p class="storage-path">Armazenamento local: ${e(dataPath)}</p></div>`;
  const diet = activeDiet();
  renderReportHeaderEditor(root.querySelector('#report-header-controls')!, diet, settings => {
    diet.report = settings; changed();
    root.querySelector('.report-preview')!.innerHTML = reportHtml(diet, foodMap(bundle.customFoods));
  });
  (['pdf', 'print', 'exportDiet'] as const).forEach(mode => root.querySelector(`#action-${mode}`)!.addEventListener('click', () => { void exportFile(mode); }));
  root.querySelector('#import-diet')!.addEventListener('click', () => { void importFile(); });
  root.querySelectorAll<HTMLElement>('[data-open]').forEach(button => button.addEventListener('click', () => { bundle.workspace.activeDietId = button.dataset.open!; navigate('diet'); toast('Dieta aberta.'); }));
  root.querySelectorAll<HTMLElement>('[data-delete-diet]').forEach(button => button.addEventListener('click', async () => {
    const diet = bundle.workspace.diets.find(d => d.id === button.dataset.deleteDiet)!;
    if (await confirmAction('Excluir dieta salva?', `“${diet.name}” será excluída deste computador. Exporte um JSON antes se quiser guardar uma cópia.`, 'Excluir dieta')) {
      bundle.workspace.diets = bundle.workspace.diets.filter(d => d.id !== diet.id);
      if (!bundle.workspace.diets.length) bundle.workspace.diets.push(createDiet());
      if (bundle.workspace.activeDietId === diet.id) bundle.workspace.activeDietId = bundle.workspace.diets[0]!.id;
      changed(); render(); toast('Dieta excluída.');
    }
  }));
}
async function bootstrap(): Promise<void> {
  try {
    if (!window.dietas) throw new Error('Abra o Dietas App pelo Electron com npm start. Acesso a arquivos está disponível somente no aplicativo desktop.');
    const loaded = unwrap(await window.dietas.load());
    bundle = { workspace: loaded.workspace, customFoods: loaded.customFoods }; dataPath = loaded.dataPath;
    // Files imported by previous versions may have fewer than eight meals.
    for (const diet of bundle.workspace.diets) if (diet.meals.length < 8) diet.meals.push(...createMeals().slice(diet.meals.length));
    document.querySelectorAll<HTMLButtonElement>('[data-section]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.section as Section)));
    document.querySelector('.brand')!.addEventListener('click', event => { event.preventDefault(); navigate('profile'); });
    render(); changed(false); await save();
    if (loaded.warnings.length) {
      const dialog = showModal(`<div class="dialog-heading"><div><h2>Dados recuperados do backup</h2></div></div><p>${loaded.warnings.map(e).join('<br>')}</p><div class="dialog-actions"><button class="button primary" data-close>Entendi</button></div>`, 'confirm-dialog');
      dialog.focus();
    }
  } catch (error) {
    status.textContent = 'Abertura interrompida';
    appRoot.innerHTML = `<div class="panel startup-error"><h1>Não foi possível abrir seus dados</h1><p>${e(error instanceof Error ? error.message : 'Erro desconhecido.')}</p><p>Os arquivos existentes foram preservados.</p><button id="retry" class="button primary">Tentar novamente</button></div>`;
    document.getElementById('retry')!.addEventListener('click', () => { void bootstrap(); });
  }
}
window.addEventListener('beforeunload', event => { if (revision !== savedRevision || saving) { event.preventDefault(); event.returnValue = ''; } });
void bootstrap();
