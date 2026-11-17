// Checks that an unpacked universal VSIX can compile Sass with nothing but
// the files inside it.
//
// The universal VSIX has no native Sass compiler, so the extension uses the
// pure JS `sass` package from the VSIX's own `node_modules`. If that package,
// or one it depends on, is left out then nothing can be compiled.
//
// Usage: node .github/scripts/check-universal-vsix.js <unpacked VSIX folder>
// Unpack it outside of this repository, or Node finds the missing packages
// in the repository's `node_modules` instead.

const fs = require("fs");
const path = require("path");

const [unpackedFolder] = process.argv.slice(2);

if (!unpackedFolder) {
    throw new Error("Pass the folder that the VSIX was unpacked into");
}

const modulesFolder = path.resolve(unpackedFolder, "extension", "node_modules");

const nativeCompilers = fs
    .readdirSync(modulesFolder)
    .filter((name) => name.startsWith("sass-embedded-"));

if (nativeCompilers.length > 0) {
    throw new Error(
        `A universal VSIX shouldn't contain a native compiler: ${nativeCompilers.join(", ")}`,
    );
}

const { css } = require(path.join(modulesFolder, "sass")).compileString(
    "a { b: c }",
    { style: "compressed" },
);

if (css !== "a{b:c}") {
    throw new Error(`The pure JS compiler gave unexpected CSS: ${css}`);
}

console.log("The universal VSIX can compile Sass with the pure JS compiler");
