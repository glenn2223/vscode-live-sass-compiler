import * as assert from "assert";
import { ErrorLogger } from "./ErrorLogger";

suite("ErrorLogger.PrepErrorForLogging", function () {
    test("Converts Error to a plain object with message", () => {
        const error = new Error("test error");
        const result = ErrorLogger.PrepErrorForLogging(error) as Record<
            string,
            unknown
        >;

        assert.equal(result.message, "test error");
    });

    test("Preserves message from TypeError", () => {
        const error = new TypeError("type issue");
        const result = ErrorLogger.PrepErrorForLogging(error) as Record<
            string,
            unknown
        >;

        assert.equal(result.message, "type issue");
    });

    test("Preserves stack trace", () => {
        const error = new Error("with stack");
        const result = ErrorLogger.PrepErrorForLogging(error) as Record<
            string,
            unknown
        >;

        assert.ok(typeof result.stack === "string");
        assert.ok((result.stack as string).includes("with stack"));
    });

    test("Result is JSON-serializable", () => {
        const error = new Error("serializable");
        const result = ErrorLogger.PrepErrorForLogging(error);

        assert.doesNotThrow(() => JSON.stringify(result));
    });

    test("Handles error with custom properties", () => {
        const error = new Error("custom") as Error & { code: string };
        error.code = "ENOENT";

        const result = ErrorLogger.PrepErrorForLogging(error) as Record<
            string,
            unknown
        >;

        assert.equal(result.code, "ENOENT");
        assert.equal(result.message, "custom");
    });
});
