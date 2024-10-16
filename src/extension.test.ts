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

        console.log(
            "First SCSS:",
            (await vscode.workspace.findFiles("css/**"))[0]
        );
        console.log("Doc:", doc);

        // Save the file
        if (!(await doc.document.save())) {
            assert.ok(false, "Save failed");
        }

        // Wait for 1 second to allow the file system to update
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Get the folders files
        const actualFiles = (await vscode.workspace.findFiles("css/**")).map(
            (file) => file.path.toLowerCase()
        );

        assert.deepEqual(actualFiles.sort(), expectedFiles.sort());
    });
});
