import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExpressionSequence } from "../expressions/keyframes.js";
import { exportSequenceJson, importSequenceJson } from "../stream/sequence-io.js";

export interface SequenceStoreConfig {
  directory: string;
}

export interface SequenceLibraryEntry {
  id: string;
  name: string;
  updatedAt: string;
}

const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

export function readSequenceStoreConfig(
  env: NodeJS.ProcessEnv = process.env,
): SequenceStoreConfig {
  const directory = env.SEQUENCE_STORE_DIR?.trim() || ".robot-face/sequences";
  return { directory };
}

export function validateSequenceStoreId(id: string): void {
  if (!ID_PATTERN.test(id)) {
    throw new Error(
      "Sequence id must be 1–64 chars: letters, numbers, underscore, hyphen",
    );
  }
}

export class SequenceFilesystemStore {
  constructor(private readonly config: SequenceStoreConfig) {}

  private filePath(id: string): string {
    validateSequenceStoreId(id);
    return join(this.config.directory, `${id}.json`);
  }

  async ensureReady(): Promise<void> {
    await mkdir(this.config.directory, { recursive: true });
  }

  async list(): Promise<SequenceLibraryEntry[]> {
    await this.ensureReady();
    let names: string[];
    try {
      names = await readdir(this.config.directory);
    } catch {
      return [];
    }
    const entries: SequenceLibraryEntry[] = [];
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      const id = name.slice(0, -".json".length);
      try {
        validateSequenceStoreId(id);
        const st = await stat(join(this.config.directory, name));
        const seq = await this.get(id);
        entries.push({
          id,
          name: seq.name,
          updatedAt: st.mtime.toISOString(),
        });
      } catch {
        // skip invalid files
      }
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    return entries;
  }

  async get(id: string): Promise<ExpressionSequence> {
    const raw = await readFile(this.filePath(id), "utf8");
    return importSequenceJson(raw);
  }

  async save(id: string, sequence: ExpressionSequence): Promise<SequenceLibraryEntry> {
    validateSequenceStoreId(id);
    const normalized: ExpressionSequence = { ...sequence, id };
    await this.ensureReady();
    await writeFile(this.filePath(id), exportSequenceJson(normalized), "utf8");
    const st = await stat(this.filePath(id));
    return {
      id,
      name: normalized.name,
      updatedAt: st.mtime.toISOString(),
    };
  }

  async delete(id: string): Promise<void> {
    await rm(this.filePath(id), { force: true });
  }
}
