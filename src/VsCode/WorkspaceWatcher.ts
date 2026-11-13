import * as vscode from "vscode";

import { OutputWindow } from "./OutputWindow";
import { OutputLevel } from "../Enums/OutputLevel";

export class WorkspaceWatcher {
    /**
     * Matches Sass/SCSS files whatever the casing of the extension
     * (VS Code globs are case-sensitive)
     */
    static readonly watchGlob = "**/*.[sS][aAcC][sS][sS]";

    /**
     * How long (in ms) a file watcher event is ignored for after the same
     * file was saved in the editor - the save has already been handled
     */
    static readonly saveGracePeriod = 2000;

    private _fileWatcher: vscode.FileSystemWatcher | undefined;
    private _saveListener: vscode.Disposable | undefined;
    private readonly _recentSaves = new Map<string, number>();

    /**
     * Sets up a single file watcher for all SASS/SCSS files across all workspaces.
     * VS Code docs recommend minimizing the number of file watchers for performance.
     *
     * Saves made in the editor are listened to as well, because the file
     * watcher doesn't report every change:
     *  - It only covers files that are inside a workspace folder
     *  - On Linux, VS Code never reports changes inside a folder that was
     *    created in the same instant as its parent (`mkdir -p`, a git checkout)
     */
    setup(
        onFileChange: (uri: vscode.Uri, isDelete: boolean) => Promise<void>,
    ): void {
        OutputWindow.Show(OutputLevel.Trace, "Setting up file watcher");

        // Clean up any existing watcher first
        this.dispose();

        // Create a single global watcher for all SASS/SCSS files
        this._fileWatcher = vscode.workspace.createFileSystemWatcher(
            WorkspaceWatcher.watchGlob,
        );

        this._fileWatcher.onDidChange(async (uri) => {
            if (this.wasJustSaved(uri, "onDidChange")) {
                return;
            }

            OutputWindow.Show(
                OutputLevel.Trace,
                'File watcher: "onDidChange"',
                [`File: ${uri.fsPath}`],
            );
            await onFileChange(uri, false);
        });

        this._fileWatcher.onDidCreate(async (uri) => {
            if (this.wasJustSaved(uri, "onDidCreate")) {
                return;
            }

            OutputWindow.Show(
                OutputLevel.Trace,
                'File watcher: "onDidCreate"',
                [`File: ${uri.fsPath}`],
            );
            await onFileChange(uri, false);
        });

        this._fileWatcher.onDidDelete(async (uri) => {
            OutputWindow.Show(
                OutputLevel.Trace,
                'File watcher: "onDidDelete"',
                [`File: ${uri.fsPath}`],
            );
            // Deletion of partials should trigger recompilation of all files
            await onFileChange(uri, true);
        });

        this._saveListener = vscode.workspace.onDidSaveTextDocument(
            async (document) => {
                const filePath = document.uri.fsPath.toLowerCase();

                if (
                    !filePath.endsWith(".scss") &&
                    !filePath.endsWith(".sass")
                ) {
                    return;
                }

                OutputWindow.Show(
                    OutputLevel.Trace,
                    'VS Code event: "onDidSaveTextDocument"',
                    [`File: ${document.uri.fsPath}`],
                );

                this._recentSaves.set(document.uri.fsPath, Date.now());

                await onFileChange(document.uri, false);
            },
        );

        OutputWindow.Show(OutputLevel.Trace, "File watcher set up");
    }

    /**
     * A save in the editor is normally followed by a file watcher event for
     * the same change. This identifies those so they aren't handled twice.
     */
    private wasJustSaved(uri: vscode.Uri, eventName: string): boolean {
        const savedAt = this._recentSaves.get(uri.fsPath);

        if (savedAt === undefined) {
            return false;
        }

        if (Date.now() - savedAt > WorkspaceWatcher.saveGracePeriod) {
            this._recentSaves.delete(uri.fsPath);

            return false;
        }

        OutputWindow.Show(
            OutputLevel.Trace,
            `File watcher: "${eventName}" ignored, the save was already handled`,
            [`File: ${uri.fsPath}`],
        );

        return true;
    }

    dispose(): void {
        if (this._fileWatcher) {
            OutputWindow.Show(OutputLevel.Trace, "Disposing file watcher");
            this._fileWatcher.dispose();
            this._fileWatcher = undefined;
        }

        if (this._saveListener) {
            this._saveListener.dispose();
            this._saveListener = undefined;
        }

        this._recentSaves.clear();
    }
}
