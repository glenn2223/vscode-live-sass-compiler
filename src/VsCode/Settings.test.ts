import * as assert from "assert";
import * as vscode from "vscode";
import { Settings } from "./Settings";
import { OutputLevel } from "../Enums/OutputLevel";

suite("Settings Tests", function () {
    const config = () =>
        vscode.workspace.getConfiguration("liveSassCompile.settings");

    suite("getHideOutputWindowOnSuccess", function () {
        teardown(async () => {
            // Reset to default after each test
            await config().update("hideOutputWindowOnSuccess", undefined);
        });

        test("Default value is false", () => {
            assert.strictEqual(Settings.getHideOutputWindowOnSuccess(), false);
        });

        test("Returns true when enabled", async () => {
            await config().update("hideOutputWindowOnSuccess", true);

            assert.strictEqual(Settings.getHideOutputWindowOnSuccess(), true);
        });

        test("Returns false when explicitly disabled", async () => {
            await config().update("hideOutputWindowOnSuccess", false);

            assert.strictEqual(Settings.getHideOutputWindowOnSuccess(), false);
        });
    });

    suite("hideOutputWindowOnSuccess eligibility", function () {
        teardown(async () => {
            await config().update("showOutputWindowOn", undefined);
            await config().update("hideOutputWindowOnSuccess", undefined);
        });

        test("Not eligible at Information level", async () => {
            await config().update("showOutputWindowOn", "Information");
            await config().update("hideOutputWindowOnSuccess", true);

            const logLevel = Settings.getOutputLogLevel();
            const hideEnabled = Settings.getHideOutputWindowOnSuccess();

            assert.ok(
                !(hideEnabled && logLevel > OutputLevel.Information),
                "Should NOT be eligible to hide at Information level",
            );
        });
    });
});
