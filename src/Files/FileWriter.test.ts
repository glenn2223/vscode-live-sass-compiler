import * as assert from "assert";
import { FileWriter } from "./FileWriter";
import { statSync } from "fs";

suite("FileWriter Tests", function () {
    test("Create file doesn't reject", () => {
        assert.doesNotReject(() =>
            FileWriter.writeToOneFile(
                "./doesntRejectFile.css",
                ".test{display:flex}",
            ),
        );
    });

    test("File exists", async () => {
        await FileWriter.writeToOneFile(
            "./existsFile.css",
            ".test{display:flex}",
        );

        assert.ok(statSync("./existsFile.css").isFile());
    });

    test("Can create directory", () => {
        FileWriter.MakeDirIfNotAvailable("./createDir");

        assert.ok(statSync("./createDir").isDirectory());
    });
});
