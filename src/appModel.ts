"use strict";

import * as path from "path";
import * as vscode from "vscode";

import { Settings } from "./VsCode/Settings";
import { StatusBarUi } from "./VsCode/StatusbarUi";
import { OutputLevel } from "./Enums/OutputLevel";
import { SassConfirmationType } from "./Enums/SassConfirmationType";
import { OutputWindow } from "./VsCode/OutputWindow";
import { ErrorLogger } from "./VsCode/ErrorLogger";
import { CompilationUi } from "./VsCode/CompilationUi";
import { WorkspaceWatcher } from "./VsCode/WorkspaceWatcher";
import { DebugReporter } from "./VsCode/DebugReporter";

import { SassFileClassifier } from "./Files/SassFileClassifier";
import { SassFileCollector } from "./Files/SassFileCollector";
import { WorkspacePathContext } from "./Files/WorkspacePathContext";

import { SassBatchCompiler } from "./Compilation/SassBatchCompiler";

export class AppModel {
    isWatching: boolean;
    private _logger: ErrorLogger;
    private _watcher: WorkspaceWatcher;

    constructor(workplaceState: vscode.Memento) {
        OutputWindow.Show(OutputLevel.Trace, "Constructing app model");

        this.isWatching = false;

        this._logger = new ErrorLogger(workplaceState);
        this._watcher = new WorkspaceWatcher();

        if (Settings.getConfigSettings<boolean>("watchOnLaunch")) {
            void this.StartWatching();
        } else {
            CompilationUi.revertUIToWatchingStatusNow(this.isWatching);
        }

        OutputWindow.Show(OutputLevel.Trace, "App model constructed");
    }

    async StartWatching(): Promise<void> {
        const compileOnWatch =
            Settings.getConfigSettings<boolean>("compileOnWatch");

        if (!this.isWatching) {
            this.isWatching = !this.isWatching;

            this._watcher.setup((uri, isDelete) =>
                this.handleFileChange(uri, isDelete),
            );

            if (compileOnWatch) {
                void this.compileAllFiles();

                return;
            }
        }

        CompilationUi.revertUIToWatchingStatusNow(this.isWatching);
    }

    StopWatching(): void {
        if (this.isWatching) {
            this.isWatching = !this.isWatching;

            this._watcher.dispose();
        }

        CompilationUi.revertUIToWatchingStatusNow(this.isWatching);
    }

    openOutputWindow(): void {
        OutputWindow.Show(OutputLevel.Critical, null, null, false);
    }

    async createIssue(): Promise<void> {
        await this._logger.InitiateIssueCreator();
    }

    async compileAllFiles(): Promise<void> {
        OutputWindow.Show(OutputLevel.Trace, "Starting to compile all files");

        try {
            StatusBarUi.working();

            await SassBatchCompiler.compileAll(this.isWatching);
        } catch (err) {
            let files: string[] | string;
            try {
                files = await SassFileCollector.getSassFiles();
            } catch (_) {
                files = "Error lies in getSassFiles()";
            }
            await this.logUnhandledError("compiling all files", err, { files });
        }

        CompilationUi.revertUIToWatchingStatusNow(this.isWatching);
    }

    async compileCurrentFile(): Promise<void> {
        OutputWindow.Show(
            OutputLevel.Trace,
            "Starting to compile current file",
        );

        try {
            if (!vscode.window.activeTextEditor) {
                StatusBarUi.customMessage(
                    "No file open",
                    "No file is open, ensure a file is open in the editor window",
                    "warning",
                );

                OutputWindow.Show(OutputLevel.Debug, "No active file", [
                    "There isn't an active editor window to process",
                ]);

                CompilationUi.revertUIToWatchingStatus(() => this.isWatching);

                return;
            }

            const sassPath = vscode.window.activeTextEditor.document.fileName,
                workspaceFolder =
                    WorkspacePathContext.getWorkspaceFolder(sassPath),
                sassFileType = SassFileClassifier.confirmSassType(
                    sassPath,
                    workspaceFolder,
                );

            switch (sassFileType) {
                case SassConfirmationType.PartialFile:
                    OutputWindow.Show(
                        OutputLevel.Debug,
                        "Can't process partial Sass",
                        [
                            "The file currently open in the editor window is a partial sass file, these aren't processed singly",
                        ],
                    );

                    StatusBarUi.customMessage(
                        "Can't process partial Sass",
                        "The file currently open in the editor window is a partial sass file, these aren't processed singly",
                        "warning",
                    );

                    CompilationUi.revertUIToWatchingStatus(
                        () => this.isWatching,
                    );

                    return;

                case SassConfirmationType.NotSass:
                    OutputWindow.Show(OutputLevel.Debug, "Not a Sass file", [
                        "The file currently open in the editor window isn't a sass file",
                    ]);

                    StatusBarUi.customMessage(
                        "Not a Sass file",
                        "The file currently open in the editor window isn't a sass file",
                        "warning",
                    );

                    CompilationUi.revertUIToWatchingStatus(
                        () => this.isWatching,
                    );

                    return;
            }

            StatusBarUi.working("Processing single file...");
            OutputWindow.Show(
                OutputLevel.Debug,
                "Processing the current file",
                [`Path: ${sassPath}`],
            );

            await SassBatchCompiler.handleSingleFile(
                workspaceFolder,
                sassPath,
                this.isWatching,
            );
        } catch (err) {
            const sassPath = vscode.window.activeTextEditor
                ? vscode.window.activeTextEditor.document.fileName
                : "/* NO ACTIVE FILE, PROCESSING SHOULD NOT HAVE OCCURRED */";
            await this.logUnhandledError("compiling the active file", err, {
                files: sassPath,
            });
        }
    }

