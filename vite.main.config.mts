import { defineConfig } from 'vite';
export default defineConfig((env) => ({
  build: { outDir: '.vite/build', emptyOutDir: false, lib: { entry: 'src/electron/main.ts', formats: ['cjs'], fileName: () => 'main.cjs' }, rollupOptions: { external: ['electron', 'electron-squirrel-startup', /^node:/] } },
  ...(!('forgeConfig' in env) ? { define: { MAIN_WINDOW_VITE_DEV_SERVER_URL: 'undefined', MAIN_WINDOW_VITE_NAME: JSON.stringify('main_window') } } : {}),
}));
