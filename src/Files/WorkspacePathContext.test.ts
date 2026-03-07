import * as assert from "assert";
import * as vscode from "vscode";
import { WorkspacePathContext } from "./WorkspacePathContext";

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
