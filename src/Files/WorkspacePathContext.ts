import * as path from "path";
import * as vscode from "vscode";

import { Settings } from "../VsCode/Settings";
import { OutputWindow } from "../VsCode/OutputWindow";
import { OutputLevel } from "../Enums/OutputLevel";
import { SassPathResolver } from "./SassPathResolver";

export class WorkspacePathContext {
    /**
     * Resolves the effective base path for a workspace folder, accounting for forceBaseDirectory setting.
     * @param workspaceFolder The workspace folder to resolve
     * @returns The resolved base path and effective workspace folder, or null if validation fails
     */
    static async resolveEffectiveBasePath(
        workspaceFolder: vscode.WorkspaceFolder,
    ): Promise<{
        basePath: string;
        effectiveFolder: vscode.WorkspaceFolder;
    } | null> {
        const forceBaseDirectory = Settings.getConfigSettings<string | null>(
            "forceBaseDirectory",
            workspaceFolder,
        );

        let basePath = workspaceFolder.uri.fsPath;
        let effectiveFolder = workspaceFolder;

        if (forceBaseDirectory && forceBaseDirectory.length > 1) {
            OutputWindow.Show(
                OutputLevel.Trace,
                "`forceBaseDirectory` setting found, checking validity",
            );

            basePath = path.resolve(
                workspaceFolder.uri.fsPath,
                SassPathResolver.stripLeadingSlash(forceBaseDirectory),
            );

            try {
                if (
                    (await vscode.workspace.fs.stat(vscode.Uri.file(basePath)))
                        .type !== vscode.FileType.Directory
                ) {
                    OutputWindow.Show(
                        OutputLevel.Critical,
                        "Error with your `forceBaseDirectory` setting",
                        [
                            `Path is not a folder: ${basePath}`,
                            `Setting: "${forceBaseDirectory}"`,
                            `Workspace folder: ${workspaceFolder.name}`,
                        ],
                    );
                    return null;
                }
            } catch {
                OutputWindow.Show(
                    OutputLevel.Critical,
                    "Error with your `forceBaseDirectory` setting",
                    [
                        `Can not find path: ${basePath}`,
                        `Setting: "${forceBaseDirectory}"`,
                        `Workspace folder: ${workspaceFolder.name}`,
                    ],
                );
                return null;
            }

            OutputWindow.Show(
                OutputLevel.Trace,
                "Using forceBaseDirectory as effective workspace",
                [`New folder: ${basePath}`],
            );

            effectiveFolder = {
                uri: vscode.Uri.file(basePath),
                name: workspaceFolder.name,
                index: workspaceFolder.index,
            };
        } else {
            OutputWindow.Show(
                OutputLevel.Trace,
                "No base folder override found. Keeping workspace folder",
            );
        }

        return { basePath, effectiveFolder };
    }

    static getWorkspaceFolder(
        filePath: string,
        suppressOutput = false,
    ): vscode.WorkspaceFolder | undefined {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(
            vscode.Uri.file(filePath),
        );

        if (!suppressOutput) {
            const filename = filePath.toLowerCase();

            if (workspaceFolder) {
                OutputWindow.Show(
                    OutputLevel.Trace,
                    "Found the workspace folder",
                    [`Workspace Name: ${workspaceFolder.name}`],
                );
            } else if (
                filename.endsWith(".sass") ||
                filename.endsWith(".scss")
            ) {
                OutputWindow.Show(
                    OutputLevel.Warning,
                    "Warning: File is not in a workspace",
                    [`Path: ${filePath}`],
                );
            }
        }

        return workspaceFolder;
    }
}
