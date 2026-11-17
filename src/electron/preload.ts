import { contextBridge, ipcRenderer } from 'electron';
import type { Bundle, DesktopAPI, DietFile } from '../types/models';
const api: DesktopAPI = {
  load: () => ipcRenderer.invoke('dietas:load'),
  save: (bundle: Bundle) => ipcRenderer.invoke('dietas:save', bundle),
  exportDiet: (file: DietFile) => ipcRenderer.invoke('dietas:export', file),
  importDiet: () => ipcRenderer.invoke('dietas:import'),
  pdf: (file: DietFile) => ipcRenderer.invoke('dietas:pdf', file),
  print: (file: DietFile) => ipcRenderer.invoke('dietas:print', file),
};
contextBridge.exposeInMainWorld('dietas', Object.freeze(api));
