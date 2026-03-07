import * as vscode from "vscode";

import { Settings } from "./Settings";
import { OutputWindow } from "./OutputWindow";
import { OutputLevel } from "../Enums/OutputLevel";
import { SassFileClassifier } from "../Files/SassFileClassifier";
import { SassFileCollector } from "../Files/SassFileCollector";
import { WorkspacePathContext } from "../Files/WorkspacePathContext";
import { SassConfirmationType } from "../Enums/SassConfirmationType";

export class DebugReporter {
    static async debugInclusion(): Promise<void> {
        OutputWindow.Show(
            OutputLevel.Critical,
            "Checking current file",
            null,
            false,
        );

        if (!vscode.window.activeTextEditor) {
            OutputWindow.Show(OutputLevel.Critical, "No active file", [
                "There isn't an active editor window to process",
                "Click an open file so it can be checked",
            ]);

            return;
        }

        const sassPath = vscode.window.activeTextEditor.document.fileName;

        OutputWindow.Show(OutputLevel.Critical, sassPath, null, true);

        const workspaceFolder =
            WorkspacePathContext.getWorkspaceFolder(sassPath);

        if (
            SassFileClassifier.confirmSassType(sassPath, workspaceFolder) ==
            SassConfirmationType.NotSass
        ) {
            OutputWindow.Show(OutputLevel.Critical, "Not a Sass file", [
                "The file currently open in the editor window isn't a sass file",
            ]);
        } else if (
            await SassFileClassifier.isSassFileExcluded(
                sassPath,
                workspaceFolder,
            )
        ) {
            OutputWindow.Show(OutputLevel.Critical, "File excluded", [
                "The file is excluded based on your settings, please check your configuration",
            ]);
        } else {
            OutputWindow.Show(
                OutputLevel.Critical,
                "File should get processed",
                [
                    "If the file isn't being processed, run `liveSass.command.debugFileList`",
                ],
            );
        }
    }

    static async debugFileList(): Promise<void> {
        const outputInfo: string[] = [],
            workspaceCount = vscode.workspace.workspaceFolders
                ? vscode.workspace.workspaceFolders.length
                : null;

        if (vscode.window.activeTextEditor) {
            outputInfo.push(
                "--------------------",
                "Current File",
                "--------------------",
                vscode.window.activeTextEditor.document.fileName,
            );
        }

        outputInfo.push(
            "--------------------",
            "Workspace Folders",
            "--------------------",
        );
        if (workspaceCount === null) {
            outputInfo.push("No workspaces, must be a single file");
        } else {
            vscode.workspace.workspaceFolders!.map((folder) => {
                outputInfo.push(
                    `[${folder.index}] ${folder.name}\n${folder.uri.fsPath}`,
                );
            });

            await Promise.all(
                vscode.workspace.workspaceFolders!.map(
                    async (folder, index) => {
                        const folderOutput: string[] = [];

                        folderOutput.push(
                            "--------------------",
                            `Checking workspace folder ${
                                index + 1
                            } of ${workspaceCount}`,
                            `Path: ${folder.uri.fsPath}`,
                            "--------------------",
                        );

                        const exclusionList = Settings.getConfigSettings<
                            string[]
                        >("excludeList", folder);

                        folderOutput.push(
                            "--------------------",
                            "Current Include/Exclude Settings",
                            "--------------------",
                            `Include: [ ${
                                Settings.getConfigSettings<string[] | null>(
                                    "includeItems",
                                    folder,
                                )?.join(", ") ?? "NULL"
                            } ]`,
                            `Exclude: [ ${exclusionList.join(", ")} ]`,
                        );

                        folderOutput.push(
                            "--------------------",
                            "Included SASS Files",
                            "--------------------",
                        );
                        (await SassFileCollector.getSassFiles(undefined, false, folder)).map((file) => {
                            folderOutput.push(file);
                        });

                        folderOutput.push(
                            "--------------------",
                            "Included Partial SASS Files",
                            "--------------------",
                        );
                        (
                            await SassFileCollector.getSassFiles(
                                Settings.getConfigSettings<string[]>(
                                    "partialsList",
                                    folder,
                                ),
                                true,
                                folder,
                            )
                        ).map((file) => {
                            folderOutput.push(file);
                        });

                        folderOutput.push(
                            "--------------------",
                            "Excluded SASS Files",
                            "--------------------",
                        );
                        if (exclusionList.length > 0) {
                            (
                                await SassFileCollector.getSassFiles(
                                    exclusionList,
                                    true,
                                    folder,
                                )
                            ).map((file) => {
                                folderOutput.push(file);
                            });
                        } else {
                            folderOutput.push("NONE");
                        }

                        outputInfo.push(...folderOutput);
                    },
                ),
            );
        }

        OutputWindow.Show(OutputLevel.Critical, "Extension Info", outputInfo);
    }
}
