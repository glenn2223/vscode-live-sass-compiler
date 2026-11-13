import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

import { SassConfirmationType } from "./Enums/SassConfirmationType";
import { SassFileClassifier } from "./Files/SassFileClassifier";
import { SassFileCollector } from "./Files/SassFileCollector";
import {
    WorkspaceSettings,
    listFiles,
    writeFiles,
} from "./test/workspaceSettings";

/*
 * These tests describe what the settings are designed to do, alone and
 * combined, in terms a user would recognise: which files get compiled, which
 * files recompile everything when they change, and where the output is saved.
 */

suite("Settings — which files are compiled", function () {
    this.timeout(10000);

    const fixtureName = "settings_fixture",
        base = `/${fixtureName}`,
        settings = new WorkspaceSettings();

    let fixturePath: string;

    const sassFiles = [
        "_base.scss",
        "dist/_built-part.scss",
        "dist/built.scss",
        "main.scss",
        "styles/_mixins.scss",
        "styles/admin/_vars.sass",
        "styles/admin/admin.sass",
        "styles/partials/buttons.scss",
        "styles/site.scss",
        "vendor/_lib-part.scss",
        "vendor/lib.scss",
    ];

    interface IScenario {
        name: string;
        settings: Record<string, unknown>;
        /** Compiled by "compile all", and compiled singly when changed */
        compiled: string[];
        /** Recompile everything when changed */
        partials: string[];
    }

    const scenarios: IScenario[] = [
        {
            name: "Default settings",
            settings: {},
            compiled: [
                "dist/built.scss",
                "main.scss",
                "styles/admin/admin.sass",
                "styles/partials/buttons.scss",
                "styles/site.scss",
                "vendor/lib.scss",
            ],
            partials: [
                "_base.scss",
                "dist/_built-part.scss",
                "styles/_mixins.scss",
                "styles/admin/_vars.sass",
                "vendor/_lib-part.scss",
            ],
        },
        {
            name: "`forceBaseDirectory`",
            settings: { forceBaseDirectory: `${base}/styles` },
            compiled: [
                "styles/admin/admin.sass",
                "styles/partials/buttons.scss",
                "styles/site.scss",
            ],
            partials: ["styles/_mixins.scss", "styles/admin/_vars.sass"],
        },
        {
            name: "`excludeList`",
            settings: {
                excludeList: [`${base}/vendor/**`, `${base}/dist/**`],
            },
            compiled: [
                "main.scss",
                "styles/admin/admin.sass",
                "styles/partials/buttons.scss",
                "styles/site.scss",
            ],
            partials: [
                "_base.scss",
                "styles/_mixins.scss",
                "styles/admin/_vars.sass",
            ],
        },
        {
            name: "`includeItems`",
            settings: {
                includeItems: [`${base}/main.scss`, `${base}/styles/site.scss`],
            },
            compiled: ["main.scss", "styles/site.scss"],
            // There's no need to include partials for them to work
            partials: [
                "_base.scss",
                "dist/_built-part.scss",
                "styles/_mixins.scss",
                "styles/admin/_vars.sass",
                "vendor/_lib-part.scss",
            ],
        },
        {
            name: "`partialsList` with a folder of partials",
            settings: {
                partialsList: ["/**/_*.s[ac]ss", `${base}/styles/partials/**`],
            },
            compiled: [
                "dist/built.scss",
                "main.scss",
                "styles/admin/admin.sass",
                "styles/site.scss",
                "vendor/lib.scss",
            ],
            partials: [
                "_base.scss",
                "dist/_built-part.scss",
                "styles/_mixins.scss",
                "styles/admin/_vars.sass",
                "styles/partials/buttons.scss",
                "vendor/_lib-part.scss",
            ],
        },
        {
            name: "`includeItems` + `excludeList`",
            settings: {
                includeItems: [`${base}/styles/**/*.scss`, `${base}/main.scss`],
                excludeList: [`${base}/styles/partials/**`, `${base}/dist/**`],
            },
            compiled: ["main.scss", "styles/site.scss"],
            partials: [
                "_base.scss",
                "styles/_mixins.scss",
                "styles/admin/_vars.sass",
                "vendor/_lib-part.scss",
            ],
        },
        {
            // `excludeList` is relative to the base directory
            name: "`forceBaseDirectory` + `excludeList`",
            settings: {
                forceBaseDirectory: `${base}/styles`,
                excludeList: ["/admin/**"],
            },
            compiled: ["styles/partials/buttons.scss", "styles/site.scss"],
            partials: ["styles/_mixins.scss"],
        },
        {
            // `includeItems` is relative to the base directory
            name: "`forceBaseDirectory` + `includeItems`",
            settings: {
                forceBaseDirectory: `${base}/styles`,
                includeItems: ["/site.scss", "/admin/admin.sass"],
            },
            compiled: ["styles/admin/admin.sass", "styles/site.scss"],
            partials: ["styles/_mixins.scss", "styles/admin/_vars.sass"],
        },
        {
            name: "`forceBaseDirectory` + `includeItems` + `excludeList`",
            settings: {
                forceBaseDirectory: `${base}/styles`,
                includeItems: ["/**/*.scss"],
                excludeList: ["/partials/**", "/admin/**"],
            },
            compiled: ["styles/site.scss"],
            partials: ["styles/_mixins.scss"],
        },
        {
            // `partialsList` is relative to the base directory
            name: "`forceBaseDirectory` + `partialsList` with a folder of partials",
            settings: {
                forceBaseDirectory: `${base}/styles`,
                partialsList: ["/**/_*.s[ac]ss", "/partials/**"],
            },
            compiled: ["styles/admin/admin.sass", "styles/site.scss"],
            partials: [
                "styles/_mixins.scss",
                "styles/admin/_vars.sass",
                "styles/partials/buttons.scss",
            ],
        },
        {
            // ... so a pattern written from the workspace folder matches nothing
            name: "`forceBaseDirectory` + `partialsList` written from the workspace folder",
            settings: {
                forceBaseDirectory: `${base}/styles`,
                partialsList: ["/**/_*.s[ac]ss", `${base}/styles/partials/**`],
            },
            compiled: [
                "styles/admin/admin.sass",
                "styles/partials/buttons.scss",
                "styles/site.scss",
            ],
            partials: ["styles/_mixins.scss", "styles/admin/_vars.sass"],
        },
        {
            name: "`forceBaseDirectory` + `includeItems` + `excludeList` + `partialsList`",
            settings: {
                forceBaseDirectory: `${base}/styles`,
                includeItems: ["/site.scss"],
                excludeList: ["/admin/**"],
                partialsList: ["/**/_*.s[ac]ss", "/partials/**"],
            },
            compiled: ["styles/site.scss"],
            partials: ["styles/_mixins.scss", "styles/partials/buttons.scss"],
        },
        {
            name: "An `excludeList` that excludes everything",
            settings: { excludeList: [`${base}/**`] },
            compiled: [],
            partials: [],
        },
        {
            name: "A `forceBaseDirectory` that doesn't exist",
            settings: { forceBaseDirectory: `${base}/missing` },
            compiled: [],
            // Can't be checked: when the folder is missing an error is shown
            // and a changed file is treated as if the setting wasn't there
            partials: [],
        },
    ];

    /** What the extension does when it's watching and this file changes */
    async function onChange(
        file: string,
    ): Promise<"compiled" | "partial" | "ignored"> {
        const fullPath = path.join(fixturePath, file),
            type = SassFileClassifier.confirmSassType(
                fullPath,
                settings.folder,
            );

        if (
            type === SassConfirmationType.NotSass ||
            (await SassFileClassifier.isSassFileExcluded(
                fullPath,
                settings.folder,
            ))
        ) {
            return "ignored";
        }

        return type === SassConfirmationType.PartialFile
            ? "partial"
            : "compiled";
    }

    suiteSetup(async () => {
        fixturePath = path.join(settings.folder.uri.fsPath, fixtureName);

        // Stop the extension compiling the fixture as it's created
        await vscode.commands.executeCommand(
            "liveSass.command.donotWatchMySass",
        );

        const files: Record<string, string> = {
            "styles/readme.md": "Not a Sass file",
            "styles/site.css": "/* Not a Sass file */",
        };

        sassFiles.forEach((file) => (files[file] = "// Empty"));

        writeFiles(fixturePath, files);
    });

    teardown(() => settings.reset());

    suiteTeardown(async () => {
        fs.rmSync(fixturePath, { recursive: true, force: true });

        await vscode.commands.executeCommand("liveSass.command.watchMySass");
    });

    scenarios.forEach((scenario) => {
        test(`${scenario.name}: "compile all" compiles the right files`, async () => {
            await settings.setAll(scenario.settings);

            const compiled = (await SassFileCollector.getSassFiles())
                .filter((file) => file.startsWith(fixturePath + path.sep))
                .map((file) =>
                    path.relative(fixturePath, file).replace(/\\/g, "/"),
                )
                .sort();

            assert.deepEqual(compiled, scenario.compiled);
        });

        if (scenario.name.includes("doesn't exist")) {
            return;
        }

        test(`${scenario.name}: a changed file does the right thing`, async () => {
            await settings.setAll(scenario.settings);

            const actual: Record<string, string> = {},
                expected: Record<string, string> = {};

            for (const file of sassFiles) {
                actual[file] = await onChange(file);

                expected[file] = scenario.compiled.includes(file)
                    ? "compiled"
                    : scenario.partials.includes(file)
                      ? "partial"
                      : "ignored";
            }

            assert.deepEqual(actual, expected);
        });
    });
});

