import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Waits for a file to appear, giving up once the time limit passes */
async function waitForFile(filePath: string, timeout = 8000): Promise<boolean> {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
        if (fs.existsSync(filePath)) {
            return true;
        }

        await sleep(100);
    }

    return false;
}

suite("AppModel — watching for changes", function () {
    this.timeout(20000);

    const fixtureName = "watch_fixture";

    let folder: vscode.WorkspaceFolder,
        fixturePath: string,
        outsidePath: string,
        compiledCss: string;

    function writeFixtureFile(file: string, content: string): void {
        fs.writeFileSync(path.join(fixturePath, file), content);
    }

    function setBaseDirectory(value: string | undefined) {
        return vscode.workspace
            .getConfiguration("liveSassCompile.settings", folder)
            .update(
                "forceBaseDirectory",
                value,
                vscode.ConfigurationTarget.WorkspaceFolder,
            );
    }

    suiteSetup(async () => {
        folder = vscode.workspace.workspaceFolders![0];
        fixturePath = path.join(folder.uri.fsPath, fixtureName);
        outsidePath = fs.mkdtempSync(path.join(os.tmpdir(), "live-sass-"));
        compiledCss = path.join(fixturePath, "src", "app.css");

        // Create the fixture without the extension reacting to it
        await vscode.commands.executeCommand(
            "liveSass.command.donotWatchMySass",
        );

        // The folders are created one level at a time, with a pause between.
        // On Linux, VS Code never reports changes inside a folder that was
        // created in the same instant as its parent
        fs.mkdirSync(fixturePath);
        await sleep(500);

        fs.mkdirSync(path.join(fixturePath, "src"));
        fs.mkdirSync(path.join(fixturePath, "build"));
        await sleep(500);

        writeFixtureFile("src/app.scss", '@use "part";\na { b: c }');
        writeFixtureFile("src/_part.scss", "d { e: f }");
        writeFixtureFile("build/main.scss", "g { h: i }");

        await setBaseDirectory(`/${fixtureName}/src`);

        // Let the events from the files above pass before watching
        await sleep(1000);

        await vscode.commands.executeCommand("liveSass.command.watchMySass");
    });

    suiteTeardown(async () => {
        // Stop watching so removing the fixture doesn't trigger a compile
        await vscode.commands.executeCommand(
            "liveSass.command.donotWatchMySass",
        );

        await setBaseDirectory(undefined);

        fs.rmSync(fixturePath, { recursive: true, force: true });
        fs.rmSync(outsidePath, { recursive: true, force: true });

        await sleep(1000);

        await vscode.commands.executeCommand("liveSass.command.watchMySass");
    });

    test("Files outside `forceBaseDirectory` don't trigger a compile", async () => {
        // What a build does: writes Sass files (and partials) elsewhere
        writeFixtureFile("build/_part.scss", "j { k: l }");
        writeFixtureFile("build/other.scss", "m { n: o }");

        await sleep(3000);

        assert.ok(
            !fs.existsSync(compiledCss),
            "A partial outside the base directory shouldn't compile the files inside it",
        );
        assert.ok(
            !fs.existsSync(path.join(fixturePath, "build", "other.css")),
            "A file outside the base directory shouldn't be compiled",
        );
    });

    test("A partial inside `forceBaseDirectory` triggers a compile", async () => {
        writeFixtureFile("src/_part.scss", "d { e: g }");

        assert.ok(
            await waitForFile(compiledCss),
            "Changing the partial should compile the file that uses it",
        );
    });

    test("A changed file is compiled whatever the casing of its extension", async () => {
        writeFixtureFile("src/Loud.SCSS", "p { q: r }");

        assert.ok(
            await waitForFile(path.join(fixturePath, "src", "Loud.css")),
            "A `.SCSS` file should be compiled when it changes",
        );
    });

    test("Saving a file compiles it, even when the file watcher misses the change", async () => {
        // On Linux, VS Code doesn't report changes in a folder that's created
        // at the same time as its parent. A save must still be picked up
        const deepPath = path.join(fixturePath, "src", "deep", "deeper"),
            sassPath = path.join(deepPath, "saved.scss");

        fs.mkdirSync(deepPath, { recursive: true });
        fs.writeFileSync(sassPath, "v { w: x }");

        // Remove the output if the file watcher did catch the new file
        await sleep(1500);
        fs.rmSync(path.join(deepPath, "saved.css"), { force: true });

        const editor = await vscode.window.showTextDocument(
            await vscode.workspace.openTextDocument(sassPath),
        );

        await editor.edit((edit) =>
            edit.insert(new vscode.Position(0, 0), "/* Changed */\n"),
        );

        assert.ok(await editor.document.save(), "Save failed");

        const wasCompiled = await waitForFile(path.join(deepPath, "saved.css"));

        await vscode.commands.executeCommand(
            "workbench.action.closeActiveEditor",
        );

        assert.ok(wasCompiled, "The saved file should have been compiled");
    });

    test("Saving a file that isn't in the workspace compiles it", async () => {
        const sassPath = path.join(outsidePath, "single.scss");

        fs.writeFileSync(sassPath, "s { t: u }");

        const editor = await vscode.window.showTextDocument(
            await vscode.workspace.openTextDocument(sassPath),
        );

        await editor.edit((edit) =>
            edit.insert(new vscode.Position(0, 0), "/* Changed */\n"),
        );

        assert.ok(await editor.document.save(), "Save failed");

        const wasCompiled = await waitForFile(
            path.join(outsidePath, "single.css"),
        );

        await vscode.commands.executeCommand(
            "workbench.action.closeActiveEditor",
        );

        assert.ok(wasCompiled, "The saved file should have been compiled");
    });
});
