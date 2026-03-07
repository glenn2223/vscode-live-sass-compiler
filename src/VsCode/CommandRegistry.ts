import * as vscode from "vscode";

import { AppModel } from "../appModel";
import { OutputWindow } from "./OutputWindow";
import { OutputLevel } from "../Enums/OutputLevel";
import { Settings } from "./Settings";

export function registerCommands(
    appModel: AppModel,
    context: vscode.ExtensionContext,
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "liveSass.command.watchMySass",
            async () => {
                OutputWindow.Show(
                    OutputLevel.Trace,
                    'Command called: "liveSass.command.watchMySass"',
                );
                await appModel.StartWatching();
            },
        ),
        vscode.commands.registerCommand(
            "liveSass.command.donotWatchMySass",
            () => {
                OutputWindow.Show(
                    OutputLevel.Trace,
                    'Command called: "liveSass.command.donotWatchMySass"',
                );
                appModel.StopWatching();
            },
        ),
        vscode.commands.registerCommand(
            "liveSass.command.oneTimeCompileSass",
            async () => {
                OutputWindow.Show(
                    OutputLevel.Trace,
                    'Command called: "liveSass.command.oneTimeCompileSass"',
                );
                await appModel.compileAllFiles();
            },
        ),
        vscode.commands.registerCommand(
            "liveSass.command.compileCurrentSass",
            async () => {
                OutputWindow.Show(
                    OutputLevel.Trace,
                    'Command called: "liveSass.command.compileCurrentSass"',
                );
                await appModel.compileCurrentFile();
            },
        ),
        vscode.commands.registerCommand(
            "liveSass.command.openOutputWindow",
            () => {
                OutputWindow.Show(
                    OutputLevel.Trace,
                    'Command called: "liveSass.command.openOutputWindow"',
                );
                appModel.openOutputWindow();
            },
        ),
        vscode.commands.registerCommand(
            "liveSass.command.createIssue",
            async () => {
                OutputWindow.Show(
                    OutputLevel.Trace,
                    'Command called: "liveSass.command.createIssue"',
                );
                await appModel.createIssue();
            },
        ),
        vscode.commands.registerCommand(
            "liveSass.command.debugInclusion",
            async () => {
                OutputWindow.Show(
                    OutputLevel.Trace,
                    'Command called: "liveSass.command.debugInclusion"',
                );
                await appModel.debugInclusion();
            },
        ),
        vscode.commands.registerCommand(
            "liveSass.command.debugFileList",
            async () => {
                OutputWindow.Show(
                    OutputLevel.Trace,
                    'Command called: "liveSass.command.debugFileList"',
                );
                await appModel.debugFileList();
            },
        ),
        vscode.commands.registerCommand(
            "liveSass.command.showOutputOn.trace",
            async () => {
                OutputWindow.Show(
                    OutputLevel.Trace,
                    'Command called: "liveSass.command.showOutputOn.trace"',
                );
                await Settings.updateOutputLogLevel(OutputLevel.Trace);
            },
        ),
        vscode.commands.registerCommand(
            "liveSass.command.showOutputOn.debug",
            async () => {
                OutputWindow.Show(
                    OutputLevel.Trace,
                    'Command called: "liveSass.command.showOutputOn.debug"',
                );
                await Settings.updateOutputLogLevel(OutputLevel.Debug);
            },
        ),
        vscode.commands.registerCommand(
            "liveSass.command.showOutputOn.information",
            async () => {
                OutputWindow.Show(
                    OutputLevel.Trace,
                    'Command called: "liveSass.command.showOutputOn.information"',
                );
                await Settings.updateOutputLogLevel(OutputLevel.Information);
            },
        ),
        vscode.commands.registerCommand(
            "liveSass.command.showOutputOn.warning",
            async () => {
                OutputWindow.Show(
                    OutputLevel.Trace,
                    'Command called: "liveSass.command.showOutputOn.warning"',
                );
                await Settings.updateOutputLogLevel(OutputLevel.Warning);
            },
        ),
        vscode.commands.registerCommand(
            "liveSass.command.showOutputOn.error",
            async () => {
                OutputWindow.Show(
                    OutputLevel.Trace,
                    'Command called: "liveSass.command.showOutputOn.error"',
                );
                await Settings.updateOutputLogLevel(OutputLevel.Error);
            },
        ),
        vscode.commands.registerCommand(
            "liveSass.command.showOutputOn.none",
            async () => {
                OutputWindow.Show(
                    OutputLevel.Trace,
                    'Command called: "liveSass.command.showOutputOn.none"',
                );
                await Settings.updateOutputLogLevel(OutputLevel.Critical);
            },
        ),
    );
}
