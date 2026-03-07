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

    suite("getWorkspacesAreLinked", function () {
        teardown(async () => {
            await config().update("workspacesAreLinked", undefined);
        });

        test("Default value is true", () => {
            assert.strictEqual(Settings.getWorkspacesAreLinked(), true);
        });

        test("Returns false when disabled", async () => {
            await config().update("workspacesAreLinked", false);

            assert.strictEqual(Settings.getWorkspacesAreLinked(), false);
        });

        test("Returns true when explicitly enabled", async () => {
            await config().update("workspacesAreLinked", true);

            assert.strictEqual(Settings.getWorkspacesAreLinked(), true);
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

        test("Eligible at Warning level", async () => {
            await config().update("showOutputWindowOn", "Warning");
            await config().update("hideOutputWindowOnSuccess", true);

            const logLevel = Settings.getOutputLogLevel();
            const hideEnabled = Settings.getHideOutputWindowOnSuccess();

            assert.ok(
                hideEnabled && logLevel > OutputLevel.Information,
                "Should be eligible to hide at Warning level",
            );
        });

        test("Eligible at Error level", async () => {
            await config().update("showOutputWindowOn", "Error");
            await config().update("hideOutputWindowOnSuccess", true);

            const logLevel = Settings.getOutputLogLevel();
            const hideEnabled = Settings.getHideOutputWindowOnSuccess();

            assert.ok(
                hideEnabled && logLevel > OutputLevel.Information,
                "Should be eligible to hide at Error level",
            );
        });

        test("Eligible at None level", async () => {
            await config().update("showOutputWindowOn", "None");
            await config().update("hideOutputWindowOnSuccess", true);

            const logLevel = Settings.getOutputLogLevel();
            const hideEnabled = Settings.getHideOutputWindowOnSuccess();

            assert.ok(
                hideEnabled && logLevel > OutputLevel.Information,
                "Should be eligible to hide at None level",
            );
        });

        test("Not eligible at Debug level", async () => {
            await config().update("showOutputWindowOn", "Debug");
            await config().update("hideOutputWindowOnSuccess", true);

            const logLevel = Settings.getOutputLogLevel();
            const hideEnabled = Settings.getHideOutputWindowOnSuccess();

            assert.ok(
                !(hideEnabled && logLevel > OutputLevel.Information),
                "Should NOT be eligible to hide at Debug level",
            );
        });

        test("Not eligible at Trace level", async () => {
            await config().update("showOutputWindowOn", "Trace");
            await config().update("hideOutputWindowOnSuccess", true);

            const logLevel = Settings.getOutputLogLevel();
            const hideEnabled = Settings.getHideOutputWindowOnSuccess();

            assert.ok(
                !(hideEnabled && logLevel > OutputLevel.Information),
                "Should NOT be eligible to hide at Trace level",
            );
        });
    });
});
