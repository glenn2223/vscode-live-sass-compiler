import * as vscode from "vscode";

import { OutputWindow } from "./OutputWindow";
import { OutputLevel } from "../Enums/OutputLevel";

export class WorkspaceWatcher {
    private _fileWatcher: vscode.FileSystemWatcher | undefined;

    /**
     * Sets up a single file watcher for all SASS/SCSS files across all workspaces.
     * VS Code docs recommend minimizing the number of file watchers for performance.
     */
    setup(
        onFileChange: (uri: vscode.Uri, isDelete: boolean) => Promise<void>,
    ): void {
        OutputWindow.Show(OutputLevel.Trace, "Setting up file watcher");

        // Clean up any existing watcher first
        this.dispose();

        // Create a single global watcher for all SASS/SCSS files
        this._fileWatcher =
            vscode.workspace.createFileSystemWatcher("**/*.{sass,scss}");

        this._fileWatcher.onDidChange(async (uri) => {
            OutputWindow.Show(
                OutputLevel.Trace,
                'File watcher: "onDidChange"',
                [`File: ${uri.fsPath}`],
            );
            await onFileChange(uri, false);
        });

        this._fileWatcher.onDidCreate(async (uri) => {
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

        OutputWindow.Show(OutputLevel.Trace, "File watcher set up");
    }

    dispose(): void {
        if (this._fileWatcher) {
            OutputWindow.Show(OutputLevel.Trace, "Disposing file watcher");
            this._fileWatcher.dispose();
            this._fileWatcher = undefined;
        }
    }
}