suite("Settings — where the output is saved", function () {
    this.timeout(20000);

    const fixtureName = "output_fixture",
        base = `/${fixtureName}`,
        settings = new WorkspaceSettings(),
        sources = ["src/scss/_dep.scss", "src/scss/app.scss"];

    let fixturePath: string;

    /** Compiles everything, returning the files that were generated */
    async function compileAll(
        scenarioSettings: Record<string, unknown>,
    ): Promise<string[]> {
        await settings.setAll(scenarioSettings);

        await vscode.commands.executeCommand(
            "liveSass.command.oneTimeCompileSass",
        );

        return listFiles(fixturePath).filter((file) => !sources.includes(file));
    }

    function read(file: string): string {
        return fs.readFileSync(path.join(fixturePath, file), "utf8");
    }

    suiteSetup(async () => {
        fixturePath = path.join(settings.folder.uri.fsPath, fixtureName);

        await vscode.commands.executeCommand(
            "liveSass.command.donotWatchMySass",
        );

        writeFiles(fixturePath, {
            "src/scss/_dep.scss": ".dep {\n    color: red;\n}\n",
            "src/scss/app.scss":
                '@use "dep";\n\n.app {\n    user-select: none;\n}\n',
        });
    });

    setup(async () => {
        // Only the fixture is compiled
        await settings.set("forceBaseDirectory", `${base}/src`);
    });

    teardown(async () => {
        await settings.reset();

        listFiles(fixturePath)
            .filter((file) => !sources.includes(file))
            .forEach((file) => fs.rmSync(path.join(fixturePath, file)));
    });

    suiteTeardown(async () => {
        fs.rmSync(fixturePath, { recursive: true, force: true });

        await vscode.commands.executeCommand("liveSass.command.watchMySass");
    });

    test("By default the CSS and its map are saved beside the Sass file", async () => {
        assert.deepEqual(await compileAll({}), [
            "src/scss/app.css",
            "src/scss/app.css.map",
        ]);

        const css = read("src/scss/app.css");

        assert.ok(css.includes(".dep {"), "Should include the partial");
        assert.ok(css.includes(".app {\n"), "Should be expanded");
        assert.ok(
            css.endsWith("/*# sourceMappingURL=app.css.map */"),
            "Should link to the map",
        );
    });

    test("`generateMap: false` saves no map", async () => {
        assert.deepEqual(await compileAll({ generateMap: false }), [
            "src/scss/app.css",
        ]);

        assert.ok(!read("src/scss/app.css").includes("sourceMappingURL"));
    });

    test("`formats[].generateMap` overrides `generateMap`", async () => {
        assert.deepEqual(
            await compileAll({
                generateMap: false,
                formats: [
                    {
                        format: "expanded",
                        extensionName: ".css",
                        generateMap: true,
                    },
                    {
                        format: "compressed",
                        extensionName: ".min.css",
                    },
                ],
            }),
            [
                "src/scss/app.css",
                "src/scss/app.css.map",
                "src/scss/app.min.css",
            ],
        );
    });

    test("`format` and `extensionName` are applied", async () => {
        assert.deepEqual(
            await compileAll({
                formats: [{ format: "compressed", extensionName: ".min.css" }],
            }),
            ["src/scss/app.min.css", "src/scss/app.min.css.map"],
        );

        assert.ok(
            read("src/scss/app.min.css").startsWith(".dep{color:red}"),
            "Should be compressed",
        );
    });

    test("A `savePath` with a leading slash is relative to the workspace folder", async () => {
        assert.deepEqual(
            await compileAll({
                formats: [
                    {
                        format: "expanded",
                        extensionName: ".css",
                        savePath: `${base}/dist/css`,
                    },
                ],
            }),
            ["dist/css/app.css", "dist/css/app.css.map"],
        );

        const mapSources: string[] = JSON.parse(
            read("dist/css/app.css.map"),
        ).sources.map((source: string) => source.replace(/\\/g, "/"));

        ["../../src/scss/_dep.scss", "../../src/scss/app.scss"].forEach(
            (source) =>
                assert.ok(
                    mapSources.includes(source),
                    `The map should point back to ${source}`,
                ),
        );
    });

    test("A `savePath` with a leading tilde is relative to the Sass file", async () => {
        assert.deepEqual(
            await compileAll({
                formats: [
                    {
                        format: "expanded",
                        extensionName: ".css",
                        savePath: "~/../css",
                    },
                ],
            }),
            ["src/css/app.css", "src/css/app.css.map"],
        );
    });

    test("`savePathReplacementPairs` swaps part of the path", async () => {
        assert.deepEqual(
            await compileAll({
                formats: [
                    {
                        format: "expanded",
                        extensionName: ".css",
                        savePathReplacementPairs: { "/scss/": "/styles/" },
                    },
                ],
            }),
            ["src/styles/app.css", "src/styles/app.css.map"],
        );
    });

    test("`savePathReplacementPairs` works with a relative `savePath`", async () => {
        assert.deepEqual(
            await compileAll({
                formats: [
                    {
                        format: "expanded",
                        extensionName: "-min.css",
                        savePath: "~/..",
                        savePathReplacementPairs: {
                            [`${base}/src`]: `${base}/public`,
                        },
                    },
                ],
            }),
            ["public/app-min.css", "public/app-min.css.map"],
        );
    });

    test("Every format is saved", async () => {
        assert.deepEqual(
            await compileAll({
                formats: [
                    { format: "expanded", extensionName: ".css" },
                    {
                        format: "compressed",
                        extensionName: ".min.css",
                        savePath: `${base}/dist`,
                        generateMap: false,
                    },
                ],
            }),
            ["dist/app.min.css", "src/scss/app.css", "src/scss/app.css.map"],
        );
    });

    test("`autoprefix` adds the prefixes the browsers need", async () => {
        await compileAll({ autoprefix: ["Safari 10"], generateMap: false });

        assert.ok(
            read("src/scss/app.css").includes("-webkit-user-select: none"),
            "Should be prefixed for the given browsers",
        );
    });

    test("`autoprefix: false` leaves the CSS as it is", async () => {
        await compileAll({ autoprefix: false, generateMap: false });

        assert.ok(!read("src/scss/app.css").includes("-webkit-"));
    });
});
