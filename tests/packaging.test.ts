import { expect, it } from 'vitest';
import { verifyMainBundle } from '../scripts/verify-package.mts';
import { build } from 'vite';

it('detecta o erro do pacote 1.0.0 mesmo com a dependência instalada no projeto', () => {
  expect(() => verifyMainBundle('require("electron-squirrel-startup");', 'main.cjs'))
    .toThrow('Dependência de runtime fora do bundle: electron-squirrel-startup');
});

it('rejeita dependências transitivas deixadas fora do bundle', () => {
  expect(() => verifyMainBundle('require("debug");', 'main.cjs'))
    .toThrow('Dependência de runtime fora do bundle: debug');
});

it('detecta entradas que deixam de inicializar o aplicativo', () => {
  expect(() => verifyMainBundle('', 'main.cjs')).toThrow('A abertura normal deve aguardar o Electron');
});

it('o build de produção inicializa sem node_modules e processa os quatro eventos Squirrel', async () => {
  const result = await build({ configFile: 'vite.main.config.mts', logLevel: 'silent', build: { write: false, watch: null } });
  const results = Array.isArray(result) ? result : [result];
  const main = results.flatMap(output => 'output' in output ? output.output : [])
    .find(chunk => chunk.type === 'chunk' && chunk.fileName === 'main.cjs');
  if (!main || main.type !== 'chunk') throw new Error('Bundle main.cjs não gerado');
  expect(verifyMainBundle(main.code, 'main.cjs')).toEqual([
    'normal-startup', '--squirrel-install', '--squirrel-updated', '--squirrel-uninstall', '--squirrel-obsolete',
  ]);
});
