# C-SKY CDK Assistant

[English](README.md)

通过官方 `cdk-make.exe` 命令行工具，直接在 Visual Studio Code 中构建 C-SKY Development Kit（CDK）工作区。

本扩展会自行发现并解析 CDK 元数据，也不依赖额外的配套 CLI。可选的只读模式用于阻止 `cdk-make.exe` 修改 `.cdkws` 或 `.cdkproj` 文件。

## 功能

- 发现 `.cdkws` 工作区及其包含的 `.cdkproj` 项目。
- 通过快速选择框选择 Workspace、项目和 BuildSet。
- 通过 VS Code 任务执行生成、重新生成、清理或生成全部项目。
- 在状态栏显示当前项目和 BuildSet，并提供生成快捷按钮。
- 使用相对路径将选择结果保存到 `.vscode/csky-cdk.json`。
- 检查 `cdk-make.exe` 路径、文件信息和项目发现结果。
- 可开启只读模式，阻止 `cdk-make.exe` 更新工程元数据。
- 提供英文和简体中文命令标题。

## 要求与支持范围

- Windows 桌面版 VS Code `1.125.0` 或更高版本。
- 已安装 C-SKY CDK，并包含 `cdk-make.exe`。
- 打开的目录中包含 `.cdkws` 文件。

## 快速开始

1. 在 VS Code 中打开包含 CDK 工作区的目录。
2. 运行 **C-SKY CDK: 选择 Workspace**，选择 Workspace、项目和 BuildSet。
3. 如果 CDK 未安装在默认位置，运行 **C-SKY CDK: 配置 cdk-make.exe 路径**，将路径保存到当前 `.cdkws` 对应的配置文件。
4. 使用状态栏按钮、命令面板命令或快捷键执行构建。

默认可执行文件路径为：

```text
C:/Program Files/C-Sky/CDK/cdk-make.exe
```

## VS Code 任务

扩展提供 `csky-cdk` 任务类型，并为每个已配置的 VS Code 工作区目录生成 build、rebuild 和 clean 任务。构建命令使用 `cdk-make.exe` 原生短参数，例如 `-w`、`-p`、`-c`、`-d` 和 `-a`。

`csky-cdk-assistant.readOnlyMode` 默认为 `false`，此时使用 `cdk-make.exe` 的原生行为，工程元数据可能被改写。开启后会在构建期间保护所选 `.cdkws` 及其引用的全部 `.cdkproj`。

开发说明和已知问题见英文文档 [doc/development.md](doc/development.md)。

发布历史见 [CHANGELOG.md](CHANGELOG.md)，双语使用帮助见 [doc/help.md](doc/help.md)。
