# FAQs

> ℹ️ **Struggling with something?**  
> There's a video with an intro, preview and overview of settings. Watch it on [YouTube](https://youtu.be/6Wo3mYBLNyA) now!

Click a question to reveal its answer

<details>
<summary>
  <h2>I'm migrating from Ritwick Dey's extension, what do I need to know?</h2>
</summary>

Well, **lots of things**.

Firstly, welcome! I'm glad you're here!

Here's some of the most important changes:

-   We now require VS Code version 1.74
-   We are no longer dependant on `ritwickdey.LiveServer`. You can manually add this package to VS Code, if you need it
-   We are using a quicker type of SASS
-   Some settings have been changed
    -   `formats[]`:
        -   `format` only accepts `compressed` or `expanded`
        -   `extensionName` allows any string that ends in `.css` - and contains no path separators - meaning that `-min.css` is now valid
    -   `autoprefix`:
        -   The default is `defaults`
        -   `null` is no longer accepted, use `false` instead
        -   When `true` we will find a `.browserslistrc` file or `browserslist` in your `package.json`. No more duplicating settings!
    -   `showOutputWindow` is now `showOutputWindowOn` and uses log values (`Debug`, `Error`, etc.). It's default log level is `Information` - at this level it will output the same information that the original extension does
-   Some settings are new!
    -   `formats[]`:
        -   `savePathReplacementPairs`: replace segments in the output path
        -   `generateMap`: generate map files at a format level (overwriting the top-tier setting of the same name)
    -   `watchOnLaunch`: state whether you want to watch files upon launch
    -   `compileOnWatch`: state if files should be compiled upon watching
    -   `forceBaseDirectory`: state the base directory of all you SASS files. Aids in reducing wasted resources while searching for files
    -   `partialsList`: specify what files are actually partials (or which folders contain them)

Here are some things you probably won't care about as much

-   The extension has had a massive overhaul. Performance optimisation, and new features!
-   The quicker SASS package is `sass-embedded`. This utilises DartSass directly - rather than a JS interpreted version
-   We abandoned `glob` (the package, not the patterns) and we now use `fdir` which is blazingly fast
-   New commands!
    -   `liveSass.command.compileCurrentSass`: perform a one-time compilation of the current SASS file
    -   `liveSass.command.createIssue`: opens a link to create a new issue in GutHub. If an unexpected error occurred then error information is readily available to paste into the new issue
    -   `liveSass.command.debugInclusion`: check if the current SASS file will be included, based on your settings
    -   `liveSass.command.debugFileList`: get a full list of files that are included and excluded
    -   Various commands to change the log level (meaning you can key bind them)
-   We support multi-root/multi-folder workspaces
-   Map files now link back to the correct line after `autoprefixer` has been applied
-   Clicking the status bar icon while in the `Success` or `Error` state will show the output window

</details>

<details>
<summary>
  <h2>How do I change the settings?</h2>
</summary>

Create a `.vscode` folder in the root of your project. Inside the `.vscode` folder create a JSON file named `settings.json`.

Open the `settings.json` file and type following key-value pairs. _By the way, you'll get intellisense!_

```json
{
    "liveSassCompile.settings.formats": [
        {
            "format": "expanded",
            "extensionName": ".css",
            "savePath": "/css"
        },
        {
            "extensionName": ".min.css",
            "format": "compressed",
            "savePath": "/dist/css"
        }
    ],
    "liveSassCompile.settings.excludeList": [
        "**/node_modules/**",
        ".vscode/**"
    ],
    "liveSassCompile.settings.generateMap": true,
    "liveSassCompile.settings.autoprefix": ["defaults"]
}
```

</details>

<details>
<summary>
  <h2>Why isn't it starting?</h2>
</summary>

If the extension doesn't activate (show up in the status bar), then it's most likely that you don't have any `.scss` or`.sass` files in your project.

Just create a SASS file, or open one, and the extension will activate

Alternatively, if you're working with `.sass` files, you may not have the [SASS extension](https://marketplace.visualstudio.com/items?itemName=Syler.sass-indented) installed. Install it so VS Code can identify `.sass` files and activate the extension.

</details>

<details>
<summary>
  <h2>Why are my files not compiling?</h2>
</summary>

A common issue is incorrectly configured glob patterns used in the include/exclude settings. You can check your glob patterns [here](https://globster.xyz/) (_be aware that this site doesn't match all [picomatch expressions](https://github.com/micromatch/picomatch#library-comparisons)_).

Still having problems? Try the below steps

1. Open the command palette by pressing <kbd>F1</kbd> or (<kbd>Ctrl</kbd>/<kbd>Cmd</kbd>) + <kbd>Shift</kbd> + <kbd>P</kbd>
1. Run `liveSass.command.debugInclusion`, this will open the output and tell you if the file is included based on your settings
1. If you can't resolve the issue with the information present then move on below
1. Next run `liveSass.command.debugFileList`
1. Try to resolve your issue using the returned information in the output

Still no luck?

1. Run `liveSass.command.createIssue`
1. Information is automatically placed in your clipboard and your browser will open a new window
1. Please make sure to paste the information, which is now in your clipboard, into the location stated. Also include the information returned by the `liveSass.command.debugFileList` command from step 4 above

</details>

<details>
<summary>
  <h2>So... about multi-root workspaces?</h2>
</summary>

### What is it?

A multi-root workspaces is a project that gives you access to a folder at `C:/a/b/c` and `C:/x/y/z` - all from one VS Code window!

By doing this, and when an extension is configured for it, you can have independent settings for each project. But don't worry, you don't need to duplicate settings! Default settings can be placed in the `.code-workspace` - these are then ignored if the same settings exists in a workspace folder's `settings.json`.

_Note: Each workspace folder must have a `.vscode` folder with a `settings.json` file for the settings to overwrite the workspace defaults._

### I like it! how do I set one up?

When you open any folder in VS Code it is essentially a "single-root" workspace.

First, right click (left click on mac) in some open space on the `Explorer` tab. You will see an option to `Add folder to workspace`. After you click this, you can choose to add a folder to your project that's in any location on your machine. By doing this VS Code will create a `.code-workspace` file. This creates an actual workspace - well, in this case, a "multi-root" workspace.

### Okay, so what settings can I use?

The following settings can all be made available to each workspaces `settings.json` file.

-   `liveSassCompile.settings.formats`
-   `liveSassCompile.settings.excludeList`
-   `liveSassCompile.settings.includeItems`
-   `liveSassCompile.settings.generateMap`
-   `liveSassCompile.settings.autoprefix`
-   `liveSassCompile.settings.forceBaseDirectory`
-   `liveSassCompile.settings.partialsList`

</details>
