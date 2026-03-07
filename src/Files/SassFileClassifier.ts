import * as path from "path";
import * as vscode from "vscode";

import { Settings } from "../VsCode/Settings";
import { OutputWindow } from "../VsCode/OutputWindow";
import { OutputLevel } from "../Enums/OutputLevel";
import { SassConfirmationType } from "../Enums/SassConfirmationType";
import { SassPathResolver } from "./SassPathResolver";
import { WorkspacePathContext } from "./WorkspacePathContext";

export class SassFileClassifier {
    static confirmSassType(
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
            const partialPatterns = Settings.getConfigSettings<string[]>(
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
                SassPathResolver.stripAnyLeadingSlashes(partialPatterns);

            if (
                SassFileClassifier.matchesGlobPattern(
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

    static async isSassFileExcluded(
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
        const includeItems = Settings.getConfigSettings<string[] | null>(
            "includeItems",
            workspaceFolder,
        );
        const excludeItems = SassPathResolver.stripAnyLeadingSlashes(
            Settings.getConfigSettings<string[]>(
                "excludeList",
                workspaceFolder,
            ),
        );
        const partialsList = Settings.getConfigSettings<string[]>(
            "partialsList",
            workspaceFolder,
        );

        // Build include patterns list
        let includePatterns = ["**/*.s[ac]ss"];
        if (includeItems && includeItems.length) {
            includePatterns = SassPathResolver.stripAnyLeadingSlashes(
                includeItems.concat(partialsList),
            );
        }

        // Resolve effective workspace (handles forceBaseDirectory)
        const resolved =
            await WorkspacePathContext.resolveEffectiveBasePath(
                workspaceFolder,
            );
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
        const isIncluded = SassFileClassifier.matchesGlobPattern(
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
            const isExcluded = SassFileClassifier.matchesGlobPattern(
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

    /**
     * Tests if a file matches any of the given glob patterns using VS Code's built-in pattern matching.
     * Paths and patterns are normalized to lowercase for case-insensitive matching.
     */
    static matchesGlobPattern(
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
}
