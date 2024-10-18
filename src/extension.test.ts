import * as assert from "assert";
import * as vscode from "vscode";

suite("Extension Tests", function () {
    const ext = vscode.extensions.getExtension("glenn2223.live-sass");

    test("Is present", () => {
        assert.ok(ext);
    });

    test("Is active", () => {
        assert.ok(ext?.isActive);
    });

    test("All live sass commands registered", async () => {
        const expectedCommands = [
                "liveSass.command.watchMySass",
                "liveSass.command.donotWatchMySass",
                "liveSass.command.compileCurrentSass",
                "liveSass.command.oneTimeCompileSass",
                "liveSass.command.openOutputWindow",
                "liveSass.command.createIssue",
                "liveSass.command.debugInclusion",
                "liveSass.command.debugFileList",
                "liveSass.command.showOutputOn.trace",
                "liveSass.command.showOutputOn.debug",
                "liveSass.command.showOutputOn.information",
                "liveSass.command.showOutputOn.warning",
                "liveSass.command.showOutputOn.error",
                "liveSass.command.showOutputOn.none",
            ],
            actualCommands = await vscode.commands.getCommands(true);
        const foundLiveServerCommands = actualCommands.filter((value) => {
            return (
                expectedCommands.indexOf(value) >= 0 ||
                value.startsWith("liveSass.command.")
            );
        });

        assert.deepEqual(
            foundLiveServerCommands.sort(),
            expectedCommands.sort()
        );
    });

    test("VS Code save generates files", async () => {
        const expectedFiles = [
                vscode.Uri.file("css/sample.scss"),
                vscode.Uri.file("css/sample.css.map"),
                vscode.Uri.file("css/sample.css"),
            ].map((file) =>
                vscode.Uri.joinPath(
                    vscode.workspace.workspaceFolders![0].uri,
                    file.path
                ).path.toLowerCase()
            ),
            // Open a file
            doc = await vscode.window.showTextDocument(
                (
                    await vscode.workspace.findFiles("css/**")
                )[0]
            );

        doc.edit((edit) => {
            edit.insert(new vscode.Position(2, 1), " ");
        });

        // Save the file
        if (!(await doc.document.save())) {
            assert.ok(false, "Save failed");
        }

        // Wait .2 seconds to allow save success
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Get the folders files
        const actualFiles = (await vscode.workspace.findFiles("css/**")).map(
            (file) => file.path.toLowerCase()
        );

        assert.deepEqual(actualFiles.sort(), expectedFiles.sort());

        // Revert change
        await doc.edit((edit) =>
            edit.replace(new vscode.Range(2, 0, 2, 2), "}")
        );

        await doc.document.save();
    });
});
