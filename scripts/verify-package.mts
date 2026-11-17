import assert from 'node:assert/strict';
import { builtinModules, createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { extractFile } from '@electron/asar';

const requireBuiltin = createRequire(import.meta.url);
const builtins = new Set(builtinModules.flatMap(name => [name, `node:${name}`]));

/** Execute the shipped main entry without allowing access to project node_modules.
 * Electron and OS effects are stubbed; Windows Squirrel startup code is real.
 */
export function verifyMainBundle(code: string, filename: string): string[] {
  const scenarios = [undefined, '--squirrel-install', '--squirrel-updated', '--squirrel-uninstall', '--squirrel-obsolete'];
  const checked: string[] = [];
  for (const command of scenarios) {
    let readyCalls = 0;
    let quitCalls = 0;
    const spawned: { file: string; args: string[] }[] = [];
    const electron = {
      app: {
        isPackaged: true,
        setName() {},
        getPath: () => 'C:\\isolated-test\\DietasApp',
        requestSingleInstanceLock: () => true,
        on() {},
        quit() { quitCalls++; },
        whenReady() {
          readyCalls++;
          // Loading native windows and accessing user files is tested separately.
          return { then: () => ({ catch() {} }) };
        },
      },
    };
    const requireIsolated = (id: string): unknown => {
      if (id === 'electron') return electron;
      if (!builtins.has(id)) throw new Error(`Dependência de runtime fora do bundle: ${id}`);
      if (id === 'path' || id === 'node:path') return path.win32;
      if (id === 'child_process' || id === 'node:child_process') {
        return { spawn(file: string, args: string[]) {
          spawned.push({ file, args });
          return { on() { return this; } };
        } };
      }
      return requireBuiltin(id);
    };
    const module = { exports: {} };
    try {
      vm.runInNewContext(code, {
        require: requireIsolated, module, exports: module.exports,
        __filename: filename, __dirname: path.dirname(filename), Buffer, URL,
        process: { platform: 'win32', argv: ['DietasApp.exe', command].filter(Boolean), execPath: 'C:\\isolated-test\\app-version\\DietasApp.exe', env: {}, stdout: { write() {} }, stderr: { write() {} } },
        console, setTimeout, clearTimeout,
      }, { filename, timeout: 5000 });
      if (!command) {
        assert.equal(readyCalls, 1, 'A abertura normal deve aguardar o Electron');
        assert.equal(spawned.length, 0, 'A abertura normal não deve executar Update.exe');
      } else {
        assert.equal(readyCalls, 0, 'Eventos Squirrel não devem abrir a interface');
        assert.ok(quitCalls > 0, 'Eventos Squirrel devem encerrar o aplicativo');
        if (command === '--squirrel-obsolete') assert.equal(spawned.length, 0);
        else {
          assert.equal(spawned.length, 1);
          assert.equal(spawned[0]!.file, 'C:\\isolated-test\\Update.exe');
          const operation = command === '--squirrel-uninstall' ? '--removeShortcut' : '--createShortcut';
          assert.equal(spawned[0]!.args[0], `${operation}=DietasApp.exe`);
        }
      }
    } catch (cause) {
      throw new Error(`Falha no main empacotado (${command ?? 'abertura normal'}): ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
    }
    checked.push(command ?? 'normal-startup');
  }
  return checked;
}

export function verifyPackagedApp(archive: string): { version: string; scenarios: string[] } {
  const manifest = JSON.parse(extractFile(archive, 'package.json').toString()) as { version: string; main: string; dependencies?: Record<string, string> };
  assert.ok(manifest.dependencies?.['electron-squirrel-startup'], 'electron-squirrel-startup deve permanecer em dependencies');
  assert.equal(manifest.main, '.vite/build/main.cjs');
  // @electron/asar walks archive entries using path.sep on the build host.
  // package.json uses portable forward slashes, which must be normalized on Windows.
  const mainPath = path.normalize(manifest.main);
  const main = extractFile(archive, mainPath).toString();
  const scenarios = verifyMainBundle(main, path.join(archive, mainPath));
  return { version: manifest.version, scenarios };
}
