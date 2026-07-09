# C-SKY CDK Assistant 帮助

## 基本流程

1. 运行 `C-SKY CDK: 配置 cdk-make 路径 (Configure cdk-make Path)`。
2. 打开包含 `.cdkws` 或 `.cdkproj` 的 VS Code 工作区。
3. 点击底栏项目按钮，或运行 `C-SKY CDK: 选择 Workspace`。
4. 选择 Workspace、项目和 BuildSet。
5. 使用底栏快捷按钮或命令面板执行生成、重新生成、清理。

## 常用命令

- `C-SKY CDK: 生成 (Build)`: 生成当前项目。
- `C-SKY CDK: 重新生成 (Rebuild)`: 重新生成当前项目。
- `C-SKY CDK: 清理 (Clean)`: 清理当前项目。
- `C-SKY CDK: 生成所有项目 (Build All Projects)`: 生成当前 Workspace 下所有项目。
- `C-SKY CDK: 刷新项目 (Refresh Projects)`: 重新扫描 CDK 项目。
- `C-SKY CDK: 打开助手配置 (Open Assistant Configuration)`: 打开 `.vscode/csky-cdk.json`。
- `C-SKY CDK: 运行诊断 (Run Doctor)`: 检查 cdk-make 路径和项目发现结果。

## 快捷键

- `Ctrl+F7`: 生成。
- `Ctrl+Shift+F7`: 重新生成。
- `Alt+F7`: 清理。

## 配置文件

项目选择保存在 VS Code 工作区目录下：

```text
.vscode/csky-cdk.json
```

路径统一使用 `/` 作为分隔符。

---

# C-SKY CDK Assistant Help

## Basic Workflow

1. Run `C-SKY CDK: Configure cdk-make Path`.
2. Open a VS Code workspace that contains a `.cdkws` or `.cdkproj` file.
3. Click the status bar project button, or run `C-SKY CDK: Select Workspace`.
4. Select the Workspace, Project, and BuildSet.
5. Use the status bar shortcuts or Command Palette to build, rebuild, or clean.

## Commands

- `C-SKY CDK: Build`: Build the selected project.
- `C-SKY CDK: Rebuild`: Rebuild the selected project.
- `C-SKY CDK: Clean`: Clean the selected project.
- `C-SKY CDK: Build All Projects`: Build all projects in the selected Workspace.
- `C-SKY CDK: Refresh Projects`: Rescan CDK projects.
- `C-SKY CDK: Open Assistant Configuration`: Open `.vscode/csky-cdk.json`.
- `C-SKY CDK: Run Doctor`: Check the cdk-make path and project discovery result.

## Keyboard Shortcuts

- `Ctrl+F7`: Build.
- `Ctrl+Shift+F7`: Rebuild.
- `Alt+F7`: Clean.

## Configuration File

The project selection is saved under the VS Code workspace folder:

```text
.vscode/csky-cdk.json
```

Paths use `/` as the separator.
