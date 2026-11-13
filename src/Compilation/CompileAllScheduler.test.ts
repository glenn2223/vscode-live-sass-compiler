import * as assert from "assert";
import * as vscode from "vscode";
import { CompileAllScheduler } from "./CompileAllScheduler";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function fakeFolder(name: string, index = 0): vscode.WorkspaceFolder {
    return { uri: vscode.Uri.file(`/workspaces/${name}`), name, index };
}

suite("CompileAllScheduler", function () {
    const quietPeriod = 40,
        maxWait = 300;

    /** Every compile the scheduler ran, in order */
    let compiles: { folders: string[] | undefined; triggers: string[] }[];

    /** How long each (fake) compile takes */
    let compileTime: number;

    /** The highest number of compiles that were running at one time */
    let mostAtOnce: number;

    let scheduler: CompileAllScheduler;

    setup(() => {
        let running = 0;

        compiles = [];
        compileTime = 0;
        mostAtOnce = 0;

        scheduler = new CompileAllScheduler(
            async (folders, triggers) => {
                mostAtOnce = Math.max(mostAtOnce, ++running);

                compiles.push({
                    folders: folders?.map((folder) => folder.name).sort(),
                    triggers: [...triggers].sort(),
                });

                await sleep(compileTime);

                running--;
            },
            quietPeriod,
            maxWait,
        );
    });

    teardown(() => scheduler.cancel());

    test("A single request compiles once, after the quiet period", async () => {
        scheduler.request("/a/_one.scss");

        assert.equal(compiles.length, 0, "Shouldn't compile straight away");

        await sleep(quietPeriod * 4);

        assert.deepEqual(compiles, [
            { folders: undefined, triggers: ["/a/_one.scss"] },
        ]);
    });

    test("A burst of requests compiles once", async () => {
        for (let i = 0; i < 30; i++) {
            scheduler.request(`/a/_file${i % 3}.scss`);
        }

        await sleep(quietPeriod * 4);

        assert.deepEqual(compiles, [
            {
                folders: undefined,
                triggers: [
                    "/a/_file0.scss",
                    "/a/_file1.scss",
                    "/a/_file2.scss",
                ],
            },
        ]);
    });

    test("Requests for different folders compile just those folders, together", async () => {
        const one = fakeFolder("one"),
            two = fakeFolder("two", 1);

        scheduler.request("/workspaces/one/_a.scss", one);
        scheduler.request("/workspaces/two/_b.scss", two);
        scheduler.request("/workspaces/one/_c.scss", one);

        await sleep(quietPeriod * 4);

        assert.deepEqual(compiles, [
            {
                folders: ["one", "two"],
                triggers: [
                    "/workspaces/one/_a.scss",
                    "/workspaces/one/_c.scss",
                    "/workspaces/two/_b.scss",
                ],
            },
        ]);
    });

    test("A request without a folder compiles every folder", async () => {
        scheduler.request("/workspaces/one/_a.scss", fakeFolder("one"));
        scheduler.request("/elsewhere/_b.scss");

        await sleep(quietPeriod * 4);

        assert.equal(compiles.length, 1);
        assert.strictEqual(compiles[0].folders, undefined);
    });

    test("Requests made while compiling share one compile that follows it", async () => {
        compileTime = quietPeriod * 5;

        scheduler.request("/a/_first.scss");

        // Wait for the compile to start
        await sleep(quietPeriod * 2);
        assert.equal(compiles.length, 1);

        scheduler.request("/a/_second.scss");
        scheduler.request("/a/_third.scss");

        await sleep(compileTime * 3);

        assert.deepEqual(
            compiles.map((compile) => compile.triggers),
            [["/a/_first.scss"], ["/a/_second.scss", "/a/_third.scss"]],
        );
        assert.equal(mostAtOnce, 1, "Compiles shouldn't overlap");
    });

    test("A steady stream of requests doesn't wait forever", async () => {
        const streamFor = maxWait * 2.5,
            startedAt = Date.now();

        while (Date.now() - startedAt < streamFor) {
            scheduler.request("/a/_busy.scss");

            await sleep(quietPeriod / 4);
        }

        assert.ok(
            compiles.length >= 1,
            "Should've compiled while the requests were still arriving",
        );
        assert.ok(
            compiles.length <= 3,
            `Should've merged the requests (compiled ${compiles.length} times)`,
        );
    });

    test("`covers` is true for the folders that are waiting to be compiled", async () => {
        const one = fakeFolder("one"),
            two = fakeFolder("two", 1);

        assert.equal(scheduler.covers(one), false);

        scheduler.request("/workspaces/one/_a.scss", one);

        assert.equal(scheduler.covers(one), true);
        assert.equal(scheduler.covers(two), false);

        scheduler.request("/elsewhere/_b.scss");

        assert.equal(scheduler.covers(two), true);

        await sleep(quietPeriod * 4);

        assert.equal(
            scheduler.covers(one),
            false,
            "Nothing is waiting once it has compiled",
        );
    });

    test("A cancelled request never compiles", async () => {
        scheduler.request("/a/_one.scss");
        scheduler.cancel();

        await sleep(quietPeriod * 4);

        assert.equal(compiles.length, 0);
        assert.equal(scheduler.covers(fakeFolder("one")), false);
    });

    test("A failed compile doesn't stop later ones", async () => {
        let calls = 0;

        const failing = new CompileAllScheduler(
            async () => {
                if (++calls === 1) {
                    throw new Error("Failed on purpose");
                }
            },
            quietPeriod,
            maxWait,
        );

        failing.request("/a/_one.scss");
        await sleep(quietPeriod * 4);

        failing.request("/a/_two.scss");
        await sleep(quietPeriod * 4);

        assert.equal(calls, 2);
    });
});
