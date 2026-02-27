"use strict";

import * as path from "path";
import * as vscode from "vscode";

import { FileHelper, IFileResolver } from "./Helpers/FileHelper";
import { SettingsHelper } from "./Helpers/SettingsHelper";
import { IFormat } from "./Interfaces/IFormat";

import { SassHelper } from "./Helpers/SassHelper";
import { StatusBarUi } from "./VsCode/StatusbarUi";
import { OutputLevel } from "./Enums/OutputLevel";
import { SassConfirmationType } from "./Enums/SassConfirmationType";
import { OutputWindow } from "./VsCode/OutputWindow";
import { ErrorLogger } from "./VsCode/ErrorLogger";

import BrowserslistError from "browserslist/error";
import { autoprefix } from "./Helpers/Autoprefix";

export class AppModel {
    isWatching: boolean;
    private _logger: ErrorLogger;
    private _fileWatcher: vscode.FileSystemWatcher | undefined;

    constructor(workplaceState: vscode.Memento) {
        OutputWindow.Show(OutputLevel.Trace, "Constructing app model");

        this.isWatching = false;

        this._logger = new ErrorLogger(workplaceState);

        if (SettingsHelper.getConfigSettings<boolean>("watchOnLaunch")) {
            void this.StartWatching();
        } else {
            this.revertUIToWatchingStatusNow();
        }

        OutputWindow.Show(OutputLevel.Trace, "App model constructed");
    }

    async StartWatching(): Promise<void> {
        const compileOnWatch =
            SettingsHelper.getConfigSettings<boolean>("compileOnWatch");

        if (!this.isWatching) {
            this.isWatching = !this.isWatching;

            // Set up file watchers
            this.setupFileWatcher();

            if (compileOnWatch) {
                void this.compileAllFiles();

                return;
            }
        }

        this.revertUIToWatchingStatusNow();
    }

    StopWatching(): void {
        if (this.isWatching) {
            this.isWatching = !this.isWatching;

            // Clean up file watchers
            this.disposeFileWatchers();
        }

        this.revertUIToWatchingStatusNow();
    }

    openOutputWindow(): void {
        OutputWindow.Show(OutputLevel.Critical, null, null, false);
    }

    async createIssue(): Promise<void> {
        await this._logger.InitiateIssueCreator();
    }

    /**
       * Waiting to see if Autoprefixer will add my changes
      async browserslistChecks(): Promise<void> {
          try {
              const autoprefixerTarget = Helper.getConfigSettings<Array<string> | boolean>(
                      "autoprefix"
                  ),
                  filePath = vscode.window.activeTextEditor.document.fileName;
  
              if (
                  autoprefixerTarget === true &&
                  (
                      filePath.endsWith(`${path.sep}package.json`) ||
                      filePath.endsWith(`${path.sep}.browserslistrc`)
                  )
              )
                  autoprefixer.clearBrowserslistCaches();
  
          } catch (err) {
              await this._logger.LogIssueWithAlert(
                  `Unhandled error while clearing browserslist cache. Error message: ${err.message}`,
                  {
                      triggeringFile: vscode.window.activeTextEditor.document.fileName,
                      error: ErrorLogger.PrepErrorForLogging(err),
                  }
              );
          }
      }
       */

    //#region Compilation functions

    //#region Public

    /**
     * Compile all files.
     */
    async compileAllFiles(): Promise<void> {
        OutputWindow.Show(OutputLevel.Trace, "Starting to compile all files");

        try {
            StatusBarUi.working();

            await this.GenerateAllCssAndMap();
        } catch (err) {
            let files: string[] | string;
            try {
                files = await this.getSassFiles();
            } catch (_) {
                files = "Error lies in getSassFiles()";
            }
            await this.logUnhandledError("compiling all files", err, { files });
        }

        this.revertUIToWatchingStatusNow();
    }

    /**
     * Compiles the currently active file
     */
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

