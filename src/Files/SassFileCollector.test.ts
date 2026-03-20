import * as assert from "assert";
import * as vscode from "vscode";
import { SassFileCollector } from "./SassFileCollector";

suite("SassFileCollector.buildIncludeGlob", function () {
    test("Returns default glob when no patterns provided", () => {
        assert.equal(
            SassFileCollector.buildIncludeGlob(undefined),
            "**/*.s[ac]ss",
        );
    });

    test("Returns default glob for empty array", () => {
        assert.equal(SassFileCollector.buildIncludeGlob([]), "**/*.s[ac]ss");
    });

    test("Returns pattern as-is for single item", () => {
        assert.equal(
            SassFileCollector.buildIncludeGlob(["src/**/*.scss"]),
            "src/**/*.scss",
        );
    });

    test("Wraps multiple patterns in brace syntax", () => {
        assert.equal(
            SassFileCollector.buildIncludeGlob([
                "src/**/*.scss",
                "lib/**/*.sass",
            ]),
            "{src/**/*.scss,lib/**/*.sass}",
        );
    });

    test("Wraps three or more patterns in brace syntax", () => {
        assert.equal(
            SassFileCollector.buildIncludeGlob([
                "a/**/*.scss",
                "b/**/*.scss",
                "c/**/*.scss",
            ]),
            "{a/**/*.scss,b/**/*.scss,c/**/*.scss}",
        );
    });
});

suite(
    "SassFileCollector.buildIncludeGlob — findFiles integration",
    function () {
        // These two patterns target files in different directories of the sample workspace:
        //   "alias_test.scss"  → root-level file
        //   "css/**/*.scss"    → file inside the css/ subdirectory
        // Together they exercise the multi-pattern case that was previously broken.
        const patterns = ["alias_test.scss", "css/**/*.scss"];

        test("Brace-wrapped glob (fixed behaviour) matches files from both patterns", async () => {
            const folder = vscode.workspace.workspaceFolders?.[0];
            if (!folder) {
                return;
            }

            // What the fix produces: wrap multiple patterns in {a,b} brace syntax
            const fixedGlob = SassFileCollector.buildIncludeGlob(patterns);
            assert.strictEqual(fixedGlob, `{${patterns.join(",")}}`);

            const found = await vscode.workspace.findFiles(
                new vscode.RelativePattern(folder, fixedGlob),
            );

            const paths = found.map((f) => f.fsPath.replace(/\\/g, "/"));

            assert.ok(
                paths.some((p) => p.endsWith("alias_test.scss")),
                "Should find alias_test.scss via first pattern",
            );
            assert.ok(
                paths.some((p) => p.endsWith("css/sample.scss")),
                "Should find css/sample.scss via second pattern",
            );
        });
    },
);

suite("SassFileCollector.getSassFiles", function () {
    test("Returns an array", async () => {
        const result = await SassFileCollector.getSassFiles();
        assert.ok(Array.isArray(result), "Should return an array");
    });

    test("Found files have .scss or .sass extensions", async () => {
        const result = await SassFileCollector.getSassFiles();

        result.forEach((file) => {
            const lower = file.toLowerCase();
            assert.ok(
                lower.endsWith(".scss") || lower.endsWith(".sass"),
                `File should be .scss or .sass: ${file}`,
            );
        });
    });

    test("Returns files when given specific workspace folder", async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const result = await SassFileCollector.getSassFiles(
            undefined,
            false,
            workspaceFolder,
        );
        assert.ok(Array.isArray(result));
    });

    test("Returns files when debugging (reduced exclusions)", async () => {
        const result = await SassFileCollector.getSassFiles(undefined, true);
        assert.ok(Array.isArray(result));
    });

    test("Accepts custom query pattern", async () => {
        const result = await SassFileCollector.getSassFiles(
            ["**/*.scss"],
            false,
        );
        assert.ok(Array.isArray(result));

        result.forEach((file) => {
            assert.ok(
                file.toLowerCase().endsWith(".scss"),
                `File should be .scss: ${file}`,
            );
        });
    });
});
