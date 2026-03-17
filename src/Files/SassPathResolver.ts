import * as path from "path";
import * as vscode from "vscode";

import { IFormat } from "../Interfaces/IFormat";
import { FileWriter } from "./FileWriter";
import { OutputWindow } from "../VsCode/OutputWindow";
import { OutputLevel } from "../Enums/OutputLevel";

export class SassPathResolver {
    /**
     * Generate a full save path for the final css & map files
     * @param filePath The path to the current SASS file
     */
    static generateCssAndMapUri(
        filePath: string,
        format: IFormat,
        workspaceRoot?: vscode.WorkspaceFolder,
    ): { css: string; map: string } | null {
        OutputWindow.Show(OutputLevel.Trace, "Calculating file paths", [
            "Calculating the save paths for the css and map output files",
            `Originating path: ${filePath}`,
        ]);

        const extensionName = format.extensionName || ".css";

        if (workspaceRoot) {
            OutputWindow.Show(OutputLevel.Trace, "Workspace root provided", [
                `Using originating path: ${filePath}`,
            ]);

            const workspacePath = workspaceRoot.uri.fsPath;
            let generatedUri: string;

            // NOTE: If all SavePath settings are `NULL`, CSS Uri will be same location as SASS
            if (format.savePath) {
                OutputWindow.Show(
                    OutputLevel.Trace,
                    "Using `savePath` setting",
                    [
                        "This format has a `savePath`, using this (takes precedence if others are present)",
                        `savePath: ${format.savePath}`,
                    ],
                );

                if (format.savePath.startsWith("~")) {
                    OutputWindow.Show(
                        OutputLevel.Trace,
                        "Path is relative to current file",
                        [
                            "Path starts with a tilde, so the path is relative to the current path",
                            `Original path: ${filePath}`,
                        ],
                        false,
                    );

                    generatedUri = path.join(
                        path.dirname(filePath),
                        format.savePath.substring(1),
                    );
                } else {
                    OutputWindow.Show(
                        OutputLevel.Trace,
                        "Path is relative to workspace folder",
                        [
                            "No tilde so the path is relative to the workspace folder being used",
                            `Original path: ${filePath}`,
                        ],
                        false,
                    );

                    generatedUri = path.join(workspacePath, format.savePath);
                }

                if (
                    format.savePathReplacementPairs &&
                    format.savePath.startsWith("~")
                ) {
                    OutputWindow.Show(
                        OutputLevel.Trace,
                        `New path: ${generatedUri}`,
                    );
                } else {
                    OutputWindow.Show(
                        OutputLevel.Trace,
                        `Path to continue with: ${generatedUri}`,
                    );

                    FileWriter.MakeDirIfNotAvailable(generatedUri);
                }

                filePath = path.join(generatedUri, path.basename(filePath));
            }

            if (
                format.savePathReplacementPairs &&
                (format.savePath == null || format.savePath.startsWith("~"))
            ) {
                OutputWindow.Show(
                    OutputLevel.Trace,
                    "Using segment replacement",
                    [`Original path: ${filePath}`],
                    false,
                );

                generatedUri =
                    "/" +
                    path
                        .relative(workspacePath, path.dirname(filePath))
                        .replace(/\\/g, "/") +
                    "/";

                for (const key in format.savePathReplacementPairs) {
                    if (
                        Object.prototype.hasOwnProperty.call(
                            format.savePathReplacementPairs,
                            key,
                        )
                    ) {
                        const value = format.savePathReplacementPairs[key];

                        if (
                            typeof value === "string" ||
                            value instanceof String
                        ) {
                            OutputWindow.Show(
                                OutputLevel.Trace,
                                `Applying: ${key} => ${value}`,
                                null,
                                false,
                            );

                            generatedUri = generatedUri.replace(
                                key.replace(/\\/g, "/"),
                                value.toString().replace(/\\/g, "/"),
                            );
                        } else {
                            OutputWindow.Show(
                                OutputLevel.Error,
                                "Error: Invalid type passed to savePathReplacementPairs",
                                [
                                    `The key "${key}" must have a string value, not "${typeof value}"`,
                                ],
                            );

                            return null;
                        }
                    }
                }

                FileWriter.MakeDirIfNotAvailable(
                    path.join(workspacePath, generatedUri),
                );

                OutputWindow.Show(
                    OutputLevel.Trace,
                    `New path: ${generatedUri}`,
                );

                filePath = path.join(
                    workspacePath,
                    generatedUri,
                    path.basename(filePath),
                );
            }
        }

        const cssUri =
            filePath.substring(0, filePath.lastIndexOf(".")) + extensionName;

        return {
            css: cssUri,
            map: cssUri + ".map",
        };
    }

    static stripLeadingSlash(partialPath: string): string {
        return ["\\", "/"].indexOf(partialPath.substring(0, 1)) >= 0
            ? partialPath.substring(1)
            : partialPath;
    }

    static stripAnyLeadingSlashes(stringArray: string[] | null): string[] {
        if (!stringArray) {
            return [];
        }

        return stringArray.map((file) => {
            return SassPathResolver.stripLeadingSlash(file);
        });
    }
}
