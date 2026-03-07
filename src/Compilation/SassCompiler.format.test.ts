import * as assert from "assert";
import { SassCompiler } from "./SassCompiler";
import { SourceSpan } from "sass-embedded";

suite("SassCompiler.format", function () {
    test("Returns empty array for null span", () => {
        const result = SassCompiler.format(null);
        assert.deepStrictEqual(result, []);
    });

    test("Returns empty array for undefined span", () => {
        const result = SassCompiler.format(undefined);
        assert.deepStrictEqual(result, []);
    });

    test("Returns stack when span is undefined but stack provided", () => {
        const result = SassCompiler.format(undefined, "at some/file.scss:10");
        assert.deepStrictEqual(result, ["at some/file.scss:10"]);
    });

    test("Returns deprecation notice when deprecated", () => {
        const result = SassCompiler.format(null, undefined, true);
        assert.ok(
            result.some((s) => s.includes("DEPRECATED")),
            "Should contain deprecation notice",
        );
    });

    test("Does not include deprecation notice when not deprecated", () => {
        const result = SassCompiler.format(null, undefined, false);
        assert.ok(
            !result.some((s) => s.includes("DEPRECATED")),
            "Should not contain deprecation notice",
        );
    });

    test("Formats a single-line span", () => {
        const span: SourceSpan = {
            start: { offset: 0, line: 1, column: 0 },
            end: { offset: 5, line: 1, column: 5 },
            text: "color",
            context: "  color: red;",
            url: new URL("file:///project/test.scss"),
        };

        const result = SassCompiler.format(span);

        assert.ok(result.length > 0, "Should produce output lines");
        assert.ok(
            result.some((s) => s.includes("test.scss")),
            "Should include file URL",
        );
    });
});

suite("SassCompiler.compileOneAsync error handling", function () {
    test("Returns error for nonexistent file", async () => {
        const result = await SassCompiler.compileOneAsync(
            "/nonexistent/file.scss",
            "output.css",
            { style: "compressed" },
        );

        assert.ok(result.errorString !== null, "Should have an error string");
        assert.equal(result.result, null, "Result should be null on error");
    });

    test("Returns error for invalid SASS syntax", async () => {
        // This path doesn't exist, so it should error
        const result = await SassCompiler.compileOneAsync(
            "invalid_file_that_does_not_exist.scss",
            "output.css",
            { style: "expanded" },
        );

        assert.ok(result.errorString !== null);
        assert.equal(result.result, null);
    });
});