    async debugInclusion(): Promise<void> {
        try {
            await DebugReporter.debugInclusion();
        } catch (err) {
            const sassPath = vscode.window.activeTextEditor
                ? vscode.window.activeTextEditor.document.fileName
                : "/* NO ACTIVE FILE, MESSAGE SHOULD HAVE BEEN THROWN */";
            await this.logUnhandledError("checking the active file", err, {
                file: sassPath,
            });
        }
    }

    async debugFileList(): Promise<void> {
        try {
            await DebugReporter.debugFileList();
        } catch (err) {
            const sassPath = vscode.window.activeTextEditor
                ? vscode.window.activeTextEditor.document.fileName
                : "/* NO ACTIVE FILE, DETAILS BELOW */";
            await this.logUnhandledError("generating file list", err, {
                file: sassPath,
            });
        }
    }

    private async handleFileChange(
        uri: vscode.Uri,
        isDelete: boolean,
    ): Promise<void> {
        if (!this.isWatching) {
            return;
        }

        const filePath = uri.fsPath;
        const workspaceFolder = WorkspacePathContext.getWorkspaceFolder(
            filePath,
            false,
        );

        const fileType = SassFileClassifier.confirmSassType(
            filePath,
            workspaceFolder,
        );

        OutputWindow.Show(OutputLevel.Trace, "File type determined", [
            `File: ${filePath}`,
            `Type: ${SassConfirmationType[fileType]}`,
        ]);

        switch (fileType) {
            case SassConfirmationType.NotSass:
                return;

            case SassConfirmationType.PartialFile:
                await this.handlePartialFileChange(uri, workspaceFolder);
                break;

            case SassConfirmationType.SassFile:
                if (!isDelete) {
                    await this.handleNonPartialFileChange(uri, workspaceFolder);
                }
                break;
        }
    }

    private async handlePartialFileChange(
        uri: vscode.Uri,
        workspaceFolder?: vscode.WorkspaceFolder,
    ): Promise<void> {
        try {
            StatusBarUi.working();
            OutputWindow.Show(
                OutputLevel.Information,
                "Partial file change detected - " + new Date().toLocaleString(),
                [path.basename(uri.fsPath)],
            );

            if (Settings.getWorkspacesAreLinked()) {
                OutputWindow.Show(
                    OutputLevel.Trace,
                    "Workspaces are linked - compiling all workspace folders",
                );
                await SassBatchCompiler.compileAll(this.isWatching);
            } else {
                OutputWindow.Show(
                    OutputLevel.Trace,
                    "Workspaces are not linked - compiling only the owning workspace folder",
                    [workspaceFolder?.name ?? "no folder"],
                );
                await SassBatchCompiler.compileAll(
                    this.isWatching,
                    workspaceFolder,
                );
            }
        } catch (err) {
            OutputWindow.Show(
                OutputLevel.Error,
                "Error handling partial file change",
                [`File: ${uri.fsPath}`, `Error: ${err}`],
            );
        }

        CompilationUi.revertUIToWatchingStatus(() => this.isWatching);
    }

    private async handleNonPartialFileChange(
        uri: vscode.Uri,
        workspaceFolder?: vscode.WorkspaceFolder,
    ): Promise<void> {
        try {
            const currentFile = uri.fsPath;

            if (
                await SassFileClassifier.isSassFileExcluded(
                    currentFile,
                    workspaceFolder,
                )
            ) {
                OutputWindow.Show(OutputLevel.Trace, "File excluded", [
                    "The file has not been compiled as it's excluded by user settings",
                    `Path: ${currentFile}`,
                ]);
                return;
            }

            StatusBarUi.working();
            OutputWindow.Show(
                OutputLevel.Information,
                "File change detected - " + new Date().toLocaleString(),
                [path.basename(currentFile)],
            );

            await SassBatchCompiler.handleSingleFile(
                workspaceFolder,
                currentFile,
                this.isWatching,
            );
        } catch (err) {
            OutputWindow.Show(OutputLevel.Error, "Error handling file change", [
                `File: ${uri.fsPath}`,
                `Error: ${err}`,
            ]);
        }

        CompilationUi.revertUIToWatchingStatus(() => this.isWatching);
    }

    private async logUnhandledError(
        context: string,
        err: unknown,
        additionalData: Record<string, unknown>,
    ): Promise<void> {
        if (err instanceof Error) {
            await this._logger.LogIssueWithAlert(
                `Unhandled error while ${context}. Error message: ${err.message}`,
                {
                    ...additionalData,
                    error: ErrorLogger.PrepErrorForLogging(err),
                },
            );
        } else {
            await this._logger.LogIssueWithAlert(
                `Unhandled error while ${context}. Error message: UNKNOWN (not Error type)`,
                {
                    ...additionalData,
                    error: JSON.stringify(err),
                },
            );
        }
    }

    dispose(): void {
        OutputWindow.Show(OutputLevel.Trace, "Disposing app model");

        this._watcher.dispose();

        StatusBarUi.dispose();
        OutputWindow.dispose();

        OutputWindow.Show(OutputLevel.Trace, "App model disposed");
    }
}
