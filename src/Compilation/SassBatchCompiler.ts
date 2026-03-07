import * as vscode from "vscode";

import { SassCompilationService } from "./SassCompilationService";
import { SassFileCollector } from "../Files/SassFileCollector";
import { WorkspacePathContext } from "../Files/WorkspacePathContext";
import { OutputWindow } from "../VsCode/OutputWindow";
import { OutputLevel } from "../Enums/OutputLevel";
import { CompilationUi } from "../VsCode/CompilationUi";

export class SassBatchCompiler {
    /**
     * Compiles all qualifying SASS files and updates UI accordingly.
     */
    static async compileAll(
        isWatching: boolean,
        workspaceFolder?: vscode.WorkspaceFolder,
    ): Promise<void> {
        const sassPaths = await SassFileCollector.getSassFiles(
            undefined,
            false,
            workspaceFolder,
        );

        OutputWindow.Show(
            OutputLevel.Debug,
            "Compiling Sass/Scss Files: ",
            sassPaths,
        );

        const results = await Promise.all(
            sassPaths.map((sassPath, pathIndex) => {
                OutputWindow.Show(
                    OutputLevel.Trace,
                    `Starting file ${pathIndex + 1} of ${sassPaths.length}`,
                    [`Path: ${sassPath}`],
                );

                return SassCompilationService.processSingleFile(
                    WorkspacePathContext.getWorkspaceFolder(sassPath),
                    sassPath,
                );
            }),
        );

        CompilationUi.handleBatchResults(results, isWatching);
    }

    /**
     * Compiles a single SASS file across all formats and updates UI.
     */
    static async handleSingleFile(
        workspaceFolder: vscode.WorkspaceFolder | undefined,
        sassPath: string,
        isWatching: boolean,
    ): Promise<void> {
        const results = await SassCompilationService.processSingleFile(
            workspaceFolder,
            sassPath,
        );

        CompilationUi.handleSingleResults(results, isWatching);
    }
}
