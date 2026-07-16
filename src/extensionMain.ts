import * as vscode from 'vscode';
import {
    buildArguments,
    discoverProjects,
    inspectCdkMake,
    resolveCdkMakePath,
} from './cdk';
import { normalizePathSeparators } from './pathUtils';
import {
    loadSelection,
    projectConfigUri,
    saveSelection,
    selectionsEqual,
} from './projectConfig';
import {
    BuildAction,
    DiscoveryReport,
    ProjectInfo,
    Selection,
    WorkspaceInfo,
} from './types';

type SelectionMode = 'workspace' | 'project' | 'buildConfig' | 'refresh';

interface StatusBarControls {
    selection: vscode.StatusBarItem;
    build: vscode.StatusBarItem;
    rebuild: vscode.StatusBarItem;
    clean: vscode.StatusBarItem;
}

export function activate(context: vscode.ExtensionContext): void {
    const status = createStatusBarControls();
    const output = vscode.window.createOutputChannel('C-SKY CDK');
    context.subscriptions.push(
        status.selection,
        status.build,
        status.rebuild,
        status.clean,
        output,
    );
    const register = (id: string, handler: () => unknown): void => {
        context.subscriptions.push(vscode.commands.registerCommand(id, handler));
    };

    register('csky-cdk-assistant.configureCdkMake', configureCdkMake);
    register('csky-cdk-assistant.selectWorkspace', () =>
        selectConfiguration(status, 'workspace'));
    register('csky-cdk-assistant.selectProject', () =>
        selectConfiguration(status, 'project'));
    register('csky-cdk-assistant.selectBuildSet', () =>
        selectConfiguration(status, 'buildConfig'));
    register('csky-cdk-assistant.refresh', () =>
        selectConfiguration(status, 'refresh'));
    register('csky-cdk-assistant.openConfiguration', openConfiguration);
    register('csky-cdk-assistant.doctor', () => runDoctor(output));
    register('csky-cdk-assistant.showHelp', showHelp);
    register('csky-cdk-assistant.build', () => runSelected(status, 'build'));
    register('csky-cdk-assistant.rebuild', () => runSelected(status, 'rebuild'));
    register('csky-cdk-assistant.clean', () => runSelected(status, 'clean'));
    register('csky-cdk-assistant.buildAll', () =>
        runSelected(status, 'build', true));

    context.subscriptions.push(
        vscode.tasks.registerTaskProvider('csky-cdk', new CdkTaskProvider()),
    );
    void refreshStatus(status);
}

export function deactivate(): void { }

export class CdkTaskProvider implements vscode.TaskProvider {
    public async provideTasks(): Promise<vscode.Task[]> {
        const tasks: vscode.Task[] = [];
        for (const folder of vscode.workspace.workspaceFolders ?? []) {
            const selection = await loadSelection(folder);
            if (selection) {
                tasks.push(
                    createTask(folder, selection, 'build'),
                    createTask(folder, selection, 'rebuild'),
                    createTask(folder, selection, 'clean'),
                );
            }
        }
        return tasks;
    }

    public async resolveTask(task: vscode.Task): Promise<vscode.Task | undefined> {
        const action = task.definition.action;
        if (!isBuildAction(action)) {
            return undefined;
        }
        const folder = taskFolder(task);
        if (!folder) {
            return undefined;
        }
        const selection = await loadSelection(folder);
        return selection ? createTask(folder, selection, action) : undefined;
    }
}

async function configureCdkMake(): Promise<void> {
    await showErrors(async () => {
        const folder = await chooseFolder();
        if (!folder) {
            return;
        }
        let selection = await loadSelection(folder);
        if (!selection) {
            selection = await chooseSelection(folder);
            if (!selection) {
                return;
            }
        }
        const selected = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: { Executable: ['exe'] },
            openLabel: '选择 cdk-make.exe',
        });
        if (!selected?.[0]) {
            return;
        }
        selection.cdkMakePath = normalizePathSeparators(selected[0].fsPath);
        resolveCdkMakePath(selection);
        await saveSelection(folder, selection);
        void vscode.window.showInformationMessage(
            `已保存 cdk-make.exe 路径到 ${projectConfigUri(folder, selection).fsPath}`,
        );
    });
}

