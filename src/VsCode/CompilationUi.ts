import { Settings } from "./Settings";
import { StatusBarUi } from "./StatusbarUi";
import { OutputWindow } from "./OutputWindow";
import { OutputLevel } from "../Enums/OutputLevel";

export class CompilationUi {
    /**
     * Hides the output window after successful compilation if the
     * `hideOutputWindowOnSuccess` setting is enabled and the current
     * output log level is Warning or higher.
     */
    static hideOutputWindowIfApplicable(): void {
        if (
            Settings.getHideOutputWindowOnSuccess() &&
            Settings.getOutputLogLevel() > OutputLevel.Information
        ) {
            OutputWindow.Hide();
        }
    }

    static revertUIToWatchingStatus(isWatching: boolean): void {
        OutputWindow.Show(
            OutputLevel.Trace,
            "Registered timeout to revert UI to correct watching status",
        );

        setTimeout(() => {
            CompilationUi.revertUIToWatchingStatusNow(isWatching);
        }, 3000);
    }

    static revertUIToWatchingStatusNow(isWatching: boolean): void {
        OutputWindow.Show(OutputLevel.Trace, "Switching UI state");

        if (isWatching) {
            StatusBarUi.watching();
            OutputWindow.Show(OutputLevel.Information, "Watching...");
        } else {
            StatusBarUi.notWatching();
            OutputWindow.Show(OutputLevel.Information, "Not Watching...");
        }
    }

    /**
     * Evaluates single-file compilation results and updates UI.
     */
    static handleSingleResults(results: boolean[], isWatching: boolean): void {
        if (results.every((r) => r)) {
            StatusBarUi.compilationSuccess(isWatching);
            CompilationUi.hideOutputWindowIfApplicable();
        } else if (results.length) {
            StatusBarUi.compilationError(isWatching);
        }
    }

    /**
     * Evaluates batch compilation results and updates UI.
     */
    static handleBatchResults(results: boolean[][], isWatching: boolean): void {
        if (results.every((r) => r.every((s) => s))) {
            StatusBarUi.compilationSuccess(isWatching);
            CompilationUi.hideOutputWindowIfApplicable();
        } else if (results.length) {
            StatusBarUi.compilationError(isWatching);
        }
    }
}
