import * as assert from "assert";
import { SassHelper } from "./SassHelper";

suite("SassHelper Tests", function () {
    console.log("Current dir:", __dirname);

    test("Simple compressed test", async () => {
        const input = "../../src/test/sample/css/sample.css",
            expected = ".Sample{color:#000}",
            actualObj = await SassHelper.compileOneAsync(input, "input.scss", {
                style: "compressed",
            });

        assert.equal(actualObj.result?.css, expected);
    });

    test("Simple expanded test", async () => {
        const input = "../../src/test/sample/css/sample.css",
            expected = `.Sample {
  color: #000;
} `,
            actualObj = await SassHelper.compileOneAsync(input, "input.scss", {
                style: "expanded",
            });

        assert.equal(actualObj.result?.css, expected);
    });
});
