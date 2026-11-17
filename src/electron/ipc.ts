import { BrowserWindow, dialog, ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { writeFile } from 'node:fs/promises';
import type { Result } from '../types/models';
import { originalFoods } from '../services/food-service';
import { readJson, StorageService } from '../services/storage-service';
import { validateDietFile } from '../core/validation';
import { produceReport } from '../services/pdf-service';

export function registerIpc(getWindow: () => BrowserWindow | null, storage: StorageService): void {
  const ids = new Set(originalFoods.map(f => f.id));
  function handle(channel: string, action: (window: BrowserWindow, payload: unknown) => Promise<unknown>): void {
    ipcMain.handle(channel, async (event: IpcMainInvokeEvent, payload: unknown): Promise<Result<unknown>> => {
      try {
        const window = getWindow();
        if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Origem IPC não autorizada.');
        return { ok: true, data: await action(window, payload) };
      } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Não foi possível concluir a operação.' }; }
    });
  }
  handle('dietas:load', async () => storage.load());
  handle('dietas:save', async (_, payload) => storage.save(payload));
  handle('dietas:import', async window => {
    const chosen = await dialog.showOpenDialog(window, { title: 'Importar dieta', properties: ['openFile'], filters: [{ name: 'Dieta JSON', extensions: ['json'] }] });
    return chosen.canceled || !chosen.filePaths[0] ? null : validateDietFile(await readJson(chosen.filePaths[0]), ids);
  });
  handle('dietas:export', async (window, payload) => {
    const file = validateDietFile(payload, ids);
    const chosen = await dialog.showSaveDialog(window, { title: 'Exportar dieta', defaultPath: `${file.diet.name.replace(/[<>:"/\\|?*]/g, '_')}.json`, filters: [{ name: 'Dieta JSON', extensions: ['json'] }] });
    if (chosen.canceled || !chosen.filePath) return false;
    const destination = chosen.filePath.toLowerCase().endsWith('.json') ? chosen.filePath : `${chosen.filePath}.json`;
    // Export is a user-selected standalone file, with custom foods embedded.
    await writeFile(destination, JSON.stringify(file, null, 2) + '\n', 'utf-8');
    return true;
  });
  handle('dietas:pdf', async (window, payload) => produceReport(window, validateDietFile(payload, ids), 'pdf'));
  handle('dietas:print', async (window, payload) => produceReport(window, validateDietFile(payload, ids), 'print'));
}
