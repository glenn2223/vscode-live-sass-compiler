import * as assert from "assert";
import * as vscode from "vscode";
import { SassFileClassifier } from "./SassFileClassifier";
import { SassConfirmationType } from "../Enums/SassConfirmationType";

suite("SassFileClassifier.confirmSassType", function () {
    test("Returns SassFile for .scss file", () => {
        const result = SassFileClassifier.confirmSassType("/project/main.scss");
        assert.equal(result, SassConfirmationType.SassFile);
    });

    test("Returns SassFile for .sass file", () => {
        const result = SassFileClassifier.confirmSassType("/project/main.sass");
        assert.equal(result, SassConfirmationType.SassFile);
    });

    test("Returns PartialFile for _partial.scss (no workspace)", () => {
        const result = SassFileClassifier.confirmSassType(
            "/project/_partial.scss",
        );
        assert.equal(result, SassConfirmationType.PartialFile);
    });

    test("Returns PartialFile for _partial.sass (no workspace)", () => {
        const result = SassFileClassifier.confirmSassType(
            "/project/_partial.sass",
        );
        assert.equal(result, SassConfirmationType.PartialFile);
    });

    test("Returns NotSass for .css file", () => {
        const result = SassFileClassifier.confirmSassType("/project/style.css");
        assert.equal(result, SassConfirmationType.NotSass);
    });

    test("Returns NotSass for .ts file", () => {
        const result = SassFileClassifier.confirmSassType("/project/app.ts");
        assert.equal(result, SassConfirmationType.NotSass);
    });

    test("Returns NotSass for .js file", () => {
        const result = SassFileClassifier.confirmSassType("/project/app.js");
        assert.equal(result, SassConfirmationType.NotSass);
    });

    test("Returns NotSass for empty string", () => {
        const result = SassFileClassifier.confirmSassType("");
        assert.equal(result, SassConfirmationType.NotSass);
    });

    test("Case insensitive for SCSS extension", () => {
        // basename will be "Main.SCSS" which ends in "scss" after toLowerCase
        const result = SassFileClassifier.confirmSassType("/project/Main.SCSS");
        assert.equal(result, SassConfirmationType.SassFile);
    });

    test("Case insensitive for SASS extension", () => {
        const result = SassFileClassifier.confirmSassType("/project/Main.SASS");
        assert.equal(result, SassConfirmationType.SassFile);
    });

    test("With workspace folder, non-partial SASS is SassFile", () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const result = SassFileClassifier.confirmSassType(
            "/project/main.scss",
            workspaceFolder,
        );
        assert.equal(result, SassConfirmationType.SassFile);
    });
});

suite("SassFileClassifier.isSassFileExcluded", function () {
    test("Partial file is excluded when no workspace", async () => {
        const result = await SassFileClassifier.isSassFileExcluded(
            "/project/_vars.scss",
        );
        assert.equal(result, true);
    });

    test("Non-sass file is excluded when no workspace", async () => {
        const result =
            await SassFileClassifier.isSassFileExcluded("/project/style.css");
        assert.equal(result, true);
    });

    test("SCSS file is not excluded when no workspace", async () => {
        const result =
            await SassFileClassifier.isSassFileExcluded("/project/main.scss");
        assert.equal(result, false);
    });

    test("SASS file is not excluded when no workspace", async () => {
        const result =
            await SassFileClassifier.isSassFileExcluded("/project/main.sass");
        assert.equal(result, false);
    });
});

suite("SassFileClassifier.matchesGlobPattern", function () {
    test("Returns false for empty patterns", () => {
        assert.equal(
            SassFileClassifier.matchesGlobPattern([], "/project/main.scss"),
            false,
        );
    });

    test("Matches a SCSS glob pattern", () => {
        const result = SassFileClassifier.matchesGlobPattern(
            ["**/*.scss"],
            "/project/main.scss",
        );
        assert.equal(result, true);
    });

    test("Does not match wrong extension", () => {
        const result = SassFileClassifier.matchesGlobPattern(
            ["**/*.css"],
            "/project/main.scss",
        );
        assert.equal(result, false);
    });

    test("Matches combined sass/scss pattern", () => {
        const result = SassFileClassifier.matchesGlobPattern(
            ["**/*.s[ac]ss"],
            "/project/main.sass",
        );
        assert.equal(result, true);
    });

    test("Matches with workspace folder", () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const filePath = vscode.Uri.joinPath(
            workspaceFolder.uri,
            "src",
            "test",
            "sample",
            "css",
            "sample.scss",
        ).fsPath;

        const result = SassFileClassifier.matchesGlobPattern(
            ["**/*.scss"],
            filePath,
            workspaceFolder,
        );
        assert.equal(result, true);
    });

    test("Excludes partial with underscore pattern", () => {
        const result = SassFileClassifier.matchesGlobPattern(
            ["**/_*.scss"],
            "/project/_partial.scss",
        );
        assert.equal(result, true);
    });
});