async function runSelected(
    status: StatusBarControls,
    action: BuildAction,
    all = false,
): Promise<void> {
    await showErrors(async () => {
        const folder = await chooseFolder();
        if (!folder) {
            return;
        }
        let selection = await loadSelection(folder);
        if (!selection) {
            selection = await chooseSelection(folder);
            if (!selection) {
                return;
            }
            await saveSelection(folder, selection);
            updateStatus(status.selection, selection);
        }
        await vscode.tasks.executeTask(createTask(folder, selection, action, all));
    });
}

async function selectConfiguration(
    status: StatusBarControls,
    mode: SelectionMode,
): Promise<void> {
    await showErrors(async () => {
        const folder = await chooseFolder();
        if (!folder) {
            return;
        }
        const report = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Window,
                title: '正在扫描 C-SKY CDK 项目',
            },
            () => discoverProjects(folder),
        );
        if (report.issues.length > 0) {
            void vscode.window.showWarningMessage(
                `C-SKY CDK: 扫描时发现 ${report.issues.length} 个配置问题，可运行 Doctor 查看详情。`,
            );
        }
        const current = await loadSelection(folder);
        const selection = await chooseFromReport(
            report,
            current,
            mode,
        );
        if (selection) {
            if (!selectionsEqual(current, selection)) {
                await saveSelection(folder, selection);
            }
            updateStatus(status.selection, selection);
            showActionButtons(status);
        }
    });
}

async function chooseSelection(
    folder: vscode.WorkspaceFolder,
): Promise<Selection | undefined> {
    return chooseFromReport(await discoverProjects(folder), undefined, 'project');
}

async function chooseFromReport(
    report: DiscoveryReport,
    current: Selection | undefined,
    mode: SelectionMode,
): Promise<Selection | undefined> {
    if (report.workspaces.length > 0) {
        let workspace = report.workspaces.find((item) => item.path === current?.workspace);
        if (!workspace || mode === 'workspace') {
            workspace = await pickItem(
                report.workspaces,
                '选择 CDK Workspace',
                (item) => `${item.name} — ${item.path}`,
            );
        }
        if (!workspace) {
            return undefined;
        }
        let project = workspace.projects.find((item) => item.name === current?.project);
        if (!project || mode === 'workspace' || mode === 'project') {
            project = await pickProject(workspace);
        }
        if (!project) {
            return undefined;
        }
        const buildConfig = await pickBuildConfig(project, current, mode);
        if (!buildConfig) {
            return undefined;
        }
        const sameWorkspace = current &&
            normalizePathSeparators(current.workspace).toLowerCase() ===
            workspace.path.toLowerCase();
        return {
            workspace: workspace.path,
            project: project.name,
            buildConfig,
            ...(sameWorkspace && current.cdkMakePath
                ? { cdkMakePath: current.cdkMakePath }
                : {}),
        };
    }

    const issueSummary = report.issues.length > 0
        ? `，并发现 ${report.issues.length} 个无效配置`
        : '';
    throw new Error(`当前目录中没有找到可用的 .cdkws${issueSummary}`);
}

async function pickProject(
    workspace: WorkspaceInfo,
): Promise<ProjectInfo | undefined> {
    if (workspace.projects.length === 1) {
        return workspace.projects[0];
    }
    const active = workspace.projects.find(
        (project) => project.name === workspace.activeProject,
    );
    return pickItem(workspace.projects, '选择 CDK 项目', (item) => item.name, active);
}

