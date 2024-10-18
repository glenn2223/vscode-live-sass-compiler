import { OutputChannel, window } from "vscode";
import { SettingsHelper } from "../Helpers/SettingsHelper";
import { OutputLevel } from "../Enums/OutputLevel";

export class OutputWindow {
    private static _msgChannel: OutputChannel;

    private static get MsgChannel() {
        if (!OutputWindow._msgChannel) {
            OutputWindow._msgChannel =
                window.createOutputChannel("Live Sass Compile");
        }

        return OutputWindow._msgChannel;
    }

    static Show(
        outputLevel: OutputLevel,
        msgHeadline: string | null,
        msgBody?: string[] | null,
        addEndLine = true
    ): void {
        const userLogLevel = SettingsHelper.getOutputLogLevel();

        if (
            outputLevel >= userLogLevel ||
            outputLevel === OutputLevel.Critical
        ) {
            OutputWindow.MsgChannel.show(true);
        }

        if (outputLevel >= userLogLevel || outputLevel > OutputLevel.Debug) {
            if (msgHeadline) {
                OutputWindow.MsgChannel.appendLine(msgHeadline);
            }

            if (msgBody) {
                msgBody.forEach((msg) => {
                    OutputWindow.MsgChannel.appendLine(msg);
                });
            }

            if (addEndLine) {
                OutputWindow.MsgChannel.appendLine("--------------------");
            }
        }
    }

    static dispose(): void {
        this.MsgChannel.dispose();
    }
}
