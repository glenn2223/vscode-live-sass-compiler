import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as pureJsSass from "sass";
import {
    createSassEngine,
    hasNativeCompiler,
    loadPureJsSass,
} from "./SassEngine";

/** A `require.resolve` that only knows about the given packages */
function resolverFor(...installed: string[]): (id: string) => string {
    return (id) => {
        if (installed.some((name) => id === `${name}/package.json`)) {
            return `/node_modules/${id}`;
        }

        throw new Error(`Cannot find module '${id}'`);
    };
}

suite("SassEngine.hasNativeCompiler", function () {
    test("True when the package for the platform is installed", () => {
        assert.equal(
            hasNativeCompiler(
                resolverFor("sass-embedded-win32-x64"),
                "win32",
                "x64",
            ),
            true,
        );
    });

    test("False when only another platform's package is installed", () => {
        assert.equal(
            hasNativeCompiler(
                resolverFor(
                    "sass-embedded-linux-x64",
                    "sass-embedded-win32-arm64",
                ),
                "win32",
                "x64",
            ),
            false,
        );
    });

    test("False when no package is installed (the universal VSIX)", () => {
        assert.equal(
            hasNativeCompiler(resolverFor(), "darwin", "arm64"),
            false,
        );
    });

    test("On Linux, either C library's package counts", () => {
        assert.equal(
            hasNativeCompiler(
                resolverFor("sass-embedded-linux-musl-arm64"),
                "linux",
                "arm64",
            ),
            true,
        );
        assert.equal(
            hasNativeCompiler(
                resolverFor("sass-embedded-linux-arm64"),
                "linux",
                "arm64",
            ),
            true,
        );
    });

    test("The package names still match those `sass-embedded` installs", () => {
        // If `sass-embedded` renames its platform packages this fails,
        // rather than every platform quietly using the pure JS compiler
        const optional = Object.keys(
            JSON.parse(
                fs.readFileSync(
                    path.join(
                        path.dirname(require.resolve("sass-embedded")),
                        "..",
                        "..",
                        "package.json",
                    ),
                    "utf8",
                ),
            ).optionalDependencies,
        );

        [
            "win32-x64",
            "win32-arm64",
            "linux-x64",
            "linux-arm64",
            "linux-arm",
            "linux-musl-x64",
            "linux-musl-arm64",
            "darwin-x64",
            "darwin-arm64",
        ].forEach((target) =>
            assert.ok(
                optional.includes(`sass-embedded-${target}`),
                `sass-embedded no longer has a "sass-embedded-${target}" package`,
            ),
        );
    });
});

suite("SassEngine.loadPureJsSass", function () {
    test("Gives the package when it's installed", () => {
        assert.equal(typeof loadPureJsSass()?.compileAsync, "function");
    });

    test("Gives nothing when it isn't installed (a platform's VSIX)", () => {
        assert.strictEqual(
            loadPureJsSass(() => {
                throw new Error("Cannot find module 'sass'");
            }),
            undefined,
        );
    });
});

suite("SassEngine.createSassEngine", function () {
    this.timeout(20000);

    let folder: string, sassPath: string;

    suiteSetup(() => {
        folder = fs.mkdtempSync(path.join(os.tmpdir(), "live-sass-engine-"));
        sassPath = path.join(folder, "engine.scss");

        fs.writeFileSync(path.join(folder, "_dep.scss"), "$colour: red;");
        fs.writeFileSync(
            sassPath,
            '@use "dep";\n\n.a {\n    .b { color: dep.$colour; }\n}\n',
        );
    });

    suiteTeardown(() => fs.rmSync(folder, { recursive: true, force: true }));

    test("The native compiler is used whenever there is one", async () => {
        const engine = createSassEngine(true, () => pureJsSass);

        assert.equal(engine.name, "native");

        await engine.dispose();
    });

    test("The pure JS compiler is used when there's no native compiler", () => {
        assert.equal(createSassEngine(false, () => pureJsSass).name, "pure JS");
    });

    test("The native compiler is still tried when neither can be found", () => {
        // Its error is then the one that gets shown
        assert.equal(createSassEngine(false, () => undefined).name, "native");
    });

    test("The pure JS compiler compiles a file, with a source map", async () => {
        const engine = createSassEngine(false, () => pureJsSass),
            result = await engine.compile(sassPath, {
                style: "compressed",
                sourceMap: true,
            });

        assert.equal(result.css, ".a .b{color:red}");
        assert.ok(
            result.sourceMap?.sources.some((source) =>
                source.endsWith("engine.scss"),
            ),
            "The source map should point back to the Sass file",
        );

        await engine.dispose();
    });

    test("The pure JS compiler reports errors in the Sass", async () => {
        const badPath = path.join(folder, "bad.scss");

        fs.writeFileSync(badPath, "a { b: }");

        await assert.rejects(
            createSassEngine(false, () => pureJsSass).compile(badPath, {}),
            /Expected expression/,
        );
    });

    test("Both compilers give the same CSS", async function () {
        if (!hasNativeCompiler()) {
            this.skip();
        }

        const native = createSassEngine(true),
            pureJs = createSassEngine(false, () => pureJsSass);

        try {
            for (const style of ["expanded", "compressed"] as const) {
                assert.equal(
                    (await pureJs.compile(sassPath, { style })).css,
                    (await native.compile(sassPath, { style })).css,
                    style,
                );
            }
        } finally {
            await native.dispose();
        }
    });
});
