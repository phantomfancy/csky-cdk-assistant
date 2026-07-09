import * as vscode from 'vscode';
import {
    buildArguments,
    discoverProjects,
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

export function activate(context: vscode.ExtensionContext): void {
    const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    status.command = 'csky-cdk-assistant.selectWorkspace';
    status.tooltip = '选择 C-SKY CDK 项目和 BuildSet';
    context.subscriptions.push(status);
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
    register('csky-cdk-assistant.doctor', runDoctor);
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

class CdkTaskProvider implements vscode.TaskProvider {
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

    public resolveTask(): undefined {
        return undefined;
    }
}

async function configureCdkMake(): Promise<void> {
    await showErrors(async () => {
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
        await vscode.workspace
            .getConfiguration('csky-cdk-assistant')
            .update(
                'cdkMakePath',
                normalizePathSeparators(selected[0].fsPath),
                vscode.ConfigurationTarget.Global,
            );
        void vscode.window.showInformationMessage('已保存 cdk-make.exe 路径');
    });
}

async function runSelected(
    status: vscode.StatusBarItem,
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
            updateStatus(status, selection);
        }
        await vscode.tasks.executeTask(createTask(folder, selection, action, all));
    });
}

async function selectConfiguration(
    status: vscode.StatusBarItem,
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
            updateStatus(status, selection);
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
        return buildConfig
            ? { workspace: workspace.path, project: project.name, buildConfig }
            : undefined;
    }

    let project = report.standaloneProjects.find(
        (item) => item.path === current?.projectFile,
    );
    if (!project || mode !== 'buildConfig') {
        project = await pickItem(
            report.standaloneProjects,
            '选择 CDK 项目',
            (item) => item.path,
        );
    }
    if (!project) {
        throw new Error('当前目录中没有找到 .cdkws 或 .cdkproj');
    }
    const buildConfig = await pickBuildConfig(project, current, mode);
    return buildConfig
        ? { projectFile: project.path, project: project.name, buildConfig }
        : undefined;
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
            resolveCdkMakePath(),
            buildArguments(selection, action, all),
        ),
        [],
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
        const uri = projectConfigUri(folder);
        try {
            await vscode.workspace.fs.stat(uri);
        } catch {
            throw new Error('项目尚未配置，请先运行 “C-SKY CDK: Select Project”');
        }
        await vscode.window.showTextDocument(uri);
    });
}

async function runDoctor(): Promise<void> {
    await showErrors(async () => {
        const folder = await chooseFolder();
        if (!folder) {
            return;
        }
        const executable = resolveCdkMakePath();
        const report = await discoverProjects(folder);
        const projects = report.workspaces.reduce(
            (total, workspace) => total + workspace.projects.length,
            report.standaloneProjects.length,
        );
        void vscode.window.showInformationMessage(
            `C-SKY CDK OK: ${executable}; ` +
            `${report.workspaces.length} Workspace，${projects} Project`,
        );
    });
}

async function refreshStatus(status: vscode.StatusBarItem): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        status.hide();
        return;
    }
    try {
        const selection = await loadSelection(folder);
        if (selection) {
            updateStatus(status, selection);
            return;
        }
    } catch (error) {
        status.tooltip = error instanceof Error ? error.message : String(error);
    }
    status.text = '$(tools) C-SKY CDK: 选择项目';
    status.show();
}

function updateStatus(status: vscode.StatusBarItem, selection: Selection): void {
    status.text = `$(tools) ${selection.project} [${selection.buildConfig}]`;
    status.show();
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
