import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import { WorkspacePathContext } from "./WorkspacePathContext";
import { WorkspaceSettings } from "../test/workspaceSettings";

suite("WorkspacePathContext.getWorkspaceFolder", function () {
    test("Returns workspace folder for file in workspace", () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const filePath = vscode.Uri.joinPath(
            workspaceFolder.uri,
            "src",
            "appModel.ts",
        ).fsPath;

        const result = WorkspacePathContext.getWorkspaceFolder(filePath);

        assert.ok(result, "Should find a workspace folder");
        assert.equal(result!.name, workspaceFolder.name);
    });

    test("Returns undefined for file outside workspace", () => {
        const result = WorkspacePathContext.getWorkspaceFolder(
            "/nonexistent/path/file.scss",
            true,
        );

        assert.equal(result, undefined);
    });

    test("Suppressed output does not throw", () => {
        assert.doesNotThrow(() => {
            WorkspacePathContext.getWorkspaceFolder(
                "/outside/workspace/file.scss",
                true,
            );
        });
    });

    test("Non-suppressed output does not throw for sass files outside workspace", () => {
        assert.doesNotThrow(() => {
            WorkspacePathContext.getWorkspaceFolder(
                "/outside/workspace/file.scss",
                false,
            );
        });
    });
});

suite("WorkspacePathContext.resolveEffectiveBasePath", function () {
    test("Returns workspace folder path when no forceBaseDirectory", async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const result =
            await WorkspacePathContext.resolveEffectiveBasePath(
                workspaceFolder,
            );

        assert.ok(result, "Should return a result");
        assert.equal(result!.basePath, workspaceFolder.uri.fsPath);
        assert.equal(result!.effectiveFolder.name, workspaceFolder.name);
    });
});

suite("WorkspacePathContext — `forceBaseDirectory`", function () {
    const settings = new WorkspaceSettings();

    let root: string;

    suiteSetup(() => (root = settings.folder.uri.fsPath));

    teardown(() => settings.reset());

    test("getForcedBasePath is null when the setting isn't in use", () => {
        assert.strictEqual(
            WorkspacePathContext.getForcedBasePath(settings.folder),
            null,
        );
    });

    test("getForcedBasePath resolves the setting from the workspace folder", async () => {
        await settings.set("forceBaseDirectory", "/css");

        assert.equal(
            WorkspacePathContext.getForcedBasePath(settings.folder),
            path.join(root, "css"),
        );
    });

    test("getPatternFolder is the workspace folder when the setting isn't in use", () => {
        assert.strictEqual(
            WorkspacePathContext.getPatternFolder(
                path.join(root, "css", "sample.scss"),
                settings.folder,
            ),
            settings.folder,
        );
    });

    test("getPatternFolder is the base directory for a file inside it", async () => {
        await settings.set("forceBaseDirectory", "/css");

        const result = WorkspacePathContext.getPatternFolder(
            path.join(root, "css", "nested", "sample.scss"),
            settings.folder,
        );

        assert.equal(result.uri.fsPath, path.join(root, "css"));
        assert.equal(result.name, settings.folder.name);
    });

    test("getPatternFolder is the workspace folder for a file outside the base directory", async () => {
        await settings.set("forceBaseDirectory", "/css");

        [
            path.join(root, "alias_test.scss"),
            // Starts with the same characters, but isn't inside
            path.join(root, "css-other", "sample.scss"),
        ].forEach((file) =>
            assert.strictEqual(
                WorkspacePathContext.getPatternFolder(file, settings.folder),
                settings.folder,
                file,
            ),
        );
    });
});
