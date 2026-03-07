import { window } from "vscode";

export class WindowPopout {
    static Inform(message: string): void {
        window.showInformationMessage(message);
    }

    static Warn(message: string): void {
        window.showWarningMessage(message);
    }

    static Alert(message: string): void {
        window.showErrorMessage(message);
    }
}
