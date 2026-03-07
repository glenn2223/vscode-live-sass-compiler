import * as vscode from "vscode";

import { Settings } from "../VsCode/Settings";
import { OutputWindow } from "../VsCode/OutputWindow";
import { OutputLevel } from "../Enums/OutputLevel";
import { SassPathResolver } from "./SassPathResolver";
import { WorkspacePathContext } from "./WorkspacePathContext";

export class SassFileCollector {
    static async getSassFiles(
        queryPattern?: string[],
        isDebugging = false,
        workspaceFolder?: vscode.WorkspaceFolder,
    ): Promise<string[]> {
        OutputWindow.Show(OutputLevel.Trace, "Getting SASS files", [
            `Query pattern: ${queryPattern}`,
            `Can be overwritten: ${queryPattern == undefined}`,
            `Workspace folder filter: ${workspaceFolder?.name ?? "all"}`,
        ]);

        const fileList: string[] = [];

        // Use specific folder if provided, otherwise all workspace folders
        const folders = workspaceFolder
            ? [workspaceFolder]
            : vscode.workspace.workspaceFolders;

        if (folders && folders.length > 0) {
            const results = await Promise.all(
                folders.map(async (folder, index) => {
                    OutputWindow.Show(
                        OutputLevel.Trace,
                        `Checking folder ${index + 1} of ${folders.length}`,
                        [`Folder: ${folder.name}`],
                    );

                    // Get settings once at the start
                    const includeItems = Settings.getConfigSettings<
                        string[] | null
                    >("includeItems", folder);

                    let excludedItems = isDebugging
                        ? ["**/node_modules/**", ".vscode/**"]
                        : Settings.getConfigSettings<string[]>(
                              "excludeList",
                              folder,
                          );

                    // Determine query pattern
                    let effectivePattern = queryPattern;
                    if (effectivePattern) {
                        effectivePattern =
                            SassPathResolver.stripAnyLeadingSlashes(
                                Array.isArray(effectivePattern)
                                    ? effectivePattern
                                    : [effectivePattern],
                            );
                    } else if (includeItems && includeItems.length) {
                        effectivePattern =
                            SassPathResolver.stripAnyLeadingSlashes(
                                includeItems,
                            );
                        OutputWindow.Show(
                            OutputLevel.Trace,
                            "Query pattern overwritten",
                            [`New pattern(s): "${includeItems.join('" , "')}"`],
                        );
                    }

                    excludedItems =
                        SassPathResolver.stripAnyLeadingSlashes(excludedItems);

                    // Resolve effective workspace (handles forceBaseDirectory)
                    const resolved =
                        await WorkspacePathContext.resolveEffectiveBasePath(
                            folder,
                        );
                    if (!resolved) {
                        return null; // Error already logged by helper
                    }

                    const { basePath } = resolved;

                    // Add partials to excludedItems (unless debugging)
                    if (!isDebugging) {
                        excludedItems.push(
                            ...SassPathResolver.stripAnyLeadingSlashes(
                                Settings.getConfigSettings<string[]>(
                                    "partialsList",
                                    folder,
                                ),
                            ),
                        );
                    }

                    try {
                        const includePattern = new vscode.RelativePattern(
                            basePath,
                            (effectivePattern || ["**/*.s[ac]ss"]).join(","),
                        );

                        const excludePattern =
                            excludedItems.length > 0
                                ? `{${excludedItems.join(",")}}`
                                : null;

                        const foundFiles = await vscode.workspace.findFiles(
                            includePattern,
                            excludePattern
                                ? new vscode.RelativePattern(
                                      basePath,
                                      excludePattern,
                                  )
                                : null,
                        );

                        return foundFiles.map((file) => file.fsPath);
                    } catch (error) {
                        OutputWindow.Show(
                            OutputLevel.Warning,
                            "Error finding SASS files in workspace folder",
                            [`Folder: ${folder.name}`, `Error: ${error}`],
                        );
                        return [];
                    }
                }),
            );

            results.forEach((files) => {
                files?.forEach((file) => {
                    fileList.push(file);
                });
            });
        } else {
            OutputWindow.Show(
                OutputLevel.Trace,
                "No workspace, must be a single file solution",
            );

            if (vscode.window.activeTextEditor) {
                fileList.push(vscode.window.activeTextEditor.document.fileName);
            } else {
                fileList.push("No files found - not even an active file");
            }
        }

        OutputWindow.Show(
            OutputLevel.Trace,
            `Found ${fileList.length} SASS files`,
        );

        return fileList;
    }
}
