import { constants } from "node:fs";
import { access, copyFile, mkdir, open, rename } from "node:fs/promises";
import path from "node:path";
import type { Bootstrap, Bundle, Workspace } from "../types/models";
import { createDiet } from "../core/meals";
import {
  validateBundle,
  validateCustomFoods,
  validateWorkspace,
} from "../core/validation";

const MAX_BYTES = 20 * 1024 * 1024;
async function exists(file: string): Promise<boolean> {
  try {
    await access(file, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
export async function readJson(file: string): Promise<unknown> {
  const handle = await open(file, "r");
  try {
    if ((await handle.stat()).size > MAX_BYTES)
      throw new Error("Arquivo JSON excede o limite de 20 MB.");
    return JSON.parse(await handle.readFile("utf-8")) as unknown;
  } finally {
    await handle.close();
  }
}
export async function atomicWrite(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  const handle = await open(temporary, "w", 0o600);
  try {
    await handle.writeFile(JSON.stringify(value, null, 2) + "\n", "utf-8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  // The previous complete file remains recoverable if the final rename fails.
  if (await exists(file)) await copyFile(file, `${file}.bak`);
  await rename(temporary, file);
}
export class StorageService {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private directory: string,
    private originalIds: Set<string>,
  ) {}
  private async recover<T>(
    name: string,
    validate: (value: unknown) => T,
    fallback: () => T,
    warnings: string[],
  ): Promise<T> {
    const file = path.join(this.directory, name);
    if (!(await exists(file)) && !(await exists(`${file}.bak`)))
      return fallback();
    try {
      return validate(await readJson(file));
    } catch (error) {
      try {
        const restored = validate(await readJson(`${file}.bak`));
        // Preserve corrupt input for audit, then restore without overwriting the good backup.
        if (await exists(file))
          await copyFile(file, `${file}.corrupt-${Date.now()}`);
        await copyFile(`${file}.bak`, file);
        warnings.push(
          `${name}: recuperado do backup. A última alteração pode não estar incluída.`,
        );
        return restored;
      } catch (backupError) {
        throw new Error(
          `Não foi possível recuperar ${name}. Os arquivos foram preservados em ${this.directory}. ${error instanceof Error ? error.message : ""} ${backupError instanceof Error ? backupError.message : ""}`,
        );
      }
    }
  }
  async load(): Promise<Bootstrap> {
    await mkdir(this.directory, { recursive: true });
    const warnings: string[] = [];
    let customFoods = await this.recover(
      "alimentos-personalizados.json",
      validateCustomFoods,
      () => [],
      warnings,
    );
    let workspace = await this.recover(
      "dietas.json",
      validateWorkspace,
      (): Workspace => {
        const diet = createDiet();
        return {
          schemaVersion: 1,
          diets: [diet],
          activeDietId: diet.id,
          settings: { section: "profile" },
        };
      },
      warnings,
    );
    try {
      validateBundle({ workspace, customFoods }, this.originalIds);
    } catch (error) {
      // A power loss between the two file renames may leave individually valid
      // files from different generations. Try the previous coherent pair.
      const workspaces = [workspace],
        catalogs = [customFoods];
      try {
        workspaces.push(
          validateWorkspace(
            await readJson(path.join(this.directory, "dietas.json.bak")),
          ),
        );
      } catch {
        /* optional backup */
      }
      try {
        catalogs.push(
          validateCustomFoods(
            await readJson(
              path.join(this.directory, "alimentos-personalizados.json.bak"),
            ),
          ),
        );
      } catch {
        /* optional backup */
      }
      let recovered = false;
      for (const candidate of workspaces) {
        for (const catalog of catalogs) {
          try {
            validateBundle(
              { workspace: candidate, customFoods: catalog },
              this.originalIds,
            );
            workspace = candidate;
            customFoods = catalog;
            recovered = true;
            break;
          } catch {
            /* try another generation */
          }
        }
        if (recovered) break;
      }
      if (!recovered) throw error;
      for (const [name, value] of [
        ["dietas.json", workspace],
        ["alimentos-personalizados.json", customFoods],
      ] as const) {
        const file = path.join(this.directory, name);
        if (await exists(file))
          await copyFile(file, `${file}.interrupted-${Date.now()}`);
        await atomicWrite(file, value);
      }
      warnings.push(
        "Gravação interrompida: uma versão consistente das dietas e dos alimentos foi recuperada. Confira as últimas alterações.",
      );
    }
    return { workspace, customFoods, warnings, dataPath: this.directory };
  }
  save(value: unknown): Promise<void> {
    const bundle: Bundle = validateBundle(value, this.originalIds);
    const task = this.queue.then(async () => {
      // New food records must be on disk before a diet can reference them.
      await atomicWrite(
        path.join(this.directory, "alimentos-personalizados.json"),
        bundle.customFoods,
      );
      await atomicWrite(
        path.join(this.directory, "dietas.json"),
        bundle.workspace,
      );
    });
    this.queue = task.catch(() => undefined);
    return task;
  }
  async flush(): Promise<void> {
    await this.queue;
  }
}
