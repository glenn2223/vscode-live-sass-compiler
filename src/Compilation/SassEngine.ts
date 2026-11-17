import type * as PureJsSass from "sass";
import type { CompileResult, Options } from "sass-embedded";
import { SharedSassCompiler } from "./SharedSassCompiler";

/** Something that turns Sass into CSS */
export interface ISassEngine {
    readonly name: "native" | "pure JS";

    compile(
        sassPath: string,
        options: Options<"async">,
    ): Promise<CompileResult>;

    /** Frees anything the engine is holding on to (it can be used again) */
    dispose(): Promise<void>;
}

/**
 * Whether `sass-embedded` has a compiler that can run on this machine.
 *
 * Its compilers come as separate packages, one for each platform (those in
 * the `optionalDependencies` of `sass-embedded`). A VSIX built for a platform
 * contains the matching one and the universal VSIX contains none.
 */
export function hasNativeCompiler(
    resolve: (id: string) => string = require.resolve,
    platform: string = process.platform,
    arch: string = process.arch,
): boolean {
    // Linux has a package for each of the C libraries that are in use
    const platforms =
        platform === "linux" ? ["linux", "linux-musl"] : [platform];

    return platforms.some((name) => {
        try {
            resolve(`sass-embedded-${name}-${arch}/package.json`);

            return true;
        } catch {
            return false;
        }
    });
}

/** The pure JS `sass` package, when it's installed (the universal VSIX) */
export function loadPureJsSass(
    load: (id: string) => unknown = require,
): typeof PureJsSass | undefined {
    try {
        return load("sass") as typeof PureJsSass;
    } catch {
        return undefined;
    }
}

/**
 * Picks how Sass gets compiled:
 *  - With the native compiler from `sass-embedded`, whenever there is one
 *  - Otherwise with the pure JS `sass` package, which runs anywhere but is
 *    slower. `sass-embedded` can't do this itself: the only fallback it has
 *    is to run `sass --embedded`, and pure JS `sass` doesn't support that
 */
export function createSassEngine(
    isNativeAvailable = hasNativeCompiler(),
    getPureJsSass: () => typeof PureJsSass | undefined = loadPureJsSass,
): ISassEngine {
    const pureJsSass = isNativeAvailable ? undefined : getPureJsSass();

    if (pureJsSass) {
        return {
            name: "pure JS",
            // Both packages implement the same API, they just don't share
            // their types. It runs inside this process: nothing to dispose
            compile: (sassPath, options) =>
                pureJsSass.compileAsync(
                    sassPath,
                    options as unknown as PureJsSass.Options<"async">,
                ) as unknown as Promise<CompileResult>,
            dispose: () => Promise.resolve(),
        };
    }

    const sharedCompiler = new SharedSassCompiler();

    return {
        name: "native",
        compile: (sassPath, options) =>
            sharedCompiler.compile(sassPath, options),
        dispose: () => sharedCompiler.dispose(),
    };
}