                this.revertUIToWatchingStatus();

                return;
            }

            const sassPath = vscode.window.activeTextEditor.document.fileName,
                workspaceFolder = AppModel.getWorkspaceFolder(sassPath),
                sassFileType = this.confirmSassType(sassPath, workspaceFolder);

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

                    this.revertUIToWatchingStatus();

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

                    this.revertUIToWatchingStatus();

                    return;
            }

            StatusBarUi.working("Processing single file...");
            OutputWindow.Show(
                OutputLevel.Debug,
                "Processing the current file",
                [`Path: ${sassPath}`],
            );

            await this.handleSingleFile(workspaceFolder, sassPath);
        } catch (err) {
            const sassPath = vscode.window.activeTextEditor
                ? vscode.window.activeTextEditor.document.fileName
                : "/* NO ACTIVE FILE, PROCESSING SHOULD NOT HAVE OCCURRED */";
            await this.logUnhandledError("compiling the active file", err, {
                files: sassPath,
            });
        }
    }

    //#endregion Public

    //#region Private

    private async processSingleFile(
        workspaceFolder: vscode.WorkspaceFolder | undefined,
        sassPath: string,
    ) {
        const formats = SettingsHelper.getConfigSettings<IFormat[]>(
            "formats",
            workspaceFolder,
        );

        return await Promise.all(
            formats.map(async (format, index) => {
                OutputWindow.Show(
                    OutputLevel.Trace,
                    `Starting format ${index + 1} of ${formats.length}`,
                    [`Settings: ${JSON.stringify(format)}`],
                );

                // Each format
                return await this.GenerateCssAndMap(
                    workspaceFolder,
                    sassPath,
                    format,
                );
            }),
        );
    }

    private async handleSingleFile(
        workspaceFolder: vscode.WorkspaceFolder | undefined,
        sassPath: string,
    ) {
        const results = await this.processSingleFile(workspaceFolder, sassPath);

        if (results.every((r) => r)) {
            StatusBarUi.compilationSuccess(this.isWatching);
            this.hideOutputWindowIfApplicable();
        } else if (results.length) {
            StatusBarUi.compilationError(this.isWatching);
        }
    }

    /**
     * To Generate one One Css & Map file from Sass/Scss
     * @param sassPath Sass/Scss file URI (string)
     * @param targetCssUri Target CSS file URI (string)
     * @param mapFileUri Target MAP file URI (string)
     * @param options - Object - It includes target CSS style and some more.
     */
    private async GenerateCssAndMap(
        folder: vscode.WorkspaceFolder | undefined,
        sassPath: string,
        format: IFormat,
    ) {
        OutputWindow.Show(OutputLevel.Trace, "Starting compilation", [
            "Starting compilation of file",
            `Path: ${sassPath}`,
        ]);

        const paths = this.generateCssAndMapUri(sassPath, format, folder);

        if (paths === null) {
            return false;
        }

        // Resolve generateMapIncludeSources: per-format overrides global
        const generateMapIncludeSources =
            format.generateMapIncludeSources ??
            SettingsHelper.getConfigSettings<boolean>(
                "generateMapIncludeSources",
                folder,
            );

        const options = SassHelper.toSassOptions(
            format,
            generateMapIncludeSources,
        );

        const generateMap =
                format.generateMap ??
                SettingsHelper.getConfigSettings<boolean>(
                    "generateMap",
                    folder,
                ),
            compileResult = await SassHelper.compileOneAsync(
                sassPath,
                paths.css,
                options,
            ),
            promises: Promise<IFileResolver>[] = [];

        let autoprefixerTarget = SettingsHelper.getConfigSettings<
            Array<string> | string | boolean | null
        >("autoprefix", folder);

        if (compileResult.errorString !== null) {
            OutputWindow.Show(OutputLevel.Error, "Compilation Error", [
                compileResult.errorString,
            ]);

            return false;
        }

        let css: string | undefined = compileResult.result?.css,
            map: string | undefined | null = compileResult.result?.map;

        if (css === undefined) {
            OutputWindow.Show(OutputLevel.Error, "Compilation Error", [
                "There was no CSS output from sass/sass",
                `Sass error: ${compileResult.errorString ?? "NONE"}`,
            ]);

            return false;
        }

        if (autoprefixerTarget === null) {
            autoprefixerTarget = false;
        }

        if (autoprefixerTarget != false) {
            OutputWindow.Show(
                OutputLevel.Trace,
                "Autoprefixer isn't false, applying to file",
                [`Path: ${sassPath}`],
            );

            try {
                const autoprefixerResult = await autoprefix(
                    css,
                    map,
                    paths.css,
                    autoprefixerTarget,
                    generateMap,
                );
                css = autoprefixerResult.css;
                map = autoprefixerResult.map;
            } catch (err) {
                if (err instanceof BrowserslistError) {
                    OutputWindow.Show(
                        OutputLevel.Error,
                        "Autoprefix error. Your changes have not been saved",
                        [`Message: ${err.message}`, `Path: ${sassPath}`],
                    );
                    return false;
                } else {
                    throw err;
                }
            }
        }

        if (map && generateMap) {
            css += `/*# sourceMappingURL=${path.basename(paths.map)} */`;

            promises.push(FileHelper.writeToOneFile(paths.map, map));
        }

        promises.push(FileHelper.writeToOneFile(paths.css, css));

        const fileResolvers = await Promise.all(promises);

        OutputWindow.Show(OutputLevel.Information, "Generated:", null, false);

        fileResolvers.forEach((fileResolver) => {
            if (fileResolver.Exception) {
                OutputWindow.Show(OutputLevel.Error, "Error:", [
                    fileResolver.Exception.errno?.toString() ??
                        "UNKNOWN ERR NUMBER",
                    fileResolver.Exception.path ?? "UNKNOWN PATH",
                    fileResolver.Exception.message,
                ]);
                console.error("error :", fileResolver);
            } else {
                OutputWindow.Show(
                    OutputLevel.Information,
                    null,
                    [fileResolver.FileUri],
                    false,
                );
            }
        });

        OutputWindow.Show(OutputLevel.Information, null, null, true);

        return true;
    }

    /**
     * To compile all Sass/scss files
     */
    private async GenerateAllCssAndMap() {
        const sassPaths = await this.getSassFiles();

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

                return this.processSingleFile(
                    AppModel.getWorkspaceFolder(sassPath),
                    sassPath,
                );
            }),
        );

        if (results.every((r) => r.every((s) => s))) {
            StatusBarUi.compilationSuccess(this.isWatching);

            this.hideOutputWindowIfApplicable();
        } else if (results.length) {
            StatusBarUi.compilationError(this.isWatching);
        }
    }

    /**
     * Generate a full save path for the final css & map files
     * @param filePath The path to the current SASS file
     */
    private generateCssAndMapUri(
        filePath: string,
        format: IFormat,
        workspaceRoot?: vscode.WorkspaceFolder,
    ) {
        OutputWindow.Show(OutputLevel.Trace, "Calculating file paths", [
            "Calculating the save paths for the css and map output files",
            `Originating path: ${filePath}`,
        ]);

        const extensionName = format.extensionName || ".css";

        if (workspaceRoot) {
            OutputWindow.Show(OutputLevel.Trace, "No workspace provided", [
                `Using originating path: ${filePath}`,
            ]);

            const workspacePath = workspaceRoot.uri.fsPath;
            let generatedUri: string | null = null;

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

                    FileHelper.MakeDirIfNotAvailable(generatedUri);
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
                        Object.prototype.hasOwnProperty.hasOwnProperty.call(
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

                FileHelper.MakeDirIfNotAvailable(
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

    //#endregion Private

    //#endregion Compilation functions

    //#region UI manipulation functions

    /**
     * Hides the output window after successful compilation if the
     * `hideOutputWindowOnSuccess` setting is enabled and the current
     * output log level is Information or lower (Warning, Error, None).
     */
    private hideOutputWindowIfApplicable() {
        if (
            SettingsHelper.getHideOutputWindowOnSuccess() &&
            SettingsHelper.getOutputLogLevel() >= OutputLevel.Information
        ) {
            OutputWindow.Hide();
        }
    }

    private revertUIToWatchingStatus() {
        OutputWindow.Show(
            OutputLevel.Trace,
            "Registered timeout to revert UI to correct watching status",
        );

        setTimeout(() => {
            this.revertUIToWatchingStatusNow();
        }, 3000);
    }

    private revertUIToWatchingStatusNow() {
        OutputWindow.Show(OutputLevel.Trace, "Switching UI state");

        if (this.isWatching) {
            StatusBarUi.watching();

            OutputWindow.Show(OutputLevel.Information, "Watching...");
        } else {
            StatusBarUi.notWatching();

            OutputWindow.Show(OutputLevel.Information, "Not Watching...");
        }
    }

    //#endregion UI manipulation functions

    //#region Fetch & check SASS functions

    //#region Private

    private confirmSassType(
        pathUrl: string,
        workspaceFolder?: vscode.WorkspaceFolder,
    ): SassConfirmationType {
        const filename = path.basename(pathUrl).toLowerCase();

        if (filename.endsWith("sass") || filename.endsWith("scss")) {
            if (workspaceFolder === undefined) {
                // No workspace - use simple underscore convention
                if (filename.startsWith("_")) {
                    return SassConfirmationType.PartialFile;
                }
                return SassConfirmationType.SassFile;
            }

            // Get partial patterns from settings
            const partialPatterns = SettingsHelper.getConfigSettings<string[]>(
                "partialsList",
                workspaceFolder,
            );

            if (!partialPatterns || partialPatterns.length === 0) {
                // No patterns configured - use simple underscore convention
                if (filename.startsWith("_")) {
                    return SassConfirmationType.PartialFile;
                }
                return SassConfirmationType.SassFile;
            }

            // Use VS Code's pattern matching for efficient and reliable glob matching
            const relativePatterns =
                AppModel.stripAnyLeadingSlashes(partialPatterns);

            if (
                AppModel.matchesGlobPattern(
                    relativePatterns,
                    pathUrl,
                    workspaceFolder,
                )
            ) {
                return SassConfirmationType.PartialFile;
            }

            return SassConfirmationType.SassFile;
        }

        return SassConfirmationType.NotSass;
    }

    private async isSassFileExcluded(
        sassPath: string,
        workspaceFolder?: vscode.WorkspaceFolder,
    ): Promise<boolean> {
        OutputWindow.Show(
            OutputLevel.Trace,
            "Checking SASS path isn't excluded",
            [`Path: ${sassPath}`],
        );

        if (!workspaceFolder) {
            OutputWindow.Show(
                OutputLevel.Trace,
                "No workspace folder, checking the current file",
            );
            return (
                path.basename(sassPath).startsWith("_") ||
                !(sassPath.endsWith(".scss") || sassPath.endsWith(".sass"))
            );
        }

        // Get settings once at the start
        const includeItems = SettingsHelper.getConfigSettings<string[] | null>(
            "includeItems",
            workspaceFolder,
        );
        const excludeItems = AppModel.stripAnyLeadingSlashes(
            SettingsHelper.getConfigSettings<string[]>(
                "excludeList",
                workspaceFolder,
            ),
        );
        const partialsList = SettingsHelper.getConfigSettings<string[]>(
            "partialsList",
            workspaceFolder,
        );

        // Build include patterns list
        let includePatterns = ["**/*.s[ac]ss"];
        if (includeItems && includeItems.length) {
            includePatterns = AppModel.stripAnyLeadingSlashes(
                includeItems.concat(partialsList),
            );
        }

        // Resolve effective workspace (handles forceBaseDirectory)
        const resolved =
            await AppModel.resolveEffectiveBasePath(workspaceFolder);
        if (!resolved) {
            return false; // Error already logged by helper
        }

        const { basePath, effectiveFolder } = resolved;

        // Check if the file is under the effective base directory
        const relativePath = path.relative(basePath, sassPath);
        if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
            OutputWindow.Show(
                OutputLevel.Trace,
                "File is outside effective base directory - excluded",
                [`File: ${sassPath}`, `Base: ${basePath}`],
            );
            return true;
        }

        // Check if file matches include patterns
        const isIncluded = AppModel.matchesGlobPattern(
            includePatterns,
            sassPath,
            effectiveFolder,
        );

        OutputWindow.Show(OutputLevel.Trace, "Include pattern check", [
            `File: ${sassPath}`,
            `Included: ${isIncluded}`,
        ]);

        if (!isIncluded) {
            OutputWindow.Show(
                OutputLevel.Trace,
                "File doesn't match include patterns - excluded",
            );
            return true;
        }

        // Check if file matches exclude patterns
        if (excludeItems.length > 0) {
            const isExcluded = AppModel.matchesGlobPattern(
                excludeItems,
                sassPath,
                effectiveFolder,
            );

            OutputWindow.Show(OutputLevel.Trace, "Exclude pattern check", [
                `File: ${sassPath}`,
                `Excluded: ${isExcluded}`,
            ]);

            if (isExcluded) {
                OutputWindow.Show(
                    OutputLevel.Trace,
                    "File matches exclude patterns - excluded",
                );
                return true;
            }
        }

        OutputWindow.Show(OutputLevel.Trace, "File is not excluded");
        return false;
    }

    private async getSassFiles(
        queryPattern?: string[],
        isDebugging = false,
    ): Promise<string[]> {
        OutputWindow.Show(OutputLevel.Trace, "Getting SASS files", [
            `Query pattern: ${queryPattern}`,
            `Can be overwritten: ${queryPattern == undefined}`,
        ]);

        const fileList: string[] = [];

        if (
            vscode.workspace.workspaceFolders &&
            vscode.workspace.workspaceFolders.length > 0
        ) {
            const results = await Promise.all(
                vscode.workspace.workspaceFolders.map(async (folder, index) => {
                    OutputWindow.Show(
                        OutputLevel.Trace,
                        `Checking folder ${index + 1} of ${vscode.workspace.workspaceFolders!.length}`,
                        [`Folder: ${folder.name}`],
                    );

                    // Get settings once at the start
                    const includeItems = SettingsHelper.getConfigSettings<
                        string[] | null
                    >("includeItems", folder);

                    let excludedItems = isDebugging
                        ? ["**/node_modules/**", ".vscode/**"]
                        : SettingsHelper.getConfigSettings<string[]>(
                              "excludeList",
                              folder,
                          );

                    // Determine query pattern
                    let effectivePattern = queryPattern;
                    if (effectivePattern) {
                        effectivePattern = AppModel.stripAnyLeadingSlashes(
                            Array.isArray(effectivePattern)
                                ? effectivePattern
                                : [effectivePattern],
                        );
                    } else if (includeItems && includeItems.length) {
                        effectivePattern =
                            AppModel.stripAnyLeadingSlashes(includeItems);
                        OutputWindow.Show(
                            OutputLevel.Trace,
                            "Query pattern overwritten",
                            [`New pattern(s): "${includeItems.join('" , "')}"`],
                        );
                    }

                    excludedItems =
                        AppModel.stripAnyLeadingSlashes(excludedItems);

                    // Resolve effective workspace (handles forceBaseDirectory)
                    const resolved =
                        await AppModel.resolveEffectiveBasePath(folder);
                    if (!resolved) {
                        return null; // Error already logged by helper
                    }

                    const { basePath } = resolved;

                    // Add partials to excludedItems (unless debugging)
                    if (!isDebugging) {
                        excludedItems.push(
                            ...AppModel.stripAnyLeadingSlashes(
                                SettingsHelper.getConfigSettings<string[]>(
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

    //#endregion Private

    //#endregion Fetch & check SASS functions

    //#region Debugging

    async debugInclusion(): Promise<void> {
        OutputWindow.Show(
            OutputLevel.Critical,
            "Checking current file",
            null,
            false,
        );

        try {
            if (!vscode.window.activeTextEditor) {
                OutputWindow.Show(OutputLevel.Critical, "No active file", [
                    "There isn't an active editor window to process",
                    "Click an open file so it can be checked",
                ]);

                return;
            }

            const sassPath = vscode.window.activeTextEditor.document.fileName;

            OutputWindow.Show(OutputLevel.Critical, sassPath, null, true);

            const workspaceFolder = AppModel.getWorkspaceFolder(sassPath);

            if (
                this.confirmSassType(sassPath, workspaceFolder) ==
                SassConfirmationType.NotSass
            ) {
                OutputWindow.Show(OutputLevel.Critical, "Not a Sass file", [
                    "The file currently open in the editor window isn't a sass file",
                ]);
            } else if (
                await this.isSassFileExcluded(sassPath, workspaceFolder)
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

                            const exclusionList =
                                SettingsHelper.getConfigSettings<string[]>(
                                    "excludeList",
                                    folder,
                                );

                            folderOutput.push(
                                "--------------------",
                                "Current Include/Exclude Settings",
                                "--------------------",
                                `Include: [ ${
                                    SettingsHelper.getConfigSettings<
                                        string[] | null
                                    >("includeItems", folder)?.join(", ") ??
                                    "NULL"
                                } ]`,
                                `Exclude: [ ${exclusionList.join(", ")} ]`,
                            );

                            folderOutput.push(
                                "--------------------",
                                "Included SASS Files",
                                "--------------------",
                            );
                            (await this.getSassFiles()).map((file) => {
                                folderOutput.push(file);
                            });

                            folderOutput.push(
                                "--------------------",
                                "Included Partial SASS Files",
                                "--------------------",
                            );
                            (
                                await this.getSassFiles(
                                    SettingsHelper.getConfigSettings<string[]>(
                                        "partialsList",
                                        folder,
                                    ),
                                    true,
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
                                    await this.getSassFiles(exclusionList, true)
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

            OutputWindow.Show(
                OutputLevel.Critical,
                "Extension Info",
                outputInfo,
            );
        } catch (err) {
            const sassPath = vscode.window.activeTextEditor
                ? vscode.window.activeTextEditor.document.fileName
                : "/* NO ACTIVE FILE, DETAILS BELOW */";
            await this.logUnhandledError("generating file list", err, {
                file: sassPath,
            });
        }
    }

    //#endregion Debugging

    //#region Helper Methods

    /**
     * Logs an unhandled error with consistent formatting.
     * @param context Description of what was happening when the error occurred
     * @param err The error that was caught
     * @param additionalData Additional data to include in the log
     */
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

    /**
     * Resolves the effective base path for a workspace folder, accounting for forceBaseDirectory setting.
     * @param workspaceFolder The workspace folder to resolve
     * @returns The resolved base path and effective workspace folder, or null if validation fails
     */
    private static async resolveEffectiveBasePath(
        workspaceFolder: vscode.WorkspaceFolder,
    ): Promise<{
        basePath: string;
        effectiveFolder: vscode.WorkspaceFolder;
    } | null> {
        const forceBaseDirectory = SettingsHelper.getConfigSettings<
            string | null
        >("forceBaseDirectory", workspaceFolder);

        let basePath = workspaceFolder.uri.fsPath;
        let effectiveFolder = workspaceFolder;

        if (forceBaseDirectory && forceBaseDirectory.length > 1) {
            OutputWindow.Show(
                OutputLevel.Trace,
                "`forceBaseDirectory` setting found, checking validity",
            );

            basePath = path.resolve(
                workspaceFolder.uri.fsPath,
                AppModel.stripLeadingSlash(forceBaseDirectory),
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

    //#endregion Helper Methods

    /**
     * Tests if a file matches any of the given glob patterns using VS Code's built-in pattern matching.
     * This is more efficient and reliable than custom regex conversion.
     * Paths and patterns are normalized to lowercase for case-insensitive matching.
     *
     * @param patterns Array of glob patterns to test against
     * @param fileOrPath Either a TextDocument or a file path string
     * @param workspaceFolder The workspace folder for relative pattern matching
     * @returns true if the file matches any of the patterns
     */
    private static matchesGlobPattern(
        patterns: string[],
        fileOrPath: vscode.TextDocument | string,
        workspaceFolder?: vscode.WorkspaceFolder,
    ): boolean {
        if (patterns.length === 0) {
            return false;
        }

        // Normalize patterns to lowercase for case-insensitive matching
        const normalizedPatterns = patterns.map((p) => p.toLowerCase());

        // Build the document selector with all patterns (lowercase)
        const selector: vscode.DocumentSelector = normalizedPatterns.map(
            (pattern) => ({
                pattern: workspaceFolder
                    ? new vscode.RelativePattern(workspaceFolder, pattern)
                    : pattern,
            }),
        );

        // Get or create the document-like object for matching
        let document:
            | vscode.TextDocument
            | { uri: vscode.Uri; languageId: string };

        if (typeof fileOrPath === "string") {
            // Create a minimal document-like object from the file path (lowercase for matching)
            const uri = vscode.Uri.file(fileOrPath.toLowerCase());
            const ext = path.extname(fileOrPath).toLowerCase();
            document = {
                uri,
                languageId: ext === ".sass" ? "sass" : "scss",
            };
        } else {
            // For TextDocument, create a lowercase URI version for matching
            document = {
                uri: vscode.Uri.file(fileOrPath.uri.fsPath.toLowerCase()),
                languageId: fileOrPath.languageId,
            };
        }

        // Use VS Code's pattern matching - returns score > 0 if matches
        // @ts-expect-error - VS Code's match function accepts minimal document objects with uri and languageId
        return vscode.languages.match(selector, document) != 0;
    }

    private static stripLeadingSlash(partialPath: string): string {
        return ["\\", "/"].indexOf(partialPath.substring(0, 1)) >= 0
            ? partialPath.substring(1)
            : partialPath;
    }

    private static stripAnyLeadingSlashes(
        stringArray: string[] | null,
    ): string[] {
        if (!stringArray) {
            return [];
        }

        return stringArray.map((file) => {
            return AppModel.stripLeadingSlash(file);
        });
    }

    private static getWorkspaceFolder(
        filePath: string,
        suppressOutput = false,
    ) {
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

    /**
     * Sets up a single file watcher for all SASS/SCSS files across all workspaces.
     * VS Code docs recommend minimizing the number of file watchers for performance.
     */
    private setupFileWatcher(): void {
        OutputWindow.Show(OutputLevel.Trace, "Setting up file watcher");

        // Clean up any existing watcher first
        this.disposeFileWatchers();

        // Create a single global watcher for all SASS/SCSS files
        this._fileWatcher =
            vscode.workspace.createFileSystemWatcher("**/*.{sass,scss}");

        this._fileWatcher.onDidChange(async (uri) => {
            OutputWindow.Show(
                OutputLevel.Trace,
                'File watcher: "onDidChange"',
                [`File: ${uri.fsPath}`],
            );
            await this.handleFileChange(uri);
        });

        this._fileWatcher.onDidCreate(async (uri) => {
            OutputWindow.Show(
                OutputLevel.Trace,
                'File watcher: "onDidCreate"',
                [`File: ${uri.fsPath}`],
            );
            await this.handleFileChange(uri);
        });

        this._fileWatcher.onDidDelete(async (uri) => {
            OutputWindow.Show(
                OutputLevel.Trace,
                'File watcher: "onDidDelete"',
                [`File: ${uri.fsPath}`],
            );
            // Deletion of partials should trigger recompilation of all files
            await this.handleFileChange(uri, true);
        });

        OutputWindow.Show(OutputLevel.Trace, "File watcher set up");
    }

    private disposeFileWatchers(): void {
        if (this._fileWatcher) {
            OutputWindow.Show(OutputLevel.Trace, "Disposing file watcher");
            this._fileWatcher.dispose();
            this._fileWatcher = undefined;
        }
    }

    /**
     * Handles a file change event by determining the file type and taking appropriate action.
     * @param uri The URI of the changed file
     * @param isDelete Whether this is a delete event (affects non-partial handling)
     */
    private async handleFileChange(
        uri: vscode.Uri,
        isDelete = false,
    ): Promise<void> {
        if (!this.isWatching) {
            return;
        }

        const filePath = uri.fsPath;
        const workspaceFolder = AppModel.getWorkspaceFolder(filePath, false);

        // Determine file type using efficient pattern matching (no async findFiles call)
        const fileType = this.confirmSassType(filePath, workspaceFolder);

        OutputWindow.Show(OutputLevel.Trace, "File type determined", [
            `File: ${filePath}`,
            `Type: ${SassConfirmationType[fileType]}`,
        ]);

        switch (fileType) {
            case SassConfirmationType.NotSass:
                // Not a SASS file - should not happen with our watcher pattern, but handle gracefully
                return;

            case SassConfirmationType.PartialFile:
                await this.handlePartialFileChange(uri);
                break;

            case SassConfirmationType.SassFile:
                // For deletions, non-partial files don't need recompilation
                if (!isDelete) {
                    await this.handleNonPartialFileChange(uri, workspaceFolder);
                }
                break;
        }
    }

    private async handlePartialFileChange(uri: vscode.Uri): Promise<void> {
        try {
            StatusBarUi.working();
            OutputWindow.Show(
                OutputLevel.Information,
                "Partial file change detected - " + new Date().toLocaleString(),
                [path.basename(uri.fsPath)],
            );

            // Partial file changes trigger compilation of all files
            await this.GenerateAllCssAndMap();
        } catch (err) {
            OutputWindow.Show(
                OutputLevel.Error,
                "Error handling partial file change",
                [`File: ${uri.fsPath}`, `Error: ${err}`],
            );
        }

        this.revertUIToWatchingStatus();
    }

    private async handleNonPartialFileChange(
        uri: vscode.Uri,
        workspaceFolder?: vscode.WorkspaceFolder,
    ): Promise<void> {
        try {
            const currentFile = uri.fsPath;

            // Check if file is excluded
            if (await this.isSassFileExcluded(currentFile, workspaceFolder)) {
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

            // Non-partial files only compile the single file
            await this.handleSingleFile(workspaceFolder, currentFile);
        } catch (err) {
            OutputWindow.Show(OutputLevel.Error, "Error handling file change", [
                `File: ${uri.fsPath}`,
                `Error: ${err}`,
            ]);
        }

        this.revertUIToWatchingStatus();
    }

    dispose(): void {
        OutputWindow.Show(OutputLevel.Trace, "Disposing app model");

        // Dispose file watchers first
        this.disposeFileWatchers();

        StatusBarUi.dispose();
        OutputWindow.dispose();

        OutputWindow.Show(OutputLevel.Trace, "App model disposed");
    }
}
