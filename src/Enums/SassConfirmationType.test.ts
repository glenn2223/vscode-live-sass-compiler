import * as assert from "assert";
import { SassConfirmationType } from "../Enums/SassConfirmationType";

suite("SassConfirmationType Enum", function () {
    test("SassFile is defined", () => {
        assert.equal(SassConfirmationType.SassFile, 0);
    });

    test("PartialFile is defined", () => {
        assert.equal(SassConfirmationType.PartialFile, 1);
    });

    test("NotSass is defined", () => {
        assert.equal(SassConfirmationType.NotSass, 2);
    });

    test("All values are distinct", () => {
        const values = [
            SassConfirmationType.SassFile,
            SassConfirmationType.PartialFile,
            SassConfirmationType.NotSass,
        ];
        const unique = new Set(values);
        assert.equal(unique.size, values.length);
    });
});
