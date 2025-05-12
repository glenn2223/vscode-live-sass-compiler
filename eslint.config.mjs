import { defineConfig, globalIgnores } from "eslint/config";

import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import js from "@eslint/js";

import { FlatCompat } from "@eslint/eslintrc";

import { fileURLToPath } from "url";
import path from "path";

// Fix for __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

export default defineConfig([
    {
        languageOptions: {
            globals: {
                ...globals.node,
            },

            parser: tsParser,
            ecmaVersion: 2020,
            sourceType: "module",
            parserOptions: {},
        },

        extends: compat.extends(
            "eslint:recommended",
            "plugin:@typescript-eslint/recommended"
        ),

        rules: {
            semi: ["error", "always"],
            curly: "error",
            "no-unused-vars": "off",
            "no-cond-assign": ["error", "always"],
            "no-console": "off",
            "@typescript-eslint/ban-ts-comment": "off",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    args: "all",
                    argsIgnorePattern: "^_",
                    caughtErrors: "all",
                    caughtErrorsIgnorePattern: "^_",
                    destructuredArrayIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    ignoreRestSiblings: true,
                },
            ],
            "@typescript-eslint/no-non-null-assertion": "off",
        },
    },
    globalIgnores(["**/node_modules", "**/out"]),
]);
