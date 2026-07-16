# Change Log

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.5] - 2026-07-16

### 新增

- 新增由标签触发的 Linux 打包与 GitHub Release 自动发布流程。
- 新增可手动触发的 Windows 测试与 VSIX 验证工作流。
- 新增本地 `npm run package` 打包命令。
- 新增简体中文 README，并在英文项目主页中添加入口。
- 新增可配置的项目发现排除规则和任务问题匹配器。
- 新增详细的 Doctor 输出，显示可执行文件信息和项目发现问题。

### 变更

- 精简 README；将开发者说明至 `doc/development.md`。
- 支持解析用户定义的 `csky-cdk` 任务，并使用明确的工作目录运行 `cdk-make.exe`。
- 将每个 Workspace 的 `cdkMakePath` 保存在所选 `.cdkws` 同级目录中，并以计算机级设置作为后备。
- 单个 Workspace 或项目 XML 无效时继续发现其他有效项目。
- 移除独立 `.cdkproj` 配置模式，仅支持由 `.cdkws` 管理的项目。

## [0.0.4] - 2026-07-10

首次公开发布。

### 新增

- 新增英文和简体中文命令标题。
- 新增双语在线帮助、扩展图标、发布者、仓库和问题反馈信息。
- 新增用于生成、重新生成和清理的状态栏按钮。
- 新增隔离的 Extension Host 启动配置，并在调试前执行编译。

### 修复

- 当前选择未发生变化时，不再重写 `.vscode/csky-cdk.json`。

## [0.0.3] - 2026-07-10

测试上架Marketplace的的版本。

## [0.0.2] - 2026-07-09

### 变更

- 使用 Oxlint 替换 ESLint 进行源码检查。
- 更新 TypeScript 开发工具链至最新版 Typescript 7。
- 将生成和持久化的路径统一为 `/` 分隔符。

## [0.0.1] - 2026-07-09

### 新增

- 无需配套 CLI，直接发现并解析 `.cdkws` 和 `.cdkproj` 文件。
- 选择 Workspace、项目和 BuildSet，并将选择结果保存到 `.vscode/csky-cdk.json`。
- 通过 `cdk-make.exe` 和 VS Code Tasks 执行生成、重新生成、清理和生成全部项目操作。
- 新增命令面板操作、键盘快捷键、项目状态、诊断和 Extension Host 测试。

[0.0.4]: https://github.com/phantomfancy/csky-cdk-assistant/compare/0e7ad14...c2c931c
[0.0.3]: https://github.com/phantomfancy/csky-cdk-assistant/compare/e650386...0e7ad14
[0.0.2]: https://github.com/phantomfancy/csky-cdk-assistant/compare/c75dfc4...e650386
[0.0.1]: https://github.com/phantomfancy/csky-cdk-assistant/commit/c75dfc4
