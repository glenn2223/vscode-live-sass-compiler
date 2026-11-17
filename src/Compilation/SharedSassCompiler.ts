import type { ChildProcess } from "child_process";
import {
    AsyncCompiler,
    CompileResult,
    Exception,
    Options,
    initAsyncCompiler,
} from "sass-embedded";

interface IRunningCompiler {
    compiler: AsyncCompiler;

    /** Rejects when the compiler's process stops, for whatever reason */
    stopped: Promise<never>;
}

/**
 * The process behind a compiler from `sass-embedded`.
 *
 * This isn't part of their public API, so it could change in any release.
 * Without it there's no way to tell that the process has stopped, and a
 * compile that was in progress at the time would wait forever.
 * `SharedSassCompiler.test.ts` fails if this stops working.
 */
export function getCompilerProcess(
    compiler: AsyncCompiler,
): ChildProcess | undefined {
    const childProcess = (compiler as unknown as { process?: ChildProcess })
        .process;

    return typeof childProcess?.once === "function" ? childProcess : undefined;
}

/**
 * Compiles every file with one long-lived Sass compiler process.
 *
 * `compileAsync` from `sass-embedded` starts a process for each call and
 * stops it afterwards. Compiling 100 files meant 100 processes, all running
 * at once. The process started here is shared by every compile (it handles
 * many at a time) and is stopped once it hasn't been used for a while.
 */
export class SharedSassCompiler {
    private _running: Promise<IRunningCompiler> | undefined;
    private _activeCompiles = 0;
    private _idleTimer: ReturnType<typeof setTimeout> | undefined;

    /**
     * @param _start Starts a compiler process
     * @param _idleTimeout How long (in ms) an unused process is kept for
     */
    constructor(
        private readonly _start: () => Promise<AsyncCompiler> = initAsyncCompiler,
        private readonly _idleTimeout = 5 * 60 * 1000,
    ) {}

    async compile(
        sassPath: string,
        options: Options<"async">,
    ): Promise<CompileResult> {
        this.stopIdleTimer();
        this._activeCompiles++;

        try {
            try {
                return await this.compileOnce(sassPath, options);
            } catch (err) {
                if (err instanceof Exception) {
                    throw err;
                }

                // It wasn't the Sass that failed, it was the compiler (its
                // process was ended, for example). That one has been
                // discarded, so have one more go with a new one
                return await this.compileOnce(sassPath, options);
            }
        } finally {
            if (--this._activeCompiles === 0) {
                this.startIdleTimer();
            }
        }
    }

    /** Stops the compiler process. A later compile starts a new one. */
    async dispose(): Promise<void> {
        this.stopIdleTimer();

        const running = this._running;

        this._running = undefined;

        await SharedSassCompiler.stop(running);
    }

    private async compileOnce(
        sassPath: string,
        options: Options<"async">,
    ): Promise<CompileResult> {
        const running = (this._running ??= this.start());

        try {
            const { compiler, stopped } = await running;

            // The compiler never answers if its process stops part way
            // through a compile, so that has to be watched for
            return await Promise.race([
                compiler.compileAsync(sassPath, options),
                stopped,
            ]);
        } catch (err) {
            // An error in the Sass says nothing about the compiler. Any
            // other failure means the compiler can't be trusted any more
            if (!(err instanceof Exception) && this._running === running) {
                this._running = undefined;

                void SharedSassCompiler.stop(running);
            }

            throw err;
        }
    }

    private async start(): Promise<IRunningCompiler> {
        const compiler = await this._start(),
            childProcess = getCompilerProcess(compiler),
            stopped = new Promise<never>((_resolve, reject) => {
                childProcess?.once("exit", (code, signal) =>
                    reject(
                        new Error(
                            "The Sass compiler process stopped unexpectedly " +
                                `(${signal ?? `exit code ${code}`})`,
                        ),
                    ),
                );
                childProcess?.once("error", (err) => reject(err));
            });

        // It's only of interest to a compile that's waiting on it
        stopped.catch(() => undefined);

        return { compiler, stopped };
    }

    private static async stop(
        running: Promise<IRunningCompiler> | undefined,
    ): Promise<void> {
        try {
            if (running) {
                const { compiler, stopped } = await running;

                // `dispose` waits for the compiles in progress, which never
                // finish when the process has already gone
                await Promise.race([compiler.dispose(), stopped]);
            }
        } catch {
            // Either it failed to start or it has stopped: both are fine
        }
    }

    private startIdleTimer(): void {
        this.stopIdleTimer();

        this._idleTimer = setTimeout(() => {
            this._idleTimer = undefined;

            if (this._activeCompiles === 0) {
                void this.dispose();
            }
        }, this._idleTimeout);

        // Don't keep VS Code's extension host alive just for this
        this._idleTimer.unref?.();
    }

    private stopIdleTimer(): void {
        if (this._idleTimer) {
            clearTimeout(this._idleTimer);
            this._idleTimer = undefined;
        }
    }
}
