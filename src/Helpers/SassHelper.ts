import { SettingsHelper } from "./SettingsHelper";
import { IFormat } from "../Interfaces/IFormat";
import { OutputWindow } from "../VsCode/OutputWindow";
import { OutputLevel } from "../Enums/OutputLevel";
import { workspace } from "vscode";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { Logger, Options, SourceSpan, compileAsync } from "sass-embedded";
import { ISassCompileResult } from "../Interfaces/ISassCompileResult";

export class SassHelper {
    private static readonly loggerProperty: Logger = {
        warn: (
            message: string,
            options: {
                deprecation: boolean;
                span?: SourceSpan;
                stack?: string;
            }
        ) => {
            OutputWindow.Show(
                OutputLevel.Warning,
                "Warning:",
                [message].concat(
                    this.format(
                        options.span,
                        options.stack,
                        options.deprecation
                    )
                )
            );
        },
        debug: (message: string, options: { span?: SourceSpan }) => {
            OutputWindow.Show(
                OutputLevel.Debug,
                "Debug info:",
                [message].concat(this.format(options.span))
            );
        },
    };

    /**
     * Converts the given format object to Sass options.
     * @param format - The format object containing the desired options.
     * @returns The Sass options object.
     */
    static toSassOptions(format: IFormat): Options<"async"> {
        return {
            style: format.format,
            importers: [
                {
                    findFileUrl: (importUrl) =>
                        // @ts-ignore: 2322
                        SassHelper.parsePath(importUrl, (newPath) =>
                            pathToFileURL(newPath)
                        ),
                },
            ],
            logger: SassHelper.loggerProperty,
            sourceMap: true,
            sourceMapIncludeSources: true,
        };
    }

    /**
     * Compiles a single Sass file asynchronously.
     *
     * @param SassPath - The path to the Sass file to compile.
     * @param targetCssUri - The URI of the target CSS file.
     * @param options - The options for the Sass compilation.
     * @returns A promise that resolves to the Sass compile result.
     */
    static async compileOneAsync(
        SassPath: string,
        targetCssUri: string,
        options: Options<"async">
    ): Promise<ISassCompileResult> {
        try {
            const { css, sourceMap } = await compileAsync(SassPath, options);

            if (sourceMap) {
                sourceMap.sources = sourceMap.sources.map((sourcePath) =>
                    path.relative(
                        path.join(targetCssUri, "../"),
                        fileURLToPath(sourcePath)
                    )
                );
            }

            return {
                result: {
                    css: css,
                    map: sourceMap ? JSON.stringify(sourceMap) : undefined,
                },
                errorString: null,
            };
        } catch (err) {
            if (err instanceof Error) {
                console.log("Error:", err.message, err);

                return {
                    result: null,
                    errorString: err.name + ": " + err.message,
                };
            }

            console.log("Error: (NOT `Error`)", err);

            return { result: null, errorString: "Unexpected error" };
        }
    }

    private static parsePath<T>(
        importUrl: string,
        cb: (newPath: string) => T
    ): T | null {
        if (workspace.workspaceFolders) {
            const normalisedUrl = importUrl.replace(/\\/g, "/"),
                urlParts = normalisedUrl
                    .substring(1)
                    .split("/")
                    .filter((x) => x.length > 0);

            if (
                normalisedUrl.startsWith("~") &&
                normalisedUrl.indexOf("/") > -1
            ) {
                for (let i = 0; i < workspace.workspaceFolders.length; i++) {
                    const workingPath = [
                        workspace.workspaceFolders[i].uri.fsPath,
                        "node_modules",
                    ]
                        .concat(...urlParts.slice(0, -1))
                        .join("/");

                    if (existsSync(workingPath)) {
                        return cb(
                            workingPath +
                                path.sep +
                                urlParts.slice(-1).join(path.sep)
                        );
                    }
                }
            } else if (normalisedUrl.startsWith("/")) {
                for (let i = 0; i < workspace.workspaceFolders.length; i++) {
                    const folder = workspace.workspaceFolders[i],
                        rootIsWorkspace =
                            SettingsHelper.getConfigSettings<boolean>(
                                "rootIsWorkspace",
                                folder
                            );

                    if (rootIsWorkspace) {
                        const filePath = [
                            folder.uri.fsPath,
                            normalisedUrl.substring(1),
                        ].join("/");

                        if (
                            existsSync(
                                filePath.substring(0, filePath.lastIndexOf("/"))
                            )
                        ) {
                            return cb(filePath);
                        }
                    }
                }
            }
        }

        return null;
    }

    static format(
        span: SourceSpan | undefined | null,
        stack?: string,
        deprecated?: boolean
    ): string[] {
        const stringArray: string[] = [];

        if (span === undefined || span === null) {
            if (stack !== undefined) {
                stringArray.push(stack);
            }
        } else {
            stringArray.push(
                this.charOfLength(span.start.line.toString().length, "╷")
            );

            let lineNumber = span.start.line;

            do {
                stringArray.push(
                    `${lineNumber} |${
                        span.context?.split("\n")[
                            lineNumber - span.start.line
                        ] ?? span.text.split("\n")[lineNumber - span.start.line]
                    }`
                );

                lineNumber++;
            } while (lineNumber < span.end.line);

            stringArray.push(
                this.charOfLength(
                    span.start.line.toString().length,
                    this.addUnderLine(span)
                )
            );

            stringArray.push(
                this.charOfLength(span.start.line.toString().length, "╵")
            );

            if (span.url) {
                // possibly include `,${span.end.line}:${span.end.column}`, if VS Code ever supports it
                stringArray.push(
                    `${span.url.toString()}:${span.start.line}:${
                        span.start.column
                    }`
                );
            }
        }

        if (deprecated === true) {
            stringArray.push(
                "THIS IS DEPRECATED AND WILL BE REMOVED IN SASS 2.0"
            );
        }

        return stringArray;
    }

    private static charOfLength(
        charCount: number,
        suffix?: string,
        char = " "
    ): string {
        if (charCount < 0) {
            return suffix ?? "";
        }

        let outString = "";

        for (let item = 0; item <= charCount; item++) {
            outString += char;
        }

        return outString + (suffix ?? "");
    }

    private static addUnderLine(span: SourceSpan): string {
        let outString = "|";

        if (span.start.line !== span.end.line) {
            outString += this.charOfLength(span.end.column - 4, "...^");
        } else {
            outString +=
                this.charOfLength(span.start.column - 2, "^") +
                this.charOfLength(
                    span.end.column - span.start.column - 1,
                    "^",
                    "."
                );
        }

        return outString;
    }
}