async function pickBuildConfig(
    project: ProjectInfo,
    current: Selection | undefined,
    mode: SelectionMode,
): Promise<string | undefined> {
    if (project.buildConfigs.length === 0) {
        throw new Error(`项目 ${project.name} 没有可用的 BuildSet`);
    }
    if (
        mode !== 'buildConfig' &&
        current?.project === project.name &&
        project.buildConfigs.includes(current.buildConfig)
    ) {
        return current.buildConfig;
    }
    if (project.buildConfigs.length === 1) {
        return project.buildConfigs[0];
    }
    const preferred = project.defaultBuildConfig ?? project.buildConfigs[0];
    return pickItem(project.buildConfigs, '选择 BuildSet', (item) => item, preferred);
}

async function pickItem<T>(
    items: readonly T[],
    placeHolder: string,
    label: (item: T) => string,
    preferred?: T,
): Promise<T | undefined> {
    if (items.length === 0) {
        return undefined;
    }
    const picks = items.map((item) => ({
        label: label(item),
        item,
        picked: preferred === item,
    }));
    return (await vscode.window.showQuickPick(picks, { placeHolder }))?.item;
}

async function chooseFolder(): Promise<vscode.WorkspaceFolder | undefined> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    if (folders.length === 0) {
        throw new Error('请先打开一个包含 CDK 项目的文件夹');
    }
    if (folders.length === 1) {
        return folders[0];
    }
    return pickItem(folders, '选择 VS Code Workspace Folder', (folder) => folder.name);
}

function createTask(
    folder: vscode.WorkspaceFolder,
    selection: Selection,
    action: BuildAction,
    all = false,
): vscode.Task {
    const task = new vscode.Task(
        { type: 'csky-cdk', action, folder: folder.name },
        folder,
        `C-SKY CDK ${action}${all ? ' all' : ''}`,
        'csky-cdk',
        new vscode.ProcessExecution(
            resolveCdkMakePath(selection),
            buildArguments(selection, action, all),
            { cwd: folder.uri.fsPath },
        ),
        cdkProblemMatchers(folder),
    );
    if (action === 'build' && !all) {
        task.group = vscode.TaskGroup.Build;
    }
    task.presentationOptions = {
        reveal: vscode.TaskRevealKind.Always,
        panel: vscode.TaskPanelKind.Dedicated,
        clear: true,
    };
    return task;
}

async function openConfiguration(): Promise<void> {
    await showErrors(async () => {
        const folder = await chooseFolder();
        if (!folder) {
            return;
        }
        const selection = await loadSelection(folder);
        if (!selection) {
            throw new Error('项目尚未配置，请先运行 “C-SKY CDK: Select Project”');
        }
        let uri = projectConfigUri(folder, selection);
        try {
            await vscode.workspace.fs.stat(uri);
        } catch {
            const legacyUri = projectConfigUri(folder);
            if (legacyUri.fsPath === uri.fsPath) {
                throw new Error('项目配置文件不存在，请重新选择项目');
            }
            await vscode.workspace.fs.stat(legacyUri);
            uri = legacyUri;
        }
        await vscode.window.showTextDocument(uri);
    });
}

async function showHelp(): Promise<void> {
    await vscode.env.openExternal(
        vscode.Uri.parse(
            'https://github.com/phantomfancy/csky-cdk-assistant/blob/main/doc/help.md',
        ),
    );
}

