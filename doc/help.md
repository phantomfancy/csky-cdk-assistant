# C-SKY CDK Assistant 帮助

## 基本流程

1. 打开包含 `.cdkws` 的 VS Code 工作区。
2. 点击底栏项目按钮，或运行 `C-SKY CDK: 选择 Workspace`。
3. 选择 Workspace、项目和 BuildSet。
4. 如果 CDK 不在默认位置，运行 `C-SKY CDK: 配置 cdk-make 路径 (Configure cdk-make Path)`。
5. 使用底栏快捷按钮或命令面板执行生成、重新生成、清理。

## 常用命令

- `C-SKY CDK: 生成 (Build)`: 生成当前项目。
- `C-SKY CDK: 重新生成 (Rebuild)`: 重新生成当前项目。
- `C-SKY CDK: 清理 (Clean)`: 清理当前项目。
- `C-SKY CDK: 生成所有项目 (Build All Projects)`: 生成当前 Workspace 下所有项目。
- `C-SKY CDK: 刷新项目 (Refresh Projects)`: 重新扫描 CDK 项目。
- `C-SKY CDK: 打开助手配置 (Open Assistant Configuration)`: 打开 `.vscode/csky-cdk.json`。
- `C-SKY CDK: 运行诊断 (Run Doctor)`: 检查 cdk-make 文件和项目发现结果，并在输出面板汇总配置问题。

## 快捷键

- `Ctrl+F7`: 生成。
- `Ctrl+Shift+F7`: 重新生成。
- `Alt+F7`: 清理。

## 配置文件

项目选择保存在当前 `.cdkws` 所在目录下：

```text
.vscode/csky-cdk.json
```

路径统一使用 `/` 作为分隔符。

扩展设置 `csky-cdk-assistant.cdkMakePath` 是全局默认路径。当前 `.cdkws` 同级 `.vscode/csky-cdk.json` 中的 `cdkMakePath` 优先级更高，并对该 Workspace 内的所有项目生效。配置命令只写入当前项目配置，不修改 VS Code 工作区设置。

构建任务默认使用 `$gcc` 问题匹配器；若工具链不输出 GCC 兼容诊断，请将 `csky-cdk-assistant.problemMatchers` 设为 `[]`。

---

# C-SKY CDK Assistant Help

## Basic Workflow

1. Open a VS Code workspace that contains a `.cdkws` file.
2. Click the status bar project button, or run `C-SKY CDK: Select Workspace`.
3. Select the Workspace, Project, and BuildSet.
4. Run `C-SKY CDK: Configure cdk-make Path` if CDK is not installed at the default location.
5. Use the status bar shortcuts or Command Palette to build, rebuild, or clean.

## Commands

- `C-SKY CDK: Build`: Build the selected project.
- `C-SKY CDK: Rebuild`: Rebuild the selected project.
- `C-SKY CDK: Clean`: Clean the selected project.
- `C-SKY CDK: Build All Projects`: Build all projects in the selected Workspace.
- `C-SKY CDK: Refresh Projects`: Rescan CDK projects.
- `C-SKY CDK: Open Assistant Configuration`: Open `.vscode/csky-cdk.json`.
- `C-SKY CDK: Run Doctor`: Check the cdk-make file and project discovery result, and summarize configuration issues in the Output panel.

## Keyboard Shortcuts

- `Ctrl+F7`: Build.
- `Ctrl+Shift+F7`: Rebuild.
- `Alt+F7`: Clean.

## Configuration File

The project selection is saved beside the current `.cdkws`:

```text
.vscode/csky-cdk.json
```

Paths use `/` as the separator.

The `csky-cdk-assistant.cdkMakePath` extension setting is the global default. A `cdkMakePath` in `.vscode/csky-cdk.json` beside the current `.cdkws` takes precedence for every project in that Workspace. The Configure command only writes the current project configuration and does not change VS Code workspace settings.

Build tasks use the `$gcc` problem matcher by default. Set `csky-cdk-assistant.problemMatchers` to `[]` if the toolchain does not emit GCC-compatible diagnostics.
