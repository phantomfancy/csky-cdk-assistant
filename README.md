# vscode-csky-cdk

Build C-SKY CDK workspaces and projects from VS Code through
`cdk-make-assistant`.

## Features

- Discover `.cdkws` and `.cdkproj` files.
- Select Workspace, Project, and BuildSet with Quick Pick.
- Build, rebuild, clean, or build all projects using VS Code Tasks.
- Show the active project and BuildSet in the status bar.
- Share project configuration with the standalone CLI.

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

`vscode-csky-cdk.assistantPath` optionally overrides the bundled
`cdk-make-assistant.exe`.

## Known Issues

VS Code Web, WSL, Remote SSH, flashing, and debugging are not supported.

## Release Notes

### 0.0.1

- Initial CLI-backed project discovery and build support.
- Command Palette actions for build, rebuild, clean, and project selection.
- Default Build, Rebuild, and Clean keyboard shortcuts.
