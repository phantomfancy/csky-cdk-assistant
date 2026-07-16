# C-SKY CDK Assistant

[English](README.md),   [简体中文](README.zh-CN.md)

Build C-SKY Development Kit (CDK) workspaces directly from Visual Studio Code through the official `cdk-make.exe` command-line tool.

The extension discovers CDK metadata itself. It does not modify `.cdkws` or `.cdkproj` files and does not require a companion CLI.

## Features

- Discover `.cdkws` workspaces and their `.cdkproj` projects.
- Select a Workspace, Project, and BuildSet with Quick Pick.
- Build, rebuild, clean, or build every project through VS Code Tasks.
- Show the selected project and BuildSet with build shortcuts in the status bar.
- Store the selection in `.vscode/csky-cdk.json` with workspace-relative paths.
- Diagnose the `cdk-make.exe` path and discovered project count.
- Provide English and Simplified Chinese command titles.

## Requirements and Scope

- Windows desktop VS Code `1.125.0` or newer.
- A local C-SKY CDK installation that provides `cdk-make.exe`.
- A folder containing a `.cdkws` file.

## Quick Start

1. Open the folder containing the CDK workspace in VS Code.
2. Run **C-SKY CDK: Select Workspace** and select the Workspace, Project, and BuildSet.
3. Run **C-SKY CDK: Configure cdk-make Path** if CDK is not installed at the default location.
4. Use the status bar buttons, Command Palette commands, or keyboard shortcuts to build.

The default executable path is:

```text
C:/Program Files/C-Sky/CDK/cdk-make.exe
```

## VS Code Tasks

The extension contributes the `csky-cdk` task type and provides build, rebuild, and clean tasks for each configured VS Code workspace folder. Tasks declared in `tasks.json` are resolved against the saved project selection. Build commands execute `cdk-make.exe` in the selected workspace folder with its native short options such as `-w`, `-p`, `-c`, `-d`, and `-a`.

Development instructions and known issues are documented in [doc/development.md](doc/development.md).

See [CHANGELOG.md](CHANGELOG.md) for release history and [doc/help.md](doc/help.md) for bilingual usage help.
