import * as path from "path";

import { runTests } from "@vscode/test-electron";

async function main() {
    try {
        const extensionDevelopmentPath = path.resolve(__dirname, "../.."),
            extensionTestsPath = __dirname,
            testWorkspace = path.resolve(__dirname, "../../src/test/sample");

        // Download VS Code, unzip it and run the integration test
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            version: "1.74.0",
            launchArgs: [testWorkspace],
        });
    } catch (err) {
        console.error(err);
        console.error("Failed to run tests");
        process.exit(1);
    }
}

main();
