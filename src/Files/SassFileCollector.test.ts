import * as assert from "assert";
import * as vscode from "vscode";
import { SassFileCollector } from "./SassFileCollector";

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
