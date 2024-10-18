import * as assert from "assert";
import { autoprefix } from "./Autoprefix";

suite("Autocomplete Tests", function () {
    test("Simple test", async () => {
        const input = ".test{display:flex}",
            expected = ".test{display:-ms-flexbox;display:flex}",
            actualObj = await autoprefix(
                input,
                undefined,
                "input.scss",
                ["IE 10"],
                false
            );

        assert.equal(actualObj.css, expected);
    });

    test("Dated prefix not required (we have good support now)", async () => {
        const input = ".test{display:flex}",
            expected = ".test{display:flex}",
            actualObj = await autoprefix(
                input,
                undefined,
                "input.scss",
                true,
                false
            );

        assert.equal(actualObj.css, expected);
    });

    test("Auto removes dead prefixes", async () => {
        const input = `
a {
    -webkit-border-radius: 5px;
            border-radius: 5px;
}`,
            expected = `
a {
    border-radius: 5px;
}`,
            actualObj = await autoprefix(
                input,
                undefined,
                "input.scss",
                true,
                false
            );

        assert.equal(actualObj.css, expected);
    });

    test("Incorrect list item throws", () => {
        assert.rejects(
            () =>
                autoprefix(
                    ".test{display:flex}",
                    undefined,
                    "input.scss",
                    ["IE10"],
                    false
                ),
            {
                message: /IE10/,
            }
        );
    });
});
