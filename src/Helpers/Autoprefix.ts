import autoprefixer from "autoprefixer";
import postcss from "postcss";
import { OutputWindow } from "../VsCode/OutputWindow";
import { OutputLevel } from "../Enums/OutputLevel";

/**
 * Autoprefix CSS properties
 */
export async function autoprefix(
    css: string,
    map: string | undefined,
    savePath: string,
    browsers: string | Array<string> | true,
    generateMap: boolean
): Promise<{ css: string; map: string | null }> {
    OutputWindow.Show(OutputLevel.Trace, "Preparing autoprefixer");

    const prefixer = postcss(
        autoprefixer({
            overrideBrowserslist: browsers === true ? undefined : browsers,
        })
    );

    // TODO: REMOVE - when autoprefixer can stop caching the browsers
    const oldBrowserlistCache = process.env.BROWSERSLIST_DISABLE_CACHE;

    if (browsers === true) {
        process.env.BROWSERSLIST_DISABLE_CACHE = "1";

        OutputWindow.Show(
            OutputLevel.Trace,
            "Changing BROWSERSLIST_DISABLE_CACHE setting",
            [`Was: ${oldBrowserlistCache ?? "UNDEFINED"}`, "Now: 1"]
        );
    }

    try {
        OutputWindow.Show(OutputLevel.Trace, "Starting autoprefixer");

        const result = await prefixer.process(css, {
            from: savePath,
            to: savePath,
            map: {
                inline: false,
                prev: map,
                annotation: false,
            },
        });

        result.warnings().forEach((warn) => {
            const body: string[] = [];

            if (warn.node.source?.input.file) {
                body.push(
                    warn.node.source.input.file + `:${warn.line}:${warn.column}`
                );
            }

            body.push(warn.text);

            OutputWindow.Show(
                warn.type === "warning"
                    ? OutputLevel.Warning
                    : OutputLevel.Error,
                `Autoprefix ${warn.type || "error"}`,
                body
            );
        });

        OutputWindow.Show(OutputLevel.Trace, "Completed autoprefixer");

        return {
            css: result.css,
            map: generateMap ? result.map.toString() : null,
        };
    } finally {
        if (browsers === true) {
            process.env.BROWSERSLIST_DISABLE_CACHE = oldBrowserlistCache;

            OutputWindow.Show(
                OutputLevel.Trace,
                `Restored BROWSERSLIST_DISABLE_CACHE to: ${
                    oldBrowserlistCache ?? "UNDEFINED"
                }`
            );
        }
    }
}
