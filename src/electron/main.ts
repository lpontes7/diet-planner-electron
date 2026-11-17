import { app, BrowserWindow, dialog, Menu, session } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { StorageService } from '../services/storage-service';
import { originalFoods } from '../services/food-service';
import { registerIpc } from './ipc';

app.setName('DietasApp');
// An isolated directory is useful for development/acceptance tests without touching real diets.
if (!app.isPackaged && process.env.DIETAS_DATA_DIR) app.setPath('userData', path.resolve(process.env.DIETAS_DATA_DIR));
if (started) app.quit();
let mainWindow: BrowserWindow | null = null;
const storage = new StorageService(app.getPath('userData'), new Set(originalFoods.map(f => f.id)));
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    title: 'Dietas App', width: 1360, height: 920, minWidth: 760, minHeight: 600, show: false, backgroundColor: '#f5f6f2',
    icon: app.isPackaged ? path.join(process.resourcesPath, 'icon.png') : path.join(app.getAppPath(), 'assets/icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true },
  });
  mainWindow = window;
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.on('will-prevent-unload', event => {
    const answer = dialog.showMessageBoxSync(window, { type: 'warning', title: 'Alterações não salvas', message: 'Há alterações que ainda não foram salvas.', detail: 'Aguarde o indicador de salvamento ou saia descartando as últimas alterações.', buttons: ['Continuar no aplicativo', 'Sair sem salvar'], defaultId: 0, cancelId: 0 });
    if (answer === 1) event.preventDefault();
  });
  window.on('closed', () => { mainWindow = null; });
  window.once('ready-to-show', () => window.show());
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) await window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  else await window.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
}
if (gotLock && !started) app.whenReady().then(async () => {
  app.setAppUserModelId('com.dietasapp.desktop');
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    const devOrigin = MAIN_WINDOW_VITE_DEV_SERVER_URL ? new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL).origin : '';
    callback({ cancel: !(url.protocol === 'file:' || url.protocol === 'data:' || (devOrigin && url.origin === devOrigin)) });
  });
  registerIpc(() => mainWindow, storage);
  await createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); });
}).catch(error => { dialog.showErrorBox('Não foi possível abrir o Dietas App', String(error)); app.quit(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