suite(
    "SassFileClassifier.matchesGlobPattern (picomatch features)",
    function () {
        // --- Brace expansion ---
        test("Brace expansion {scss,sass} matches .scss", () => {
            assert.equal(
                SassFileClassifier.matchesGlobPattern(
                    ["**/*.{scss,sass}"],
                    "/project/main.scss",
                ),
                true,
            );
        });

        test("Brace expansion {scss,sass} matches .sass", () => {
            assert.equal(
                SassFileClassifier.matchesGlobPattern(
                    ["**/*.{scss,sass}"],
                    "/project/main.sass",
                ),
                true,
            );
        });

        test("Brace expansion {scss,sass} does not match .css", () => {
            assert.equal(
                SassFileClassifier.matchesGlobPattern(
                    ["**/*.{scss,sass}"],
                    "/project/main.css",
                ),
                false,
            );
        });

        // --- Extglob @() - match exactly one of the alternatives ---
        test("Extglob @(scss|sass) matches .scss", () => {
            assert.equal(
                SassFileClassifier.matchesGlobPattern(
                    ["**/*.@(scss|sass)"],
                    "/project/main.scss",
                ),
                true,
            );
        });

        test("Extglob @(scss|sass) matches .sass", () => {
            assert.equal(
                SassFileClassifier.matchesGlobPattern(
                    ["**/*.@(scss|sass)"],
                    "/project/main.sass",
                ),
                true,
            );
        });

        test("Extglob @(scss|sass) does not match .css", () => {
            assert.equal(
                SassFileClassifier.matchesGlobPattern(
                    ["**/*.@(scss|sass)"],
                    "/project/main.css",
                ),
                false,
            );
        });

        // --- Extglob ?() - zero or one occurrence ---
        test("Extglob ?(theme-) matches zero occurrences (filename without prefix)", () => {
            assert.equal(
                SassFileClassifier.matchesGlobPattern(
                    ["**/?(theme-)main.scss"],
                    "/project/main.scss",
                ),
                true,
            );
        });

        test("Extglob ?(theme-) matches one occurrence (filename with prefix)", () => {
            assert.equal(
                SassFileClassifier.matchesGlobPattern(
                    ["**/?(theme-)main.scss"],
                    "/project/theme-main.scss",
                ),
                true,
            );
        });

        test("Extglob ?(theme-) does not match two occurrences", () => {
            assert.equal(
                SassFileClassifier.matchesGlobPattern(
                    ["**/?(theme-)main.scss"],
                    "/project/theme-theme-main.scss",
                ),
                false,
            );
        });

        // --- Extglob +() - one or more occurrences ---
        test("Extglob +(base|theme) matches a single listed alternative", () => {
            assert.equal(
                SassFileClassifier.matchesGlobPattern(
                    ["**/+(base|theme).scss"],
                    "/project/base.scss",
                ),
                true,
            );
        });

        test("Extglob +(base|theme) matches multiple concatenated repetitions", () => {
            assert.equal(
                SassFileClassifier.matchesGlobPattern(
                    ["**/+(base|theme).scss"],
                    "/project/basetheme.scss",
                ),
                true,
            );
        });

        test("Extglob +(base|theme) does not match an unlisted value", () => {
            assert.equal(
                SassFileClassifier.matchesGlobPattern(
                    ["**/+(base|theme).scss"],
                    "/project/other.scss",
                ),
                false,
            );
        });

        // --- Extglob *() - zero or more occurrences ---
        test("Extglob *(my-) matches zero occurrences", () => {
            assert.equal(
                SassFileClassifier.matchesGlobPattern(
                    ["**/*(my-)styles.scss"],
                    "/project/styles.scss",
                ),
                true,
            );
        });

        test("Extglob *(my-) matches one occurrence", () => {
            assert.equal(
                SassFileClassifier.matchesGlobPattern(
                    ["**/*(my-)styles.scss"],
                    "/project/my-styles.scss",
                ),
                true,
            );
        });

        test("Extglob *(my-) does not match an unrelated prefix", () => {
            assert.equal(
                SassFileClassifier.matchesGlobPattern(
                    ["**/*(my-)styles.scss"],
                    "/project/their-styles.scss",
                ),
                false,
            );
        });

        // --- Extglob !() - match anything except the pattern ---
        test("Extglob !(vendor) matches a non-excluded directory", () => {
            assert.equal(
                SassFileClassifier.matchesGlobPattern(
                    ["**/!(vendor)/*.scss"],
                    "/project/src/main.scss",
                ),
                true,
            );
        });

        test("Extglob !(vendor) does not match the excluded directory", () => {
            assert.equal(
                SassFileClassifier.matchesGlobPattern(
                    ["**/!(vendor)/*.scss"],
                    "/project/vendor/main.scss",
                ),
                false,
            );
        });

        // --- Negation patterns in the array ---
        test("Negation !pattern still matches files that do not trigger the negation", () => {
            assert.equal(
                SassFileClassifier.matchesGlobPattern(
                    ["**/*.scss", "!**/vendor/**"],
                    "/project/src/main.scss",
                ),
                true,
            );
        });

        test("Negation !pattern excludes files that match the negated pattern", () => {
            assert.equal(
                SassFileClassifier.matchesGlobPattern(
                    ["**/*.scss", "!**/vendor/**"],
                    "/project/vendor/main.scss",
                ),
                false,
            );
        });

        test("Negation !pattern excludes partial files when combined with a positive pattern", () => {
            assert.equal(
                SassFileClassifier.matchesGlobPattern(
                    ["**/*.scss", "!**/_*.scss"],
                    "/project/_partial.scss",
                ),
                false,
            );
        });

        test("Negation with positive pattern still matches non-negated files", () => {
            assert.equal(
                SassFileClassifier.matchesGlobPattern(
                    ["**/*.scss", "!**/_*.scss"],
                    "/project/main.scss",
                ),
                true,
            );
        });

        // --- Dot-directory matching ---
        test("Dot-directory pattern matches a file inside a dot directory (with workspace)", () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return;
            }
            const filePath = vscode.Uri.joinPath(
                workspaceFolder.uri,
                ".vscode",
                "main.scss",
            ).fsPath;
            assert.equal(
                SassFileClassifier.matchesGlobPattern(
                    [".vscode/**"],
                    filePath,
                    workspaceFolder,
                ),
                true,
            );
        });
    },
);
