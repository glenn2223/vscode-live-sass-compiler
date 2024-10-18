import * as assert from "assert";
import { Logger } from "sass-embedded";
import path from "path";
import { SassHelper } from "./SassHelper";

const loggerProperty: Logger = {
    warn: (message, options) => {
        console.warn(
            "Warning:",
            [message].concat(
                SassHelper.format(
                    options.span,
                    options.stack,
                    options.deprecation
                )
            )
        );
    },
    debug: (message, options) => {
        console.debug(
            "Debug info:",
            [message].concat(SassHelper.format(options.span))
        );
    },
};

suite("SassHelper Tests", function () {
    const filePath = path.resolve(
        __dirname,
        "../../src/test/sample/css/sample.scss"
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
