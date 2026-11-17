import { expect, it, vi } from "vitest";
import {
  verifyMainBundle,
  verifyPackagedApp,
} from "../scripts/verify-package.mts";
import { build } from "vite";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createPackage, extractFile, uncache } from "@electron/asar";

async function buildMainBundle(): Promise<string> {
  const result = await build({
    configFile: "vite.main.config.mts",
    logLevel: "silent",
    build: { write: false, watch: null },
  });
  const results = Array.isArray(result) ? result : [result];
  const main = results
    .flatMap((output) => ("output" in output ? output.output : []))
    .find((chunk) => chunk.type === "chunk" && chunk.fileName === "main.cjs");
  if (!main || main.type !== "chunk")
    throw new Error("Bundle main.cjs não gerado");
  return main.code;
}

it("detecta o erro do pacote 1.0.0 mesmo com a dependência instalada no projeto", () => {
  expect(() =>
    verifyMainBundle('require("electron-squirrel-startup");', "main.cjs"),
  ).toThrow("Dependência de runtime fora do bundle: electron-squirrel-startup");
});

it("rejeita dependências transitivas deixadas fora do bundle", () => {
  expect(() => verifyMainBundle('require("debug");', "main.cjs")).toThrow(
    "Dependência de runtime fora do bundle: debug",
  );
});

it("detecta entradas que deixam de inicializar o aplicativo", () => {
  expect(() => verifyMainBundle("", "main.cjs")).toThrow(
    "A abertura normal deve aguardar o Electron",
  );
});

it("o build de produção inicializa sem node_modules e processa os quatro eventos Squirrel", async () => {
  expect(verifyMainBundle(await buildMainBundle(), "main.cjs")).toEqual([
    "normal-startup",
    "--squirrel-install",
    "--squirrel-updated",
    "--squirrel-uninstall",
    "--squirrel-obsolete",
  ]);
});

it("lê o main de um ASAR real com as regras de caminhos do Windows", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "dietas-asar-paths-"));
  const source = path.join(directory, "app");
  const archive = path.join(directory, "app.asar");
  const separator = Object.getOwnPropertyDescriptor(path, "sep")!;
  // Capture before mocking: on a Windows runner `path` is already path.win32.
  const windows = {
    normalize: path.win32.normalize,
    dirname: path.win32.dirname,
    basename: path.win32.basename,
  };
  try {
    await mkdir(path.join(source, ".vite", "build"), { recursive: true });
    await writeFile(
      path.join(source, "package.json"),
      JSON.stringify({
        version: "1.0.1",
        main: ".vite/build/main.cjs",
        dependencies: { "electron-squirrel-startup": "^1.0.1" },
      }),
    );
    await writeFile(
      path.join(source, ".vite", "build", "main.cjs"),
      await buildMainBundle(),
    );
    await createPackage(source, archive);
    // Cache the host filesystem path before exercising Windows archive lookup.
    extractFile(archive, "package.json");
    vi.spyOn(path, "normalize").mockImplementation(windows.normalize);
    vi.spyOn(path, "dirname").mockImplementation(windows.dirname);
    vi.spyOn(path, "basename").mockImplementation(windows.basename);
    Object.defineProperty(path, "sep", { ...separator, value: "\\" });

    // This is the original failure: the file exists, but slash-only lookup fails.
    expect(() => extractFile(archive, ".vite/build/main.cjs")).toThrow(
      "was not found in this archive",
    );
    expect(verifyPackagedApp(archive)).toEqual({
      version: "1.0.1",
      scenarios: [
        "normal-startup",
        "--squirrel-install",
        "--squirrel-updated",
        "--squirrel-uninstall",
        "--squirrel-obsolete",
      ],
    });
  } finally {
    vi.restoreAllMocks();
    Object.defineProperty(path, "sep", separator);
    uncache(archive);
    await rm(directory, { recursive: true, force: true });
  }
});
