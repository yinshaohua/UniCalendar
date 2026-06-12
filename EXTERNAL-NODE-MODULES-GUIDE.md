# External node_modules guide

This guide documents the reusable external `node_modules` setup used by this project. It is intended for maintainers who want to keep dependency folders out of synced project directories such as OneDrive, while still allowing the project to work as a normal local `node_modules` project by default.

## Behavior

The setup has two modes:

| Mode | How it is selected | Where dependencies live |
|---|---|---|
| Local mode | `EXTERNAL_NODE_MODULES` is not set | `./node_modules` in the project directory |
| External mode | `EXTERNAL_NODE_MODULES` points to a dependency directory | The directory named by `EXTERNAL_NODE_MODULES` |

Use the same install command in both modes:

```powershell
npm run deps:install
```

- In local mode, this behaves like `npm install`.
- In external mode, this installs with `npm --prefix <external-root>` and resolves tools from the external dependency directory.

Do not create a symlink or junction from the project directory back to the external dependency directory. The scripts resolve tools explicitly.

## PowerShell setup

Run the PowerShell Profile function `setenv` from the project root to enable external mode for the current shell session:

```powershell
setenv
```

The Profile function sets:

```powershell
$env:EXTERNAL_NODE_MODULES = "C:/local_data/<project-folder>/node_modules"
$env:NODE_PATH = $env:EXTERNAL_NODE_MODULES
$env:PATH = "<external-node_modules>/.bin;$env:PATH"
```

The project folder name is derived from the current working directory, so the function can be reused in another project without renaming project-specific variables.

## Required files

Copy these files into another project:

```text
scripts/with-external-node-modules.mjs
scripts/external-npm.mjs
scripts/run-tool.mjs
scripts/eslint-loader.mjs
```

Add a reusable `setenv` function to your PowerShell Profile. Then adapt the project configuration files that invoke build, lint, and test tools.

## package.json scripts

Use a wrapper for dependency installation and tool execution:

```json
{
  "scripts": {
    "deps:install": "node scripts/external-npm.mjs install",
    "deps:clean": "node scripts/external-npm.mjs exec -- rimraf node_modules",
    "build": "node scripts/run-tool.mjs tsc -noEmit -skipLibCheck && node esbuild.config.mjs production",
    "lint": "node --import ./scripts/eslint-loader.mjs scripts/run-tool.mjs eslint .",
    "test": "node scripts/run-tool.mjs vitest run --reporter=verbose"
  }
}
```

Adjust the tool names and arguments for the target project. The important rule is that tools normally launched from `node_modules/.bin` should go through `scripts/run-tool.mjs` when external mode must be supported.

## TypeScript

Keep the committed `tsconfig.json` local-first. It should not hardcode an external machine-specific path.

In external mode, `scripts/run-tool.mjs` generates `.tsconfig.external-node-modules.json` at runtime for tools that need TypeScript module/type resolution. Add this generated file to `.gitignore`:

```gitignore
.tsconfig.external-node-modules.json
```

## ESLint

When using TypeScript-aware ESLint configuration, make the config choose the generated external tsconfig only in external mode:

```ts
parserOptions: {
  project: EXTERNAL_MODE ? './.tsconfig.external-node-modules.json' : './tsconfig.json',
  tsconfigRootDir: import.meta.dirname,
}
```

If the ESLint config itself is TypeScript, preload `scripts/eslint-loader.mjs` so ESLint can load the TypeScript config from the selected dependency directory.

## Bundlers and test runners

Tools that perform their own module resolution may need explicit external-mode hints.

For esbuild, add the external dependency directory as a node path only in external mode:

```js
...(EXTERNAL_MODE ? { nodePaths: [EXTERNAL_NODE_MODULES] } : {})
```

For Vitest/Vite, external mode may need aliases or dependency module directories for packages imported by source files:

```ts
resolve: {
  alias: EXTERNAL_MODE ? {
    'some-package': externalRequire.resolve('some-package')
  } : {},
},
test: {
  deps: EXTERNAL_MODE ? {
    moduleDirectories: [EXTERNAL_NODE_MODULES]
  } : {},
}
```

Add only the packages the target project actually needs. Do not blindly copy aliases for unrelated dependencies.

## Migration checklist

1. Copy the required files.
2. Add `.tsconfig.external-node-modules.json` to `.gitignore`.
3. Replace direct tool invocations in `package.json` with the wrappers.
4. Keep committed TypeScript config local-first.
5. Update ESLint, bundler, and test-runner configs only where they need external-mode resolution.
6. Open a new PowerShell session and run local-mode verification:

   ```powershell
   npm run deps:install
   npm run build
   npm test
   npm run lint
   ```

7. Remove local `node_modules` if the goal is to avoid synced dependencies.
8. Open a new PowerShell session and run external-mode verification:

   ```powershell
   setenv
   npm run deps:install
   npm run build
   npm test
   npm run lint
   ```

## Troubleshooting

### The project still uses local node_modules

Check whether the current shell has the variable set:

```powershell
$env:EXTERNAL_NODE_MODULES
```

If it is empty, run the Profile function again from the project root:

```powershell
setenv
```

### A tool starts but cannot resolve packages

The tool likely performs its own module resolution instead of relying only on Node's `require.resolve`. Add an external-mode resolver hint in that tool's config, such as an alias, `nodePaths`, `moduleDirectories`, or a generated TypeScript project file.

### TypeScript or ESLint reports missing types only in external mode

Confirm `.tsconfig.external-node-modules.json` is generated before the tool starts. `scripts/run-tool.mjs` should generate it for `tsc` and ESLint in external mode.

### Git Bash cannot run setenv

`setenv` is a PowerShell Profile function. Run it from PowerShell before npm commands:

```powershell
setenv
```

Git Bash can still run npm scripts after the equivalent environment variables are exported manually, but the reusable setup script is written for PowerShell.
