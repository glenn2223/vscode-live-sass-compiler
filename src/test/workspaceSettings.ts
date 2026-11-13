import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

/**
 * Changes settings of the first workspace folder for a test, remembering
 * what was changed so that `reset` can put everything back.
 */
export class WorkspaceSettings {
    private readonly _changed = new Set<string>();

    get folder(): vscode.WorkspaceFolder {
        return vscode.workspace.workspaceFolders![0];
    }

    /**
     * @param key The setting, without its section
     * @param section Defaults to the settings of this extension
     */
    async set(
        key: string,
        value: unknown,
        section = "liveSassCompile.settings",
    ): Promise<void> {
        this._changed.add(`${section}|${key}`);

        await vscode.workspace
            .getConfiguration(section, this.folder)
            .update(key, value, vscode.ConfigurationTarget.WorkspaceFolder);
    }

    async setAll(settings: Record<string, unknown>): Promise<void> {
        for (const key in settings) {
            await this.set(key, settings[key]);
        }
    }

    async reset(): Promise<void> {
        for (const setting of this._changed) {
            const [section, key] = setting.split("|");

            await vscode.workspace
                .getConfiguration(section, this.folder)
                .update(
                    key,
                    undefined,
                    vscode.ConfigurationTarget.WorkspaceFolder,
                );
        }

        this._changed.clear();
    }
}

/** Creates files (and their folders) beneath `root` */
export function writeFiles(root: string, files: Record<string, string>): void {
    for (const file in files) {
        const fullPath = path.join(root, file);

        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, files[file]);
    }
}

/** Every file beneath `root`, relative to it, using `/` and sorted */
export function listFiles(root: string): string[] {
    const found: string[] = [];

    const walk = (folder: string) => {
        for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
            const fullPath = path.join(folder, entry.name);

            if (entry.isDirectory()) {
                walk(fullPath);
            } else {
                found.push(path.relative(root, fullPath).replace(/\\/g, "/"));
            }
        }
    };

    walk(root);

    return found.sort();
}
