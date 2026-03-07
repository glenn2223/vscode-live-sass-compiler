import * as assert from "assert";
import { OutputLevel } from "../Enums/OutputLevel";

suite("OutputLevel Enum", function () {
    test("Values are in ascending order", () => {
        assert.ok(OutputLevel.Trace < OutputLevel.Debug);
        assert.ok(OutputLevel.Debug < OutputLevel.Information);
        assert.ok(OutputLevel.Information < OutputLevel.Warning);
        assert.ok(OutputLevel.Warning < OutputLevel.Error);
        assert.ok(OutputLevel.Error < OutputLevel.Critical);
    });

    test("Trace is 1", () => {
        assert.equal(OutputLevel.Trace, 1);
    });

    test("Debug is 2", () => {
        assert.equal(OutputLevel.Debug, 2);
    });

    test("Information is 3", () => {
        assert.equal(OutputLevel.Information, 3);
    });

    test("Warning is 4", () => {
        assert.equal(OutputLevel.Warning, 4);
    });

    test("Error is 5", () => {
        assert.equal(OutputLevel.Error, 5);
    });

    test("Critical is 6", () => {
        assert.equal(OutputLevel.Critical, 6);
    });
});
