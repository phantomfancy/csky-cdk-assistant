# csky-cdk-assistant

Discover and build C-SKY CDK workspaces and projects directly from VS Code.

## Features

- Discover `.cdkws` and `.cdkproj` files.
- Select Workspace, Project, and BuildSet with Quick Pick.
- Build, rebuild, clean, or build all projects using VS Code Tasks.
- Show the active project and BuildSet in the status bar.
- Store project selection in `.vscode/csky-cdk.json`.

## Requirements

The first release supports local Windows workspaces and requires
`cdk-make.exe`. Run `C-SKY CDK: Configure cdk-make Path` once, then run
`C-SKY CDK: Select Project`.

## Keyboard Shortcuts

- `Ctrl+F7`: Build
- `Ctrl+Shift+F7`: Rebuild
- `Alt+F7`: Clean

Open **Preferences: Open Keyboard Shortcuts** and search for `C-SKY CDK` to
override these bindings. `Ctrl+Shift+B` can also open the registered C-SKY CDK
build task.

## Extension Settings

`csky-cdk-assistant.cdkMakePath` optionally overrides the standard
`C:/Program Files/C-Sky/CDK/cdk-make.exe` path.

The selected Workspace, Project, and BuildSet are stored in
`.vscode/csky-cdk.json` below the VS Code workspace folder.

## Known Issues

VS Code Web, WSL, Remote SSH, flashing, and debugging are not supported.

## Release Notes

### 0.0.1

- Direct CDK workspace and project discovery without a companion CLI.
- Direct `cdk-make.exe` task execution.
- Command Palette actions for build, rebuild, clean, and project selection.
- Default Build, Rebuild, and Clean keyboard shortcuts.

## Build and Package

Install dependencies from the lock file:

```powershell
npm ci
```

Compile the extension with TypeScript:

```powershell
npx tsc -p ./
```

`tsc` prints output only when there are errors. A successful build generates
JavaScript files under `out/`, including `out/extensionMain.js`.

Run lint if needed:

```powershell
npx oxlint src
```

Package the extension as a VSIX:

```powershell
npx --yes --package @vscode/vsce vsce package --allow-missing-repository
```

The generated file name follows the package name and version, for example:

```text
csky-cdk-assistant-x.x.x.vsix
```

Install the generated VSIX locally:

```powershell
code --install-extension ./csky-cdk-assistant-x.x.x.vsix
```

If npm cannot write to the default user cache directory on Windows, use a
workspace-local temporary cache:

```powershell
npm ci --cache ./.npm-cache
npx --yes --package @vscode/vsce vsce package --allow-missing-repository
```
