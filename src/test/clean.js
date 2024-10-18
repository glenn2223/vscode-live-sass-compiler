/* eslint-disable @typescript-eslint/no-var-requires */
var fs = require("fs");

function deleteFolderRecursive(path) {
    if (!fs.existsSync(path)) {
        return console.log(`${path} does not exist!`);
    }

    if (fs.existsSync(path) && fs.lstatSync(path).isDirectory()) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        fs.readdirSync(path).forEach(function (file, _index) {
            var curPath = path + "/" + file;

            if (fs.lstatSync(curPath).isDirectory()) {
                // recurse
                deleteFolderRecursive(curPath);
            } else {
                // delete file
                fs.unlinkSync(curPath);
            }
        });

        console.log(`Deleting directory "${path}"...`);
        fs.rmdirSync(path);
    }
}

var pathArgs = process.argv.slice(2);

if (pathArgs.length < 1) {
    return console.warn(
        "Please enter paths as arguments, for the folders you want to delete recursively. \nExample script invokation: node scripts/clean.js ./release"
    );
}

console.log("Cleaning working tree...");

pathArgs.forEach((pathToDelete) => deleteFolderRecursive(pathToDelete));

console.log("Successfully cleaned working tree!");
