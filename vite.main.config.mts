import { builtinModules } from 'node:module';
import { defineConfig } from 'vite';

// Forge's Vite plugin ships the bundles, without node_modules. Bundle pure JS
// dependencies (including electron-squirrel-startup and debug) into main.cjs.
const runtimeModules = [...new Set(['electron', ...builtinModules.flatMap(name => [name, `node:${name}`])])];

export default defineConfig((env) => ({
  resolve: { conditions: ['node'], mainFields: ['module', 'main'] },
  build: { outDir: '.vite/build', emptyOutDir: false, lib: { entry: 'src/electron/main.ts', formats: ['cjs'], fileName: () => 'main.cjs' }, rollupOptions: { external: runtimeModules } },
  ...(!('forgeConfig' in env) ? { define: { MAIN_WINDOW_VITE_DEV_SERVER_URL: 'undefined', MAIN_WINDOW_VITE_NAME: JSON.stringify('main_window') } } : {}),
}));
