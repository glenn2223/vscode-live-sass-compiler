import * as assert from "assert";
import { Logger } from "sass-embedded";
import path from "path";
import { pathToFileURL } from "url";
import { existsSync } from "fs";
import { SassHelper } from "./SassHelper";

const loggerProperty: Logger = {
    warn: (message, options) => {
        console.warn(
            "Warning:",
            [message].concat(
                SassHelper.format(
                    options.span,
                    options.stack,
                    options.deprecation,
                ),
            ),
        );
    },
    debug: (message, options) => {
        console.debug(
            "Debug info:",
            [message].concat(SassHelper.format(options.span)),
        );
    },
};

suite("SassHelper Tests", function () {
    const filePath = path.resolve(
        __dirname,
        "../../src/test/sample/css/sample.scss",
    );

    test("Simple compressed test", async () => {
        const input = filePath,
            expected = ".Sample{color:#000}",
            actualObj = await SassHelper.compileOneAsync(input, "input.scss", {
                style: "compressed",
                logger: loggerProperty,
            });

        if (actualObj.errorString) {
            console.log("Compile error:", actualObj.errorString);
        }

        assert.equal(actualObj.errorString, null);

        assert.equal(actualObj.result?.css, expected);
    });

    test("Simple expanded test", async () => {
        const input = filePath,
            expected = `.Sample {
  color: #000;
}`,
            actualObj = await SassHelper.compileOneAsync(input, "input.scss", {
                style: "expanded",
                logger: loggerProperty,
            });

        if (actualObj.errorString) {
            console.log("Compile error:", actualObj.errorString);
        }

        assert.equal(actualObj.errorString, null);

        assert.equal(actualObj.result?.css, expected);
    });
});

suite("SassHelper toSassOptions Tests", function () {
    const dummyFormat = {
        format: "compressed" as const,
        extensionName: ".css",
        linefeed: "lf" as const,
        indentType: "space" as const,
        indentWidth: 2,
    };

    test("toSassOptions without pathAliases returns importers", () => {
        const options = SassHelper.toSassOptions(dummyFormat);

        assert.ok(options.importers, "importers should be defined");
        assert.equal(
            Array.isArray(options.importers) && options.importers.length,
            1,
            "should have exactly one importer",
        );
        assert.equal(options.style, "compressed");
        assert.equal(options.sourceMap, true);
        assert.equal(options.sourceMapIncludeSources, false);
    });

    test("toSassOptions with null pathAliases returns importers", () => {
        const options = SassHelper.toSassOptions(dummyFormat, false, null);

        assert.ok(options.importers, "importers should be defined");
        assert.equal(
            Array.isArray(options.importers) && options.importers.length,
            1,
            "should have exactly one importer",
        );
    });

    test("toSassOptions with pathAliases returns importers", () => {
        const aliases = { "~": "/node_modules/", "pkg:": "/node_modules/" };
        const options = SassHelper.toSassOptions(dummyFormat, false, aliases);

        assert.ok(options.importers, "importers should be defined");
        assert.equal(
            Array.isArray(options.importers) && options.importers.length,
            1,
            "should have exactly one importer",
        );
    });

    test("toSassOptions passes sourceMapIncludeSources", () => {
        const options = SassHelper.toSassOptions(dummyFormat, true);

        assert.equal(options.sourceMapIncludeSources, true);
    });
});

suite("SassHelper pathAliases compilation Tests", function () {
    const sampleDir = path.resolve(__dirname, "../../src/test/sample");
    const libsDir = path.resolve(sampleDir, "libs");

    /**
     * Helper to build options with a custom importer that mimics
     * pathAliases prefix replacement, without requiring VS Code workspace.
     */
    function buildOptionsWithAliases(
        pathAliases: Record<string, string>,
        style: "compressed" | "expanded" = "compressed",
    ) {
        // Sort keys longest-first (same as SassHelper.parsePath)
        const sortedKeys = Object.keys(pathAliases).sort(
            (a, b) => b.length - a.length,
        );

        return {
            style,
            logger: loggerProperty,
            importers: [
                {
                    findFileUrl: (importUrl: string) => {
                        const normalisedUrl = importUrl.replace(/\\/g, "/");

                        for (const prefix of sortedKeys) {
                            if (normalisedUrl.startsWith(prefix)) {
                                const replacement = pathAliases[prefix];
                                const remainder = normalisedUrl
                                    .substring(prefix.length)
                                    .replace(/^\//, "");

                                const resolvedPath = path.join(
                                    replacement,
                                    remainder,
                                );
                                const dir = path.dirname(resolvedPath);

                                if (existsSync(dir)) {
                                    return pathToFileURL(resolvedPath);
                                }

                                break;
                            }
                        }

                        return null;
                    },
                },
            ],
        };
    }

    test("Alias resolves @use with prefix to correct path", async () => {
        const input = path.resolve(sampleDir, "alias_test.scss");
        const aliases = { mylib: libsDir };
        const options = buildOptionsWithAliases(aliases);

        const result = await SassHelper.compileOneAsync(
            input,
            "output.css",
            options,
        );

        if (result.errorString) {
            console.log("Compile error:", result.errorString);
        }

        assert.equal(result.errorString, null);
        assert.ok(result.result?.css.includes("color"));
        assert.ok(result.result?.css.includes("red"));
    });

    test("Alias resolves nested @use with prefix", async () => {
        const input = path.resolve(sampleDir, "alias_test_mixin.scss");
        const aliases = { mylib: libsDir };
        const options = buildOptionsWithAliases(aliases);

        const result = await SassHelper.compileOneAsync(
            input,
            "output.css",
            options,
        );

        if (result.errorString) {
            console.log("Compile error:", result.errorString);
        }

        assert.equal(result.errorString, null);
        assert.ok(result.result?.css.includes("font-size"));
    });

    test("Longest prefix wins when multiple aliases match", async () => {
        const input = path.resolve(sampleDir, "alias_test.scss");
        // "mylib/colors" is longer and should match before "mylib"
        // We point "mylib/colors" directly at the colors dir
        // and "mylib" at a non-existent dir — if longest-first works,
        // "mylib/colors" matches and compilation succeeds
        const aliases = {
            "mylib/colors": path.resolve(libsDir, "colors"),
            mylib: path.resolve(sampleDir, "nonexistent"),
        };
        const options = buildOptionsWithAliases(aliases);

        const result = await SassHelper.compileOneAsync(
            input,
            "output.css",
            options,
        );

        if (result.errorString) {
            console.log("Compile error:", result.errorString);
        }

        assert.equal(result.errorString, null);
        assert.ok(result.result?.css.includes("color"));
    });

    test("Unmatched prefix returns null and compilation fails", async () => {
        const input = path.resolve(sampleDir, "alias_test.scss");
        // No alias matches "mylib" — compilation should fail
        const aliases = { "other:": libsDir };
        const options = buildOptionsWithAliases(aliases);

        const result = await SassHelper.compileOneAsync(
            input,
            "output.css",
            options,
        );

        assert.notEqual(result.errorString, null);
        assert.equal(result.result, null);
    });

    test("Empty pathAliases does not resolve aliases", async () => {
        const input = path.resolve(sampleDir, "alias_test.scss");
        const aliases = {};
        const options = buildOptionsWithAliases(aliases);

        const result = await SassHelper.compileOneAsync(
            input,
            "output.css",
            options,
        );

        assert.notEqual(result.errorString, null);
        assert.equal(result.result, null);
    });
});
