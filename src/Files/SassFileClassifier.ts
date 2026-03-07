import * as path from "path";
import * as vscode from "vscode";
import picomatch from "picomatch";

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
     * Tests if a file matches any of the given glob patterns using picomatch.
     * Supports full picomatch syntax: globs, extglobs, character classes, brace
     * expansion, and negation patterns. Paths and patterns are normalized to
     * lowercase for case-insensitive matching.
     *
     * When a workspace folder is provided the file path is made relative to the
     * workspace root before matching, so directory-based patterns work correctly.
     */
    static matchesGlobPattern(
        patterns: string[],
        fileOrPath: vscode.TextDocument | string,
        workspaceFolder?: vscode.WorkspaceFolder,
    ): boolean {
        if (patterns.length === 0) {
            return false;
        }

        const filePath =
            typeof fileOrPath === "string" ? fileOrPath : fileOrPath.uri.fsPath;

        // Normalize patterns to forward slashes and lowercase for cross-platform matching
        const normalizedPatterns = patterns.map((p) =>
            p.replace(/\\/g, "/").toLowerCase(),
        );

        // When a workspace is known, match against the relative path so that
        // patterns like `**/node_modules/**` and `.vscode/**` work correctly.
        const matchPath = workspaceFolder
            ? path
                  .relative(workspaceFolder.uri.fsPath, filePath)
                  .replace(/\\/g, "/")
                  .toLowerCase()
            : filePath.replace(/\\/g, "/").toLowerCase();

        return picomatch.isMatch(matchPath, normalizedPatterns, { dot: true });
    }
}
