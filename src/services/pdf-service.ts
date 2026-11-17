import { BrowserWindow, dialog } from 'electron';
import { writeFile } from 'node:fs/promises';
import type { DietFile } from '../types/models';
import { reportHtml } from '../components/report';
import { foodMap } from './food-service';
import printCss from '../styles/print.css?inline';
import { escapeHtml } from '../components/ui';
import { reportTitle } from '../core/report';

export async function produceReport(parent: BrowserWindow, file: DietFile, mode: 'pdf' | 'print'): Promise<boolean> {
  let destination: string | undefined;
  if (mode === 'pdf') {
    const chosen = await dialog.showSaveDialog(parent, { title: 'Salvar dieta em PDF', defaultPath: `${file.diet.name.replace(/[<>:"/\\|?*]/g, '_')}.pdf`, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (chosen.canceled || !chosen.filePath) return false;
    destination = chosen.filePath.toLowerCase().endsWith('.pdf') ? chosen.filePath : `${chosen.filePath}.pdf`;
  }
  const printWindow = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, javascript: false } });
  printWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  try {
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';"><title>${escapeHtml(reportTitle(file.diet))}</title><style>${printCss}</style></head><body>${reportHtml(file.diet, foodMap(file.customFoods))}</body></html>`;
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    if (mode === 'pdf') {
      const pdf = await printWindow.webContents.printToPDF({ printBackground: true, pageSize: 'A4', preferCSSPageSize: true });
      await writeFile(destination!, pdf);
    } else {
      await new Promise<void>((resolve, reject) => printWindow.webContents.print({ printBackground: true }, (success, reason) => success ? resolve() : reject(new Error(reason || 'Impressão cancelada.'))));
    }
    return true;
  } finally { printWindow.destroy(); }
}
