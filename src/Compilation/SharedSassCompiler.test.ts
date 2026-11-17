import * as assert from "assert";
import { ChildProcess } from "child_process";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
    AsyncCompiler,
    CompileResult,
    Exception,
    initAsyncCompiler,
} from "sass-embedded";
import { pathToFileURL } from "url";
import { SharedSassCompiler, getCompilerProcess } from "./SharedSassCompiler";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Stands in for the compiler (and its process) from `sass-embedded` */
class FakeCompiler {
    readonly process = new EventEmitter();
    readonly compiled: string[] = [];
    isDisposed = false;

    /** Replace to change what a compile does */
    onCompile: (sassPath: string) => Promise<CompileResult> = async (
        sassPath,
    ) => ({ css: `/* ${sassPath} */`, loadedUrls: [] });

    compileAsync(sassPath: string): Promise<CompileResult> {
        this.compiled.push(sassPath);

        return this.onCompile(sassPath);
    }

    async dispose(): Promise<void> {
        this.isDisposed = true;
    }
}

/** An error in the Sass itself, as `sass-embedded` reports it */
function sassError(): Exception {
    return Object.assign(Object.create(Exception.prototype), {
        message: "Sass error",
    });
}

suite("SharedSassCompiler", function () {
    let started: FakeCompiler[], shared: SharedSassCompiler;

    function create(idleTimeout?: number): SharedSassCompiler {
        return new SharedSassCompiler(async () => {
            const compiler = new FakeCompiler();

            started.push(compiler);

            return compiler as unknown as AsyncCompiler;
        }, idleTimeout);
    }

    setup(() => {
        started = [];
        shared = create();
    });

    teardown(() => shared.dispose());

    test("Nothing is started until there's something to compile", () => {
        assert.equal(started.length, 0);
    });

    test("Many compiles at once share one compiler", async () => {
        const results = await Promise.all(
            Array.from({ length: 100 }, (_value, index) =>
                shared.compile(`/styles/file${index}.scss`, {}),
            ),
        );

        assert.equal(started.length, 1, "Should only start one compiler");
        assert.equal(started[0].compiled.length, 100);
        assert.equal(results[42].css, "/* /styles/file42.scss */");
    });

    test("Later compiles reuse the compiler", async () => {
        await shared.compile("/styles/one.scss", {});
        await shared.compile("/styles/two.scss", {});

        assert.equal(started.length, 1);
        assert.equal(started[0].isDisposed, false);
    });

    test("An error in the Sass is passed on and the compiler is kept", async () => {
        await shared.compile("/styles/one.scss", {});

        started[0].onCompile = () => Promise.reject(sassError());

        await assert.rejects(
            shared.compile("/styles/bad.scss", {}),
            (err) => err instanceof Exception,
        );

        assert.equal(started.length, 1, "Shouldn't start another compiler");
        assert.equal(started[0].isDisposed, false);
        assert.equal(
            started[0].compiled.length,
            2,
            "Shouldn't try the file again",
        );
    });

    test("A compiler that fails is replaced and the file is compiled again", async () => {
        await shared.compile("/styles/one.scss", {});

        started[0].onCompile = () =>
            Promise.reject(new Error("Tried writing to closed dispatcher"));

        const result = await shared.compile("/styles/two.scss", {});

        assert.equal(started.length, 2, "Should start a new compiler");
        assert.equal(result.css, "/* /styles/two.scss */");
        assert.deepEqual(started[1].compiled, ["/styles/two.scss"]);
    });

    test("A compile isn't left waiting when the compiler's process stops", async () => {
        await shared.compile("/styles/one.scss", {});

        // What `sass-embedded` does when its process is ended mid-compile
        started[0].onCompile = () => new Promise(() => undefined);

        const compiling = shared.compile("/styles/two.scss", {});

        await sleep(20);
        started[0].process.emit("exit", null, "SIGKILL");

        const result = await compiling;

        assert.equal(started.length, 2, "Should start a new compiler");
        assert.equal(result.css, "/* /styles/two.scss */");
    });

    test("An error is given when the replacement compiler fails too", async () => {
        const failing = new SharedSassCompiler(async () => {
            const compiler = new FakeCompiler();

            compiler.onCompile = () => Promise.reject(new Error("Broken"));
            started.push(compiler);

            return compiler as unknown as AsyncCompiler;
        });

        await assert.rejects(failing.compile("/styles/one.scss", {}), {
            message: "Broken",
        });

        assert.equal(started.length, 2, "Should only try twice");
    });

    test("`dispose` stops the compiler, and the next compile starts a new one", async () => {
        await shared.compile("/styles/one.scss", {});
        await shared.dispose();

        assert.equal(started[0].isDisposed, true);

        await shared.compile("/styles/two.scss", {});

        assert.equal(started.length, 2);
        assert.equal(started[1].isDisposed, false);
    });

    test("`dispose` does nothing when no compiler is running", async () => {
        await shared.dispose();

        assert.equal(started.length, 0);
    });

    test("An unused compiler is stopped", async () => {
        const idleTimeout = 60,
            short = create(idleTimeout);

        await short.compile("/styles/one.scss", {});

        // Used again before the time is up
        await sleep(idleTimeout / 2);
        await short.compile("/styles/two.scss", {});
        await sleep(idleTimeout / 2);

        assert.equal(started[0].isDisposed, false, "It's still in use");

        await sleep(idleTimeout * 3);

        assert.equal(started[0].isDisposed, true);

        await short.compile("/styles/three.scss", {});

        assert.equal(started.length, 2, "Should start again when needed");

        await short.dispose();
    });

    test("A compiler isn't stopped while it's compiling", async () => {
        const idleTimeout = 40,
            short = create(idleTimeout);

        await short.compile("/styles/one.scss", {});

        started[0].onCompile = async (sassPath) => {
            await sleep(idleTimeout * 4);

            return { css: `/* ${sassPath} */`, loadedUrls: [] };
        };

        const result = await short.compile("/styles/slow.scss", {});

        assert.equal(result.css, "/* /styles/slow.scss */");
        assert.equal(started.length, 1);
        assert.equal(started[0].isDisposed, false);

        await short.dispose();
    });
});

