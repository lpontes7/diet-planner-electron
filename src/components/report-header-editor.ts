import type { Diet, ReportSettings } from '../types/models';
import { reportSettings } from '../core/report';
import { validateReportSettings } from '../core/validation';
import { escapeHtml as e } from './ui';

export function renderReportHeaderEditor(root: HTMLElement, diet: Diet, update: (settings: ReportSettings) => void): void {
  const settings = reportSettings(diet);
  const input = (name: keyof ReportSettings, label: string, max: number, placeholder = '') => `<label class="field"><span>${label}</span><input name="${name}" type="text" maxlength="${max}" value="${e(settings[name])}" placeholder="${e(placeholder)}"></label>`;
  root.innerHTML = `<details class="report-header-editor no-print"><summary><span>Personalizar cabeçalho</span><small>Título, identificação e aparência</small></summary><form id="report-header-form"><div class="field-grid">${input('title', 'Título do relatório', 120, diet.name)}${input('subtitle', 'Subtítulo', 180)}${input('patientName', 'Nome da pessoa', 120, 'Nome que aparecerá nos dados pessoais')}${input('professionalName', 'Profissional, clínica ou assinatura', 120)}${input('contact', 'Contato ou identificação profissional', 180, 'Ex.: telefone, e-mail ou registro profissional')}<label class="field report-color-field"><span>Cor de destaque do cabeçalho</span><input name="accentColor" type="color" value="${e(settings.accentColor)}"></label><label class="report-date-option"><input name="showUpdatedAt" type="checkbox" ${settings.showUpdatedAt ? 'checked' : ''}> Exibir data de atualização</label></div><p class="report-editor-note">As alterações válidas são salvas automaticamente nesta dieta e incluídas no PDF. Deixe o título vazio para usar o nome do plano.</p><p data-header-error class="form-error" role="alert"></p></form></details>`;
  const form = root.querySelector('form')!;
  const error = root.querySelector<HTMLElement>('[data-header-error]')!;
  const apply = () => {
    const data = new FormData(form);
    try {
      const report = validateReportSettings({
        title: data.get('title'), subtitle: data.get('subtitle'), patientName: data.get('patientName'),
        professionalName: data.get('professionalName'), contact: data.get('contact'),
        accentColor: data.get('accentColor'), showUpdatedAt: data.has('showUpdatedAt'),
      });
      update(report); error.textContent = '';
    } catch (cause) { error.textContent = cause instanceof Error ? cause.message : 'Confira os campos do cabeçalho.'; }
  };
  form.addEventListener('input', apply);
  form.addEventListener('submit', event => { event.preventDefault(); apply(); });
}
