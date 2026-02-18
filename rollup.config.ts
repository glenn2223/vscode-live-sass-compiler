import { RollupOptions } from "rollup";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import json from "@rollup/plugin-json";
import commonjs from "@rollup/plugin-commonjs";

const isTest = process.env.TESTING !== undefined;

console.log(`Building for ${isTest ? "testing" : "production"}...`);

export default {
    input: "src/extension.ts",
    external: "vscode",
    output: [
        {
            file: "out/extension.js",
            format: "cjs",
            sourcemap: isTest,
            compact: true,
            plugins: [
                {
                    name: "navigtorFix",
                    renderChunk(code) {
                        return {
                            code: `var navigator=null!==navigator&&void 0!==navigator?navigator:navigator={userAgent:null};${code}`,
                            map: null,
                        };
                    },
                },
            ],
        },
    ],
    plugins: [
        typescript({ sourceMap: isTest, tsconfig: "src/tsconfig.rollup.json" }),
        json(),
        terser({ format: { comments: false } }),
        commonjs({
            ignoreDynamicRequires: true,
            sourceMap: false,
        }),
        nodeResolve(),
    ],
} as RollupOptions;
