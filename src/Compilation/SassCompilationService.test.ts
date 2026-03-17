import * as assert from "assert";
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

import { SassCompilationService } from "./SassCompilationService";

suite("SassCompilationService mapsIncludeSources Tests", function () {
    const config = () =>
        vscode.workspace.getConfiguration("liveSassCompile.settings");

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    const sassPath = path.resolve(
        __dirname,
        "../../src/test/sample/css/sample.scss",
    );
    const mapPath = path.resolve(
        __dirname,
        "../../src/test/sample/css/sample.css.map",
    );

    teardown(async () => {
        await config().update("mapsIncludeSources", undefined);
        await config().update("formats", undefined);
        if (fs.existsSync(mapPath)) {
            fs.unlinkSync(mapPath);
        }
    });

    test("global mapsIncludeSources=false is used when format has no override", async () => {
        await config().update("mapsIncludeSources", false);
        await config().update("formats", [
            { format: "expanded", extensionName: ".css", generateMap: true },
        ]);

        const results = await SassCompilationService.processSingleFile(
            workspaceFolder,
            sassPath,
        );

        assert.ok(results.every(Boolean), "compilation should succeed");
        assert.ok(fs.existsSync(mapPath), "map file should exist");

        const mapJson = JSON.parse(fs.readFileSync(mapPath, "utf8"));
        assert.ok(
            !mapJson.sourcesContent,
            "sourcesContent should be absent when global mapsIncludeSources is false",
        );
    });

    test("global mapsIncludeSources=true is used when format has no override", async () => {
        await config().update("mapsIncludeSources", true);
        await config().update("formats", [
            { format: "expanded", extensionName: ".css", generateMap: true },
        ]);

        const results = await SassCompilationService.processSingleFile(
            workspaceFolder,
            sassPath,
        );

        assert.ok(results.every(Boolean), "compilation should succeed");
        assert.ok(fs.existsSync(mapPath), "map file should exist");

        const mapJson = JSON.parse(fs.readFileSync(mapPath, "utf8"));
        assert.ok(
            Array.isArray(mapJson.sourcesContent) &&
                mapJson.sourcesContent.length > 0,
            "sourcesContent should be present when global mapsIncludeSources is true",
        );
    });

    test("per-format mapsIncludeSources=true overrides global false", async () => {
        await config().update("mapsIncludeSources", false);
        await config().update("formats", [
            {
                format: "expanded",
                extensionName: ".css",
                generateMap: true,
                mapsIncludeSources: true,
            },
        ]);

        const results = await SassCompilationService.processSingleFile(
            workspaceFolder,
            sassPath,
        );

        assert.ok(results.every(Boolean), "compilation should succeed");
        assert.ok(fs.existsSync(mapPath), "map file should exist");

        const mapJson = JSON.parse(fs.readFileSync(mapPath, "utf8"));
        assert.ok(
            Array.isArray(mapJson.sourcesContent) &&
                mapJson.sourcesContent.length > 0,
            "sourcesContent should be present when per-format overrides to true",
        );
    });

    test("per-format mapsIncludeSources=false overrides global true", async () => {
        await config().update("mapsIncludeSources", true);
        await config().update("formats", [
            {
                format: "expanded",
                extensionName: ".css",
                generateMap: true,
                mapsIncludeSources: false,
            },
        ]);

        const results = await SassCompilationService.processSingleFile(
            workspaceFolder,
            sassPath,
        );

        assert.ok(results.every(Boolean), "compilation should succeed");
        assert.ok(fs.existsSync(mapPath), "map file should exist");

        const mapJson = JSON.parse(fs.readFileSync(mapPath, "utf8"));
        assert.ok(
            !mapJson.sourcesContent,
            "sourcesContent should be absent when per-format overrides to false",
        );
    });
});
