import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseVersion, FuseV1Options } from "@electron/fuses";
import path from "node:path";
import { verifyPackagedApp } from "./scripts/verify-package.mts";

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    executableName: "DietasApp",
    icon: "assets/icon",
    extraResource: ["assets/icon.png"],
  },
  rebuildConfig: {},
  hooks: {
    postPackage: async (_config, { outputPaths }) => {
      for (const directory of outputPaths) {
        const archive = path.join(directory, "resources", "app.asar");
        const result = verifyPackagedApp(archive);
        console.log(
          `Pacote ${result.version} verificado: abertura isolada e quatro eventos Squirrel, sem node_modules do projeto.`,
        );
      }
    },
  },
  makers: [
    new MakerSquirrel({
      name: "DietasApp",
      setupExe: "DietasApp Setup.exe",
      setupIcon: "assets/icon.ico",
      noMsi: true,
    }),
    new MakerZIP({}, ["linux", "win32"]),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/electron/main.ts",
          config: "vite.main.config.mts",
          target: "main",
        },
        {
          entry: "src/electron/preload.ts",
          config: "vite.preload.config.mts",
          target: "preload",
        },
      ],
      renderer: [{ name: "main_window", config: "vite.renderer.config.mts" }],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
export default config;
