import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
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

suite("SassFileCollector.getSassFiles — user settings", function () {
    this.timeout(10000);

    const fixtureName = "collector_fixture",
        changedSettings = new Set<string>();

    let folder: vscode.WorkspaceFolder, fixturePath: string;

    function config(section = "liveSassCompile.settings") {
        return vscode.workspace.getConfiguration(section, folder);
    }

    async function setSetting(
        key: string,
        value: unknown,
        section?: string,
    ): Promise<void> {
        changedSettings.add(`${section ?? ""}|${key}`);

        await config(section).update(
            key,
            value,
            vscode.ConfigurationTarget.WorkspaceFolder,
        );
    }

    /** The found files that are in the fixture, relative to the fixture */
    async function getFixtureFiles(): Promise<string[]> {
        return (await SassFileCollector.getSassFiles())
            .filter((file) => file.startsWith(fixturePath + path.sep))
            .map((file) => path.relative(fixturePath, file).replace(/\\/g, "/"))
            .sort();
    }

    suiteSetup(async () => {
        folder = vscode.workspace.workspaceFolders![0];
        fixturePath = path.join(folder.uri.fsPath, fixtureName);

        // Stop the extension compiling the fixture as it's created
        await vscode.commands.executeCommand(
            "liveSass.command.donotWatchMySass",
        );

        const files: Record<string, string> = {
            "src/app.scss": "a { b: c }",
            "src/_part.scss": "d { e: f }",
            "src/Upper.SCSS": "g { h: i }",
            "src/vendor/lib.scss": "j { k: l }",
            "src/plain.css": "m { n: o }",
            "src/notes.txt": "Not a Sass file",
            "build/main.scss": "p { q: r }",
            "build/_part.scss": "s { t: u }",
        };

        for (const file in files) {
            const fullPath = path.join(fixturePath, file);

            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, files[file]);
        }
    });

    teardown(async () => {
        for (const setting of changedSettings) {
            const [section, key] = setting.split("|");

            await config(section || undefined).update(
                key,
                undefined,
                vscode.ConfigurationTarget.WorkspaceFolder,
            );
        }

        changedSettings.clear();
    });

    suiteTeardown(async () => {
        fs.rmSync(fixturePath, { recursive: true, force: true });

        await vscode.commands.executeCommand("liveSass.command.watchMySass");
    });

    test("Finds every non-partial Sass file by default, whatever the extension casing", async () => {
        assert.deepEqual(await getFixtureFiles(), [
            "build/main.scss",
            "src/Upper.SCSS",
            "src/app.scss",
            "src/vendor/lib.scss",
        ]);
    });

    test("`forceBaseDirectory` limits the search to that folder", async () => {
        await setSetting("forceBaseDirectory", `/${fixtureName}/src`);

        // Nothing is filtered here: it's everything the collector returns
        assert.deepEqual((await SassFileCollector.getSassFiles()).sort(), [
            path.join(fixturePath, "src", "Upper.SCSS"),
            path.join(fixturePath, "src", "app.scss"),
            path.join(fixturePath, "src", "vendor", "lib.scss"),
        ]);
    });

    test("A broad `includeItems` pattern only returns Sass files", async () => {
        await setSetting("includeItems", [`/${fixtureName}/src/**`]);

        assert.deepEqual(await getFixtureFiles(), [
            "src/Upper.SCSS",
            "src/app.scss",
            "src/vendor/lib.scss",
        ]);
    });

    test("Multiple `includeItems` patterns can contain braces", async () => {
        await setSetting("includeItems", [
            `/${fixtureName}/src/*.{scss,sass}`,
            `/${fixtureName}/build/main.scss`,
        ]);

        assert.deepEqual(await getFixtureFiles(), [
            "build/main.scss",
            "src/Upper.SCSS",
            "src/app.scss",
        ]);
    });

    test("`excludeList` supports extglobs", async () => {
        await setSetting("excludeList", [`/${fixtureName}/**/!(app).scss`]);

        assert.deepEqual(await getFixtureFiles(), ["src/app.scss"]);
    });

    test("`excludeList` is case-insensitive", async () => {
        await setSetting("excludeList", [
            `/${fixtureName.toUpperCase()}/SRC/Vendor/**`,
        ]);

        assert.deepEqual(await getFixtureFiles(), [
            "build/main.scss",
            "src/Upper.SCSS",
            "src/app.scss",
        ]);
    });

    test("`partialsList` patterns are left out", async () => {
        await setSetting("partialsList", [
            "/**/_*.s[ac]ss",
            `/${fixtureName}/src/vendor/**`,
        ]);

        assert.deepEqual(await getFixtureFiles(), [
            "build/main.scss",
            "src/Upper.SCSS",
            "src/app.scss",
        ]);
    });

    test("The `files.exclude` setting doesn't hide files from the compiler", async () => {
        await setSetting(
            "exclude",
            { [`**/${fixtureName}/src/vendor`]: true },
            "files",
        );

        assert.deepEqual(await getFixtureFiles(), [
            "build/main.scss",
            "src/Upper.SCSS",
            "src/app.scss",
            "src/vendor/lib.scss",
        ]);
    });
});
