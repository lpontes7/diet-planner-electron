export function escapeHtml(value: unknown): string {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export const format = (n: number | null, digits = 1): string =>
  n === null
    ? "Não informado"
    : n.toLocaleString("pt-BR", { maximumFractionDigits: digits });
export const compact = (n: number | null, digits = 1): string =>
  n === null ? "—" : format(n, digits);
export function numberInput(
  name: string,
  label: string,
  value: number,
  min: number,
  max: number,
  step = "any",
): string {
  return `<label class="field"><span>${label}</span><input name="${name}" type="number" required min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
}
export function formNumber(data: FormData, name: string): number {
  const value = data.get(name);
  return typeof value === "string" && value.trim() ? Number(value) : NaN;
}
export function toast(message: string, error = false): void {
  const root = document.getElementById("toast")!;
  root.textContent = message;
  root.className = `toast visible ${error ? "error" : ""}`;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    root.className = "toast";
  }, 5500);
}
let timer: number;
export function showModal(content: string, className = ""): HTMLDialogElement {
  const dialog = document.getElementById("modal") as HTMLDialogElement;
  dialog.innerHTML = content;
  dialog.className = className;
  if (!dialog.open) dialog.showModal();
  dialog
    .querySelectorAll("[data-close]")
    .forEach((button) =>
      button.addEventListener("click", () => dialog.close()),
    );
  return dialog;
}
export function confirmAction(
  title: string,
  description: string,
  action = "Confirmar",
  destructive = true,
): Promise<boolean> {
  const dialog = showModal(
    `<div class="dialog-heading"><div><span class="eyebrow">${destructive ? "Confirme a ação" : "Confira os dados"}</span><h2>${escapeHtml(title)}</h2></div></div><p class="dialog-description">${escapeHtml(description)}</p><div class="dialog-actions"><button data-close class="button secondary">Cancelar</button><button id="confirm-action" class="button ${destructive ? "danger" : "primary"}">${escapeHtml(action)}</button></div>`,
    "confirm-dialog",
  );
  return new Promise((resolve) => {
    let accepted = false;
    dialog.querySelector("#confirm-action")!.addEventListener("click", () => {
      accepted = true;
      dialog.close();
    });
    dialog.addEventListener("close", () => resolve(accepted), { once: true });
  });
}
export function bindForm(
  form: HTMLFormElement,
  callback: (data: FormData) => void,
): void {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const error = form.querySelector<HTMLElement>("[data-form-error]")!;
    try {
      callback(new FormData(form));
      error.textContent = "";
    } catch (e) {
      error.textContent =
        e instanceof Error ? e.message : "Não foi possível aplicar os dados.";
    }
  });
}
