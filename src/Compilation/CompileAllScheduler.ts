import * as vscode from "vscode";

/**
 * Runs the compile that a set of partial changes asked for.
 * @param folders The workspace folders to compile, or `undefined` for all of them
 * @param triggers The paths of the files that asked for the compile
 */
export type CompileAllCallback = (
    folders: vscode.WorkspaceFolder[] | undefined,
    triggers: string[],
) => Promise<void>;

/**
 * Merges a burst of "compile everything" requests into as few compiles as
 * possible.
 *
 * A changed partial recompiles every file, so several partials changing
 * together (a git checkout, a build, "Save All") would otherwise recompile
 * every file once per partial - all at the same time.
 *
 *  - Requests made within `quietPeriod` of each other share a single compile
 *  - A steady stream of requests still compiles every `maxWait`
 *  - A compile never overlaps another; requests made while one is running
 *    are merged into a single compile that follows it
 */
export class CompileAllScheduler {
    private _timer: ReturnType<typeof setTimeout> | undefined;
    private _firstRequestAt = 0;
    private _isRunning = false;

    private _everything = false;
    private readonly _folders = new Map<string, vscode.WorkspaceFolder>();
    private readonly _triggers = new Set<string>();

    constructor(
        private readonly _compile: CompileAllCallback,
        private readonly _quietPeriod = 150,
        private readonly _maxWait = 1000,
    ) {}

    /**
     * Ask for a compile.
     * @param trigger The path of the file that's asking
     * @param folder The workspace folder to compile, or `undefined` for all of them
     */
    request(trigger: string, folder?: vscode.WorkspaceFolder): void {
        if (!this.hasPending) {
            this._firstRequestAt = Date.now();
        }

        this._triggers.add(trigger);

        if (folder) {
            this._folders.set(folder.uri.toString(), folder);
        } else {
            this._everything = true;
        }

        // Wait for the changes to stop, but not forever
        const timeLeft = this._firstRequestAt + this._maxWait - Date.now();

        if (this._timer) {
            clearTimeout(this._timer);
        }

        this._timer = setTimeout(
            () => {
                this._timer = undefined;

                void this.run();
            },
            Math.max(0, Math.min(this._quietPeriod, timeLeft)),
        );
    }

    /**
     * Whether a compile that hasn't started yet will compile the files of
     * this workspace folder.
     */
    covers(folder: vscode.WorkspaceFolder): boolean {
        return (
            this.hasPending &&
            (this._everything || this._folders.has(folder.uri.toString()))
        );
    }

    /** Forget any compile that hasn't started yet */
    cancel(): void {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = undefined;
        }

        this.clearPending();
    }

    private get hasPending(): boolean {
        return this._triggers.size > 0;
    }

    private clearPending(): void {
        this._everything = false;
        this._folders.clear();
        this._triggers.clear();
    }

    private async run(): Promise<void> {
        if (this._isRunning) {
            // The running compile picks up what's pending when it ends
            return;
        }

        this._isRunning = true;

        try {
            // Loops for the requests that were made while compiling, unless
            // they're still coming in (the timer then starts the next one)
            while (this.hasPending && !this._timer) {
                const folders = this._everything
                        ? undefined
                        : [...this._folders.values()],
                    triggers = [...this._triggers];

                this.clearPending();

                try {
                    await this._compile(folders, triggers);
                } catch {
                    // Reporting errors is the callback's job. One failed
                    // compile mustn't stop the ones that follow
                }
            }
        } finally {
            this._isRunning = false;
        }
    }
}
