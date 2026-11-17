// Prints the `.vscodeignore` lines that keep the pure JS `sass` package, and
// every package it needs to run, in a VSIX.
//
// `sass-embedded` falls back to `sass` when there's no compiler for the
// platform, which is what the universal VSIX relies on. Keeping
// `node_modules/sass` alone isn't enough: the packages it depends on can be
// installed beside it (npm decides) and it can't start without them.
//
// Usage: node .github/scripts/sass-fallback-vscodeignore.js >> .vscodeignore

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");

/** Finds an installed package the way Node would from `fromFolder` */
function findPackage(name, fromFolder) {
    for (let folder = fromFolder; ; folder = path.dirname(folder)) {
        const candidate = path.join(folder, "node_modules", name);

        if (fs.existsSync(path.join(candidate, "package.json"))) {
            return candidate;
        }

        if (folder === root || folder === path.dirname(folder)) {
            throw new Error(
                `Can't find "${name}" (needed by ${fromFolder}). Has "npm ci" been run?`,
            );
        }
    }
}

const packageFolders = new Set();

function addPackage(folder) {
    if (packageFolders.has(folder)) {
        return;
    }

    packageFolders.add(folder);

    // Optional dependencies are left out on purpose: they're native, tied to
    // one platform, and `sass` only wants them for its own watch mode
    const { dependencies } = JSON.parse(
        fs.readFileSync(path.join(folder, "package.json"), "utf8"),
    );

    Object.keys(dependencies ?? {}).forEach((name) =>
        addPackage(findPackage(name, folder)),
    );
}

addPackage(findPackage("sass", root));

console.log("");

[...packageFolders]
    .map((folder) => path.relative(root, folder).split(path.sep).join("/"))
    .sort()
    .forEach((folder) => console.log(`!${folder}\n!${folder}/**`));