async function runDoctor(output: vscode.OutputChannel): Promise<void> {
    await showErrors(async () => {
        const folder = await chooseFolder();
        if (!folder) {
            return;
        }
        const selection = await loadSelection(folder);
        const executable = resolveCdkMakePath(selection);
        const executableInfo = inspectCdkMake(executable);
        const report = await discoverProjects(folder);
        const projects = report.workspaces.reduce(
            (total, workspace) => total + workspace.projects.length,
            0,
        );
        output.clear();
        output.appendLine('C-SKY CDK Doctor');
        output.appendLine(`workspace folder: ${normalizePathSeparators(folder.uri.fsPath)}`);
        output.appendLine(`cdk-make: ${executable}`);
        output.appendLine(`size: ${executableInfo.size} bytes`);
        output.appendLine(`modified: ${executableInfo.modified.toISOString()}`);
        output.appendLine(
            `discovered: ${report.workspaces.length} Workspace, ${projects} Project`,
        );
        if (report.issues.length > 0) {
            output.appendLine(`discovery issues: ${report.issues.length}`);
            for (const issue of report.issues) {
                output.appendLine(`- ${issue.path}: ${issue.message}`);
            }
            output.show(true);
            void vscode.window.showWarningMessage(
                `C-SKY CDK: 发现 ${report.issues.length} 个项目配置问题，详见输出。`,
            );
            return;
        }
        output.appendLine('result: OK');
        void vscode.window.showInformationMessage(
            `C-SKY CDK OK: ${report.workspaces.length} Workspace，${projects} Project`,
        );
    });
}

function isBuildAction(value: unknown): value is BuildAction {
    return value === 'build' || value === 'rebuild' || value === 'clean';
}

function taskFolder(task: vscode.Task): vscode.WorkspaceFolder | undefined {
    if (typeof task.scope === 'object' && task.scope !== null && 'uri' in task.scope) {
        return task.scope;
    }
    const name = task.definition.folder;
    return typeof name === 'string'
        ? vscode.workspace.workspaceFolders?.find((folder) => folder.name === name)
        : undefined;
}

function cdkProblemMatchers(folder: vscode.WorkspaceFolder): string[] {
    const configured = vscode.workspace
        .getConfiguration('csky-cdk-assistant', folder.uri)
        .get<string[]>('problemMatchers');
    return configured ?? ['$gcc'];
}

function createStatusBarControls(): StatusBarControls {
    const selection = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100,
    );
    selection.command = 'csky-cdk-assistant.selectWorkspace';
    selection.tooltip = '选择 C-SKY CDK 项目和 BuildSet';

    const build = createActionStatusBarItem(
        '$(play)',
        'csky-cdk-assistant.build',
        'C-SKY CDK: 生成当前项目',
        99,
    );
    const rebuild = createActionStatusBarItem(
        '$(sync)',
        'csky-cdk-assistant.rebuild',
        'C-SKY CDK: 重新生成当前项目',
        98,
    );
    const clean = createActionStatusBarItem(
        '$(trash)',
        'csky-cdk-assistant.clean',
        'C-SKY CDK: 清理当前项目',
        97,
    );

    return { selection, build, rebuild, clean };
}

function createActionStatusBarItem(
    text: string,
    command: string,
    tooltip: string,
    priority: number,
): vscode.StatusBarItem {
    const item = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        priority,
    );
    item.text = text;
    item.command = command;
    item.tooltip = tooltip;
    return item;
}

async function refreshStatus(status: StatusBarControls): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        status.selection.hide();
        hideActionButtons(status);
        return;
    }
    showActionButtons(status);
    try {
        const selection = await loadSelection(folder);
        if (selection) {
            updateStatus(status.selection, selection);
            return;
        }
    } catch (error) {
        status.selection.tooltip = error instanceof Error ? error.message : String(error);
    }
    status.selection.text = '$(tools) C-SKY CDK: 选择项目';
    status.selection.show();
}

function updateStatus(status: vscode.StatusBarItem, selection: Selection): void {
    status.text = `$(tools) ${selection.project} [${selection.buildConfig}]`;
    status.show();
}

function showActionButtons(status: StatusBarControls): void {
    status.build.show();
    status.rebuild.show();
    status.clean.show();
}

function hideActionButtons(status: StatusBarControls): void {
    status.build.hide();
    status.rebuild.hide();
    status.clean.hide();
}

async function showErrors(action: () => Promise<void>): Promise<void> {
    try {
        await action();
    } catch (error) {
        void vscode.window.showErrorMessage(
            error instanceof Error ? error.message : String(error),
        );
    }
}
