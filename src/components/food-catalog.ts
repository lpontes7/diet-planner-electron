import type { Diet, Food, Meal } from "../types/models";
import { newId } from "../core/meals";
import { validateCustomFood } from "../core/validation";
import {
  foodInUse,
  originalFoods,
  reviewFood,
  searchFoods,
} from "../services/food-service";
import {
  bindForm,
  compact as f,
  confirmAction,
  escapeHtml as e,
  formNumber,
  showModal,
  toast,
} from "./ui";

interface CatalogOptions {
  customFoods: Food[];
  diets: Diet[];
  meal?: Meal;
  changed(): void;
  select(food: Food): void;
}
export function openCatalog(options: CatalogOptions): void {
  const { meal } = options;
  const dialog = showModal(
    `<div class="dialog-heading"><div><span class="eyebrow">${meal ? "ADICIONAR À REFEIÇÃO" : "SUA BIBLIOTECA NUTRICIONAL"}</span><h2>${meal ? e(meal.name) : "Catálogo de alimentos"}</h2><p>620 alimentos originais + ${options.customFoods.length} personalizados · valores por 100 g</p></div><button class="icon-button" data-close aria-label="Fechar catálogo">×</button></div><div class="catalog-tools"><label class="search-field"><span aria-hidden="true">⌕</span><input id="food-search" type="search" placeholder="Buscar alimento, preparo, ingrediente…" aria-label="Pesquisar alimentos" autofocus></label><button id="new-food" class="button primary">＋ Cadastrar</button></div><div class="catalog-filters"><label><span class="sr-only">Filtrar catálogo</span><select id="food-filter"><option value="all">Todos os alimentos</option><option value="original">Originais da planilha</option><option value="custom">Meus alimentos</option><option value="review">Dados a revisar</option></select></label><span id="search-count"></span></div><div id="food-results" class="catalog-results"></div><div class="catalog-footnote">P: proteínas · C: carboidratos · G: gorduras. —: valor desconhecido. Os dados originais são preservados.</div>`,
    "catalog-dialog",
  );
  let limit = 60;
  const search = dialog.querySelector<HTMLInputElement>("#food-search")!;
  const filter = dialog.querySelector<HTMLSelectElement>("#food-filter")!;
  function render(): void {
    const all = [...originalFoods, ...options.customFoods];
    const filtered = searchFoods(all, search.value).filter(
      (f) =>
        filter.value === "all" ||
        (filter.value === "review" ? f.needsReview : f.source === filter.value),
    );
    dialog.querySelector("#search-count")!.textContent =
      `${filtered.length} encontrados`;
    const results = dialog.querySelector("#food-results")!;
    results.innerHTML = filtered.length
      ? `${filtered
          .slice(0, limit)
          .map(
            (food) =>
              `<article class="catalog-food"><div class="catalog-food-info"><strong>${e(food.name)}</strong><div><span class="source-chip ${food.source}">${food.source === "original" ? "Planilha original" : "Personalizado"}</span>${food.needsReview ? `<span class="review-chip">⚠ Revisar dados</span>` : ""}</div><p>${f(food.kcalPer100g)} kcal <span>·</span> P ${f(food.proteinPer100g)} g <span>·</span> C ${f(food.carbsPer100g)} g <span>·</span> G ${f(food.fatPer100g)} g</p>${food.needsReview ? `<details><summary>Ver observações da origem</summary><p>${reviewFood(food).map(e).join("<br>")}</p>${food.originalValues ? `<p>Valores originais: ${e(JSON.stringify(food.originalValues))}</p>` : ""}</details>` : ""}</div><div class="catalog-food-actions">${meal ? `<button data-select="${e(food.id)}" class="button secondary small">Adicionar</button>` : ""}<button data-edit="${e(food.id)}" class="text-button">${food.source === "original" ? "Criar cópia" : "Editar"}</button>${food.source === "custom" ? `<button data-delete="${e(food.id)}" class="text-button danger-text" aria-label="Excluir ${e(food.name)}">Excluir</button>` : ""}</div></article>`,
          )
          .join(
            "",
          )}${filtered.length > limit ? '<button id="more-foods" class="button secondary full-width">Mostrar mais alimentos</button>' : ""}`
      : '<div class="empty-state"><h3>Nenhum alimento encontrado</h3><p>Tente outro termo ou cadastre seu próprio alimento.</p></div>';
    results.querySelector("#more-foods")?.addEventListener("click", () => {
      limit += 60;
      render();
    });
    results.querySelectorAll<HTMLElement>("[data-select]").forEach((button) =>
      button.addEventListener("click", async () => {
        const food = all.find((f) => f.id === button.dataset.select)!;
        if (food.needsReview) {
          const accepted = await confirmAction(
            "Usar alimento com dados a revisar?",
            `${food.name}. ${reviewFood(food).join("; ")}. Os valores não serão corrigidos automaticamente.`,
            "Usar valores originais",
            false,
          );
          if (!accepted) {
            openCatalog(options);
            return;
          }
        }
        options.select(food);
        dialog.close();
      }),
    );
    results.querySelectorAll<HTMLElement>("[data-edit]").forEach((button) =>
      button.addEventListener("click", () =>
        editFood(
          options,
          all.find((f) => f.id === button.dataset.edit),
        ),
      ),
    );
    results.querySelectorAll<HTMLElement>("[data-delete]").forEach((button) =>
      button.addEventListener("click", async () => {
        const food = all.find((f) => f.id === button.dataset.delete)!;
        if (foodInUse(food.id, options.diets)) {
          toast(
            "Este alimento está em uma dieta salva. Remova-o das refeições antes de excluir.",
            true,
          );
          return;
        }
        if (
          await confirmAction(
            "Excluir alimento personalizado?",
            `“${food.name}” será removido do seu catálogo.`,
            "Excluir alimento",
          )
        ) {
          const index = options.customFoods.findIndex((f) => f.id === food.id);
          options.customFoods.splice(index, 1);
          options.changed();
          toast("Alimento excluído.");
        }
        openCatalog(options);
      }),
    );
  }
  search.addEventListener("input", () => {
    limit = 60;
    render();
  });
  filter.addEventListener("change", () => {
    limit = 60;
    render();
  });
  dialog
    .querySelector("#new-food")!
    .addEventListener("click", () => editFood(options));
  render();
}
function editFood(options: CatalogOptions, original?: Food): void {
  const isCopy = original?.source === "original";
  const field = (key: keyof Food, label: string, max: number) =>
    `<label class="field"><span>${label}</span><input name="${key}" type="number" step="any" min="0" max="${max}" value="${typeof original?.[key] === "number" ? Math.max(0, Math.min(max, original[key] as number)) : ""}" placeholder="Desconhecido"></label>`;
  const dialog = showModal(
    `<div class="dialog-heading"><div><span class="eyebrow">CATÁLOGO PERSONALIZADO</span><h2>${original ? (isCopy ? "Criar cópia personalizada" : "Editar alimento") : "Cadastrar alimento"}</h2></div><button class="icon-button" data-close aria-label="Fechar cadastro">×</button></div><form id="food-form"><label class="field"><span>Nome do alimento</span><input name="name" maxlength="180" required value="${e(original?.name ?? "")}" placeholder="Ex.: Meu iogurte natural"></label><label class="field"><span>Base dos valores nutricionais</span><select name="unit"><option value="100g">100 gramas (100 g)</option></select></label><p class="info-box">Preencha os valores referentes a 100 g. Campo vazio significa desconhecido, nunca zero.${isCopy ? " Confira todos os campos: valores originais suspeitos precisam ser informados novamente." : ""}</p><div class="field-grid">${field("kcalPer100g", "Energia (kcal)", 1000)}${field("proteinPer100g", "Proteínas (g)", 100)}${field("carbsPer100g", "Carboidratos (g)", 100)}${field("fatPer100g", "Gorduras (g)", 100)}</div><p data-form-error class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" id="back-catalog" class="button secondary">Voltar</button><button type="submit" class="button primary">Salvar alimento</button></div></form>`,
    "food-dialog",
  );
  // Out-of-range originals remain untouched and are never silently normalized in a copy.
  if (original)
    for (const [key, max] of [
      ["kcalPer100g", 1000],
      ["proteinPer100g", 100],
      ["carbsPer100g", 100],
      ["fatPer100g", 100],
    ] as const) {
      const value = original[key];
      if (value !== null && (value < 0 || value > max))
        dialog.querySelector<HTMLInputElement>(`[name="${key}"]`)!.value = "";
    }
  dialog
    .querySelector("#back-catalog")!
    .addEventListener("click", () => openCatalog(options));
  bindForm(dialog.querySelector("form")!, (data) => {
    const nullable = (key: string): number | null =>
      String(data.get(key) ?? "").trim() === "" ? null : formNumber(data, key);
    const food = validateCustomFood({
      id: original && !isCopy ? original.id : `custom-${newId()}`,
      name: data.get("name"),
      unit: data.get("unit"),
      source: "custom",
      kcalPer100g: nullable("kcalPer100g"),
      proteinPer100g: nullable("proteinPer100g"),
      carbsPer100g: nullable("carbsPer100g"),
      fatPer100g: nullable("fatPer100g"),
    });
    const index = options.customFoods.findIndex((f) => f.id === food.id);
    if (index < 0 && options.customFoods.length >= 10000)
      throw new Error("Limite de 10.000 alimentos personalizados atingido.");
    if (index >= 0) options.customFoods[index] = food;
    else options.customFoods.push(food);
    options.changed();
    toast("Alimento salvo no catálogo personalizado.");
    openCatalog(options);
  });
}