suite("SharedSassCompiler — with the real compiler", function () {
    this.timeout(30000);

    let folder: string, started: AsyncCompiler[], shared: SharedSassCompiler;

    function childProcess(compiler: AsyncCompiler): ChildProcess {
        const child = getCompilerProcess(compiler);

        assert.ok(child, "Can't get at the process of the compiler");

        return child;
    }

    /** Fails, instead of waiting for the test to time out */
    function failAfter<T>(ms: number, message: string): Promise<T> {
        return new Promise((_resolve, reject) =>
            setTimeout(() => reject(new Error(message)), ms),
        );
    }

    function isRunning(compiler: AsyncCompiler): boolean {
        const child = childProcess(compiler);

        return child.exitCode === null && child.signalCode === null;
    }

    function write(name: string, content: string): string {
        const fullPath = path.join(folder, name);

        fs.writeFileSync(fullPath, content);

        return fullPath;
    }

    suiteSetup(() => {
        folder = fs.mkdtempSync(path.join(os.tmpdir(), "live-sass-shared-"));
    });

    setup(() => {
        started = [];
        shared = new SharedSassCompiler(async () => {
            const compiler = await initAsyncCompiler();

            started.push(compiler);

            return compiler;
        });
    });

    teardown(() => shared.dispose());

    suiteTeardown(() => fs.rmSync(folder, { recursive: true, force: true }));

    test("Fifty files are compiled by a single process", async () => {
        const files = Array.from({ length: 50 }, (_value, index) =>
            write(`file${index}.scss`, `.file${index} { order: ${index} }`),
        );

        const results = await Promise.all(
            files.map((file) => shared.compile(file, { style: "compressed" })),
        );

        assert.equal(started.length, 1, "Should only start one process");
        results.forEach((result, index) =>
            assert.equal(result.css, `.file${index}{order:${index}}`),
        );
    });

    test("An error in the Sass doesn't stop the process", async () => {
        await assert.rejects(
            shared.compile(write("bad.scss", "a { b: }"), {}),
            (err) => err instanceof Exception,
        );
        await assert.rejects(
            shared.compile(path.join(folder, "missing.scss"), {}),
            (err) => err instanceof Exception,
        );

        const result = await shared.compile(write("good.scss", "a { b: c }"), {
            style: "compressed",
        });

        assert.equal(result.css, "a{b:c}");
        assert.equal(started.length, 1);
        assert.ok(isRunning(started[0]));
    });

    test("Compiling carries on after the process is ended", async () => {
        const file = write("carry-on.scss", "a { b: c }");

        await shared.compile(file, {});

        // Someone ends the process (from the task manager, for example)
        const ended = new Promise((resolve) =>
            childProcess(started[0]).once("exit", resolve),
        );

        childProcess(started[0]).kill();
        await ended;

        const result = await shared.compile(file, { style: "compressed" });

        assert.equal(result.css, "a{b:c}");
        assert.equal(started.length, 2, "Should have started a new process");
    });

    /*
     * The next two tests guard against a change inside `sass-embedded`.
     *
     * Knowing that the process has stopped relies on a property that isn't
     * part of their public API. If an update renames or removes it then
     * nothing would error: compiles would just start waiting forever again
     * whenever the process is ended part way through one.
     */

    test("The process of the compiler from `sass-embedded` can be got at", async () => {
        const compiler = await initAsyncCompiler();

        try {
            const child = getCompilerProcess(compiler);

            assert.ok(
                child,
                "`sass-embedded` has changed: its compiler no longer has a " +
                    "`process`. `getCompilerProcess` (SharedSassCompiler.ts) " +
                    "needs updating to find it again",
            );
            assert.equal(
                typeof child.pid,
                "number",
                "`process` should be the running compiler process",
            );
            assert.equal(typeof child.kill, "function");
        } finally {
            await compiler.dispose();
        }
    });

    test("A compile isn't left waiting when the process is ended part way through", async () => {
        const dependency = write("_ended-dep.scss", ".dep { e: f }"),
            file = write("ended.scss", '@use "ended:dep";\n\na { b: c }');

        // Make sure a process is running before the compile below
        await shared.compile(write("warm-up.scss", "a { b: c }"), {});

        const firstProcess = childProcess(started[0]);

        let wasEnded = false;

        const compiling = shared.compile(file, {
            style: "compressed",
            importers: [
                {
                    // The compiler asks for this file in the middle of the
                    // compile, which is when its process gets ended
                    findFileUrl: (url) => {
                        if (!url.startsWith("ended:")) {
                            return null;
                        }

                        if (!wasEnded) {
                            wasEnded = true;
                            firstProcess.kill();
                        }

                        return pathToFileURL(dependency);
                    },
                },
            ],
        });

        const result = await Promise.race([
            compiling,
            failAfter<never>(
                10000,
                "The compile was left waiting after its process was ended. " +
                    "Has `sass-embedded` changed? See `getCompilerProcess` " +
                    "(SharedSassCompiler.ts)",
            ),
        ]);

        assert.ok(wasEnded, "The process should've been ended mid-compile");
        assert.equal(result.css, ".dep{e:f}a{b:c}");
        assert.equal(started.length, 2, "Should have started a new process");
    });

    test("`dispose` ends the process", async () => {
        await shared.compile(write("dispose.scss", "a { b: c }"), {});

        assert.ok(isRunning(started[0]));

        await shared.dispose();

        assert.ok(!isRunning(started[0]), "The process should have ended");
    });
});
