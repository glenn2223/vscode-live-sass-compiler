import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import { SassPathResolver } from "./SassPathResolver";

suite("SassPathResolver.stripLeadingSlash", function () {
    test("Strips leading forward slash", () => {
        assert.equal(SassPathResolver.stripLeadingSlash("/foo/bar"), "foo/bar");
    });

    test("Strips leading backslash", () => {
        assert.equal(
            SassPathResolver.stripLeadingSlash("\\foo\\bar"),
            "foo\\bar",
        );
    });

    test("Returns unchanged when no leading slash", () => {
        assert.equal(SassPathResolver.stripLeadingSlash("foo/bar"), "foo/bar");
    });

    test("Returns empty string unchanged", () => {
        assert.equal(SassPathResolver.stripLeadingSlash(""), "");
    });

    test("Single slash returns empty string", () => {
        assert.equal(SassPathResolver.stripLeadingSlash("/"), "");
    });
});

suite("SassPathResolver.stripAnyLeadingSlashes", function () {
    test("Strips slashes from all items", () => {
        const input = ["/foo", "\\bar", "baz"];
        const result = SassPathResolver.stripAnyLeadingSlashes(input);

        assert.deepStrictEqual(result, ["foo", "bar", "baz"]);
    });

    test("Returns empty array for null input", () => {
        assert.deepStrictEqual(
            SassPathResolver.stripAnyLeadingSlashes(null),
            [],
        );
    });

    test("Returns empty array for empty input", () => {
        assert.deepStrictEqual(SassPathResolver.stripAnyLeadingSlashes([]), []);
    });
});

suite("SassPathResolver.generateCssAndMapUri", function () {
    test("Generates CSS and map paths from SASS path without workspace", () => {
        const result = SassPathResolver.generateCssAndMapUri(
            "/project/styles/main.scss",
            { format: "expanded", extensionName: ".css" },
        );

        assert.ok(result);
        assert.equal(result.css, "/project/styles/main.css");
        assert.equal(result.map, "/project/styles/main.css.map");
    });

    test("Uses custom extension name", () => {
        const result = SassPathResolver.generateCssAndMapUri(
            "/project/styles/main.scss",
            { format: "compressed", extensionName: ".min.css" },
        );

        assert.ok(result);
        assert.equal(result.css, "/project/styles/main.min.css");
        assert.equal(result.map, "/project/styles/main.min.css.map");
    });

    test("Defaults to .css when extensionName is empty", () => {
        const result = SassPathResolver.generateCssAndMapUri(
            "/project/styles/main.scss",
            { format: "expanded", extensionName: "" },
        );

        assert.ok(result);
        assert.ok(result.css.endsWith(".css"));
    });

    test("Generates CSS and map paths with workspace and savePath", () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const sassPath = path.join(
            workspaceFolder.uri.fsPath,
            "src",
            "test",
            "sample",
            "css",
            "sample.scss",
        );

        const result = SassPathResolver.generateCssAndMapUri(
            sassPath,
            {
                format: "expanded",
                extensionName: ".css",
                savePath: "/out/css",
            },
            workspaceFolder,
        );

        assert.ok(result);
        assert.ok(result.css.includes("out"));
        assert.ok(result.css.includes("css"));
        assert.ok(result.css.endsWith(".css"));
    });

    test("Savepath with tilde is relative to file", () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const sassPath = path.join(
            workspaceFolder.uri.fsPath,
            "src",
            "test",
            "sample",
            "css",
            "sample.scss",
        );

        const result = SassPathResolver.generateCssAndMapUri(
            sassPath,
            {
                format: "expanded",
                extensionName: ".css",
                savePath: "~/../dist",
            },
            workspaceFolder,
        );

        assert.ok(result);
        assert.ok(result.css.includes("dist"));
    });

    test("Returns null on invalid savePathReplacementPairs value type", () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const sassPath = path.join(
            workspaceFolder.uri.fsPath,
            "src",
            "test",
            "sample",
            "css",
            "sample.scss",
        );

        const result = SassPathResolver.generateCssAndMapUri(
            sassPath,
            {
                format: "expanded",
                extensionName: ".css",
                savePathReplacementPairs: { "/src/": 42 as unknown },
            },
            workspaceFolder,
        );

        assert.equal(result, null);
    });
});
