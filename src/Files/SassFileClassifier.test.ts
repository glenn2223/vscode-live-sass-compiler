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
