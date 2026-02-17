# Live Sass Compiler
Live Sass Compiler is a VS Code extension for compiling SASS/SCSS files to CSS in real-time. It's written in TypeScript and uses sass-embedded for fast compilation.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively
- Bootstrap, build, and test the repository:
  - Ensure you have Node.js 20.x: `node --version` (should show v20.x.x)
  - `npm ci` -- takes ~14 seconds. Installs exact dependencies from package-lock.json
  - `npm run lint` -- takes ~1.5 seconds. Runs ESLint on TypeScript source files
  - `npm run rollup` -- takes ~15 seconds. Builds the extension bundle. NEVER CANCEL - Set timeout to 60+ seconds
  - `npm run vscode:prepublish` -- takes ~16 seconds. Full build pipeline (clean + lint + rollup). NEVER CANCEL - Set timeout to 60+ seconds
- Test the build without VS Code integration:
  - `npm run pretest` -- takes ~21 seconds. Compiles tests and builds test version. NEVER CANCEL - Set timeout to 60+ seconds
  - Full VS Code integration tests require downloading VS Code and may fail in restricted environments
- Validate SASS compilation functionality:
  - Test sass-embedded directly: `npx sass-embedded input.scss output.css`
  - Create test SASS: `echo '$color: #333; body { color: $color; }' > test.scss`
  - Compile it: `npx sass-embedded test.scss test.css && cat test.css`

## Key Build Commands and Timing
- **CRITICAL**: All build commands can take 15+ seconds. NEVER CANCEL builds. Always set timeouts to 60+ minutes for any rollup/build command.
- `npm ci`: ~14 seconds - Clean dependency install
- `npm run lint`: ~1.5 seconds - ESLint check
- `npm run rollup`: ~15 seconds - Production build bundle (creates out/extension.js)
- `npm run rollup-testing`: ~15 seconds - Test build with source maps
- `npm run vscode:prepublish`: ~16 seconds - Full build pipeline for publishing
- `npm run pretest`: ~21 seconds - Prepares test environment
- `npm test`: Requires VS Code download, may fail in restricted environments

## Validation
- Always manually validate SASS compilation using sass-embedded directly when making changes to compilation logic.
- ALWAYS run through the complete build pipeline after making changes: `npm run vscode:prepublish`
- You cannot fully test the VS Code extension UI in headless environments, but you can validate the core compilation functionality.
- Always run `npm run lint` before you are done or the CI (.github/workflows/test.yml) will fail.
- **Extension Testing Scenarios**: 
  1. Create a .scss file with variables and nesting
  2. Test compilation with `npx sass-embedded input.scss output.css`
  3. Verify CSS output includes compiled variables and flattened nesting
  4. Test autoprefixer functionality if modified

## Common Tasks

### Repository Structure
```
/
├── .github/workflows/     # CI/CD pipelines (test.yml, publish.yml)
├── .vscode/              # VS Code config (launch.json, tasks.json, settings.json)
├── docs/                 # Documentation (faqs.md, settings.md)
├── src/                  # Source code
│   ├── extension.ts      # Main extension entry point
│   ├── appModel.ts       # Core application logic
│   ├── Helpers/          # Utility classes (SassHelper, FileHelper, SettingsHelper)
│   ├── VsCode/           # VS Code integration (OutputWindow, StatusbarUi)
│   ├── Interfaces/       # TypeScript interfaces
│   ├── Enums/            # TypeScript enums
│   └── test/             # Test files and sample workspace
├── out/                  # Build output (generated)
├── package.json          # Dependencies and npm scripts
├── rollup.config.ts      # Build configuration
├── tsconfig.json         # TypeScript configuration
└── eslint.config.mjs     # ESLint configuration
```

### Key Source Files to Know
- `src/extension.ts`: Main extension activation and command registration
- `src/appModel.ts`: Core SASS compilation and file watching logic
- `src/Helpers/SassHelper.ts`: SASS compilation wrapper using sass-embedded
- `src/Helpers/FileHelper.ts`: File system operations and glob pattern matching
- `src/VsCode/StatusbarUi.ts`: VS Code status bar integration
- `src/VsCode/OutputWindow.ts`: Extension output logging
- `rollup.config.ts`: Build bundling configuration
- `package.json`: Commands, dependencies, and VS Code extension manifest

### Development Workflow
1. Make code changes
2. Run `npm run lint` to check for style issues
3. Run `npm run rollup` to build and verify no compilation errors
4. Test SASS compilation directly if modifying compilation logic
5. Run `npm run vscode:prepublish` for full validation
6. Use VS Code's "Launch Extension" debugger config for manual testing (requires VS Code)

### Dependencies
- **sass-embedded**: Main SASS compiler (fast, uses Dart Sass directly)
- **fdir**: Fast directory traversal for finding SASS files
- **picomatch**: Glob pattern matching for include/exclude logic
- **autoprefixer + postcss**: CSS vendor prefix automation
- **rollup**: Module bundler for creating single extension.js file
- **typescript**: Language and compiler
- **eslint**: Code linting and style enforcement

### Extension Configuration
The extension uses VS Code settings in the `liveSassCompile.*` namespace:
- `liveSassCompile.settings.formats`: Output CSS format configurations
- `liveSassCompile.settings.watchOnLaunch`: Auto-start watching
- `liveSassCompile.settings.compileOnWatch`: Compile all files when starting
- `liveSassCompile.settings.excludeList`: Glob patterns for excluded files
- `liveSassCompile.settings.includeItems`: Specific files to include
- See `docs/settings.md` for complete configuration reference

### Testing Approach
- **Unit Tests**: Focus on individual helper functions and utilities
- **Integration Tests**: Test VS Code extension commands and file compilation
- **Manual Testing**: Use sample workspace in `src/test/sample/`
- **Direct SASS Testing**: Use `npx sass-embedded` for compilation validation

### CI/CD
- **GitHub Actions**: `.github/workflows/test.yml` runs on PR and manual triggers
- **Cross-platform**: Tests run on Windows, macOS, and Linux
- **Build Validation**: Ensures `npm run vscode:prepublish` succeeds
- **Publishing**: `.github/workflows/publish.yml` handles VS Code Marketplace releases

### Troubleshooting
- **Build fails**: Check Node.js version (requires 20.x), run `npm ci` to reinstall dependencies
- **Lint errors**: Run `npm run lint` and fix reported issues
- **SASS compilation issues**: Test with `npx sass-embedded` directly to isolate extension vs compiler issues
- **VS Code test failures**: May indicate network restrictions preventing VS Code download

## Notes
- This extension replaces the original Ritwick Dey Live Sass Compiler with performance improvements
- Uses sass-embedded instead of node-sass for faster compilation
- Supports VS Code 1.95.0+ (specified in package.json engines.vscode)
- Has extensive configuration options for output formatting, file watching, and autoprefixing
- Includes comprehensive documentation in docs/ folder