import * as path from "path";
import * as vscode from "vscode";

import { Settings } from "../VsCode/Settings";
import { IFormat } from "../Interfaces/IFormat";
import { SassCompiler } from "./SassCompiler";
import { autoprefix } from "./CssPostProcessor";
import { FileWriter } from "../Files/FileWriter";
import { IFileResolver } from "../Files/IFileResolver";
import { SassPathResolver } from "../Files/SassPathResolver";
import { OutputWindow } from "../VsCode/OutputWindow";
import { OutputLevel } from "../Enums/OutputLevel";

import BrowserslistError from "browserslist/error";

export class SassCompilationService {
    /**
     * Compiles a single SASS file across all configured formats.
     */
    static async processSingleFile(
        workspaceFolder: vscode.WorkspaceFolder | undefined,
        sassPath: string,
    ): Promise<boolean[]> {
        const formats = Settings.getConfigSettings<IFormat[]>(
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

                return await SassCompilationService.compileSingleFormat(
                    workspaceFolder,
                    sassPath,
                    format,
                );
            }),
        );
    }

    /**
     * Compiles a single SASS file for a single format.
     */
    private static async compileSingleFormat(
        folder: vscode.WorkspaceFolder | undefined,
        sassPath: string,
        format: IFormat,
    ): Promise<boolean> {
        OutputWindow.Show(OutputLevel.Trace, "Starting compilation", [
            "Starting compilation of file",
            `Path: ${sassPath}`,
        ]);

        const paths = SassPathResolver.generateCssAndMapUri(
            sassPath,
            format,
            folder,
        );

        if (paths === null) {
            return false;
        }

        // Resolve generateMapIncludeSources: per-format overrides global
        const generateMapIncludeSources =
            format.generateMapIncludeSources ??
            Settings.getConfigSettings<boolean>(
                "generateMapIncludeSources",
                folder,
            );

        const pathAliases = Settings.getConfigSettings<Record<
            string,
            string
        > | null>("pathAliases", folder);

        const options = SassCompiler.toSassOptions(
            format,
            generateMapIncludeSources,
            pathAliases,
        );

        const generateMap =
                format.generateMap ??
                Settings.getConfigSettings<boolean>("generateMap", folder),
            compileResult = await SassCompiler.compileOneAsync(
                sassPath,
                paths.css,
                options,
            ),
            promises: Promise<IFileResolver>[] = [];

        let autoprefixerTarget = Settings.getConfigSettings<
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

            promises.push(FileWriter.writeToOneFile(paths.map, map));
        }

        promises.push(FileWriter.writeToOneFile(paths.css, css));

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
}
