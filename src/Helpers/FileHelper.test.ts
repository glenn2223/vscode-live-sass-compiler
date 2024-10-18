import * as assert from "assert";
import { FileHelper } from "./FileHelper";
import { statSync } from "fs";

suite("FileHelper Tests", function () {
    test("Create file doesn't reject", () => {
        assert.doesNotReject(() =>
            FileHelper.writeToOneFile(
                "./doesntRejectFile.css",
                ".test{display:flex}"
            )
        );
    });

    test("File exists", async () => {
        await FileHelper.writeToOneFile(
            "./existsFile.css",
            ".test{display:flex}"
        );

        assert.ok(statSync("./existsFile.css").isFile());
    });

    test("Can create directory", () => {
        FileHelper.MakeDirIfNotAvailable("./createDir");

        assert.ok(statSync("./createDir").isDirectory());
    });
});
