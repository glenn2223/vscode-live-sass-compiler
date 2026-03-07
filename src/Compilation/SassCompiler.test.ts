import * as assert from "assert";
import { Logger } from "sass-embedded";
import path from "path";
import * as vscode from "vscode";
import { SassCompiler } from "./SassCompiler";

const loggerProperty: Logger = {
    warn: (message, options) => {
        console.warn(
            "Warning:",
            [message].concat(
                SassCompiler.format(
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
            [message].concat(SassCompiler.format(options.span)),
        );
    },
};

suite("SassCompiler Tests", function () {
    const filePath = path.resolve(
        __dirname,
        "../../src/test/sample/css/sample.scss",
    );

    test("Simple compressed test", async () => {
        const input = filePath,
            expected = ".Sample{color:#000}",
            actualObj = await SassCompiler.compileOneAsync(
                input,
                "input.scss",
                {
                    style: "compressed",
                    logger: loggerProperty,
                },
            );

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
            actualObj = await SassCompiler.compileOneAsync(
                input,
                "input.scss",
                {
                    style: "expanded",
                    logger: loggerProperty,
                },
            );

        if (actualObj.errorString) {
            console.log("Compile error:", actualObj.errorString);
        }

        assert.equal(actualObj.errorString, null);

        assert.equal(actualObj.result?.css, expected);
    });
});

suite("SassCompiler toSassOptions Tests", function () {
    const dummyFormat = {
        format: "compressed" as const,
        extensionName: ".css",
    };

    test("toSassOptions without pathAliases returns importers", () => {
        const options = SassCompiler.toSassOptions(dummyFormat);

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
        const options = SassCompiler.toSassOptions(dummyFormat, false, null);

        assert.ok(options.importers, "importers should be defined");
        assert.equal(
            Array.isArray(options.importers) && options.importers.length,
            1,
            "should have exactly one importer",
        );
    });

    test("toSassOptions with pathAliases returns importers", () => {
        const aliases = { "~": "/node_modules/", "pkg:": "/node_modules/" };
        const options = SassCompiler.toSassOptions(dummyFormat, false, aliases);

        assert.ok(options.importers, "importers should be defined");
        assert.equal(
            Array.isArray(options.importers) && options.importers.length,
            1,
            "should have exactly one importer",
        );
    });

    test("toSassOptions passes sourceMapIncludeSources", () => {
        const options = SassCompiler.toSassOptions(dummyFormat, true);

        assert.equal(options.sourceMapIncludeSources, true);
    });
});

suite("SassCompiler pathAliases compilation Tests", function () {
    const sampleDir = path.resolve(__dirname, "../../src/test/sample");
    const libsDir = path.resolve(sampleDir, "libs");
    const nodeModulesDir = path.resolve(sampleDir, "node_modules");
    const compileFormat = {
        format: "compressed" as const,
        extensionName: ".css",
    };

    test("Alias resolves @use with prefix to correct path", async () => {
        const input = path.resolve(sampleDir, "alias_test.scss");
        const aliases = { mylib: libsDir };
        const options = SassCompiler.toSassOptions(
            compileFormat,
            false,
            aliases,
        );

        const result = await SassCompiler.compileOneAsync(
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
        const options = SassCompiler.toSassOptions(
            compileFormat,
            false,
            aliases,
        );

        const result = await SassCompiler.compileOneAsync(
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
        const aliases = {
            "mylib/colors": path.resolve(libsDir, "colors"),
            mylib: path.resolve(sampleDir, "nonexistent"),
        };
        const options = SassCompiler.toSassOptions(
            compileFormat,
            false,
            aliases,
        );

        const result = await SassCompiler.compileOneAsync(
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
        const aliases = { "other:": libsDir };
        const options = SassCompiler.toSassOptions(
            compileFormat,
            false,
            aliases,
        );

        const result = await SassCompiler.compileOneAsync(
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
        const options = SassCompiler.toSassOptions(
            compileFormat,
            false,
            aliases,
        );

        const result = await SassCompiler.compileOneAsync(
            input,
            "output.css",
            options,
        );

        assert.notEqual(result.errorString, null);
        assert.equal(result.result, null);
    });

    test("pkg: alias resolves to workspace node_modules path", async () => {
        if (!vscode.workspace.workspaceFolders?.length) {
            return;
        }

        const input = path.resolve(sampleDir, "pkg_alias_test.scss");
        const aliases = { "pkg:": "/node_modules/" };
        const options = SassCompiler.toSassOptions(
            compileFormat,
            false,
            aliases,
        );

        const result = await SassCompiler.compileOneAsync(
            input,
            "output.css",
            options,
        );

        assert.equal(result.errorString, null);
        assert.ok(result.result?.css.includes(".PkgAliasTest"));
        assert.ok(result.result?.css.includes("#123456"));
    });

    test("pkg: alias resolves with absolute replacement path", async () => {
        const input = path.resolve(sampleDir, "pkg_alias_test.scss");
        const aliases = { "pkg:": nodeModulesDir };
        const options = SassCompiler.toSassOptions(
            compileFormat,
            false,
            aliases,
        );

        const result = await SassCompiler.compileOneAsync(
            input,
            "output.css",
            options,
        );

        assert.equal(result.errorString, null);
        assert.ok(result.result?.css.includes(".PkgAliasTest"));
        assert.ok(result.result?.css.includes("#123456"));
    });
});
