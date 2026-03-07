"use strict";

import * as vscode from "vscode";

import { AppModel } from "./appModel";
import { checkNewAnnouncement } from "./VsCode/Announcement";
import { registerCommands } from "./VsCode/CommandRegistry";
import { OutputWindow } from "./VsCode/OutputWindow";
import { ErrorLogger } from "./VsCode/ErrorLogger";
import { OutputLevel } from "./Enums/OutputLevel";

export async function activate(
    context: vscode.ExtensionContext,
): Promise<void> {
    try {
        OutputWindow.Show(
            OutputLevel.Trace,
            '"live-sass-compiler" is now activated',
        );

        const appModel = new AppModel(context.workspaceState);

        checkNewAnnouncement(context.globalState);

        registerCommands(appModel, context);

        context.subscriptions.push(appModel);

        OutputWindow.Show(OutputLevel.Trace, "Live SASS commands ready", [
            "Commands have been saved and are ready to be used",
        ]);
    } catch (err) {
        if (err instanceof Error) {
            await new ErrorLogger(context.workspaceState).LogIssueWithAlert(
                `Unhandled error with Live Sass Compiler. Error message: ${err.message}`,
                {
                    error: ErrorLogger.PrepErrorForLogging(err),
                },
            );
        } else {
            await new ErrorLogger(context.workspaceState).LogIssueWithAlert(
                "Unhandled error with Live Sass Compiler. Error message: UNKNOWN (not Error type)",
                {
                    error: JSON.stringify(err),
                },
            );
        }
    }
}

export function deactivate(): void {
    // No actual actions are required

    OutputWindow.Show(OutputLevel.Trace, '"live-sass-compiler" deactivated');
}
