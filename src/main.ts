import * as vscode from 'vscode';
import { AssistantClient, resolveAssistantPath } from './assistant';
import { BuildAction, DiscoveryReport, ProjectInfo, Selection, WorkspaceInfo } from './types';

const statePrefix = 'vscode-cdk.selection.';
type SelectionMode = 'workspace' | 'project' | 'buildConfig' | 'refresh';

export function activate(context: vscode.ExtensionContext): void {
	const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	status.command = 'vscode-cdk.selectProject';
	status.tooltip = '选择 CDK 项目和 BuildSet';
	context.subscriptions.push(status);
	const client = (): AssistantClient => new AssistantClient(resolveAssistantPath(context));
	const register = (id: string, handler: () => unknown): void => {
		context.subscriptions.push(vscode.commands.registerCommand(id, handler));
	};

	register('vscode-cdk.configureCdkMake', () => showErrors(async () => {
		const selected = await vscode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			filters: { Executable: ['exe'] },
			openLabel: '选择 cdk-make.exe',
		});
		if (selected?.[0]) {
			await client().setCdkMakePath(selected[0].fsPath);
			void vscode.window.showInformationMessage('已保存 cdk-make.exe 路径');
		}
	}));
	register('vscode-cdk.selectWorkspace', () =>
		selectConfiguration(context, client(), status, 'workspace'));
	register('vscode-cdk.selectProject', () =>
		selectConfiguration(context, client(), status, 'project'));
	register('vscode-cdk.selectBuildSet', () =>
		selectConfiguration(context, client(), status, 'buildConfig'));
	register('vscode-cdk.refresh', () =>
		selectConfiguration(context, client(), status, 'refresh'));
	register('vscode-cdk.openConfiguration', () => showErrors(async () => {
		const folder = await chooseFolder();
		if (folder) {
			await vscode.window.showTextDocument(
				vscode.Uri.joinPath(folder.uri, '.cdk-make-assistant.toml'),
			);
		}
	}));
	register('vscode-cdk.doctor', () => runDoctor(context));
	register('vscode-cdk.build', () => runSelected(context, client(), status, 'build'));
	register('vscode-cdk.rebuild', () => runSelected(context, client(), status, 'rebuild'));
	register('vscode-cdk.clean', () => runSelected(context, client(), status, 'clean'));
	register('vscode-cdk.buildAll', () => runSelected(context, client(), status, 'build', true));

	context.subscriptions.push(
		vscode.tasks.registerTaskProvider('cdk', new CdkTaskProvider(context)),
	);
	void refreshStatus(context, status);
}

export function deactivate(): void {}

class CdkTaskProvider implements vscode.TaskProvider {
	public constructor(private readonly context: vscode.ExtensionContext) {}

	public provideTasks(): vscode.Task[] {
		const tasks: vscode.Task[] = [];
		for (const folder of vscode.workspace.workspaceFolders ?? []) {
			const selection = loadSelection(this.context, folder);
			if (selection) {
				tasks.push(
					createTask(this.context, folder, selection, 'build'),
					createTask(this.context, folder, selection, 'rebuild'),
					createTask(this.context, folder, selection, 'clean'),
				);
			}
		}
		return tasks;
	}

	public resolveTask(): undefined {
		return undefined;
	}
}

async function runSelected(
	context: vscode.ExtensionContext,
	client: AssistantClient,
	status: vscode.StatusBarItem,
	action: BuildAction,
	all = false,
): Promise<void> {
	await showErrors(async () => {
		const folder = await chooseFolder();
		if (!folder) {
			return;
		}
		let selection = loadSelection(context, folder);
		if (!selection) {
			selection = await chooseSelection(client, folder);
			if (!selection) {
				return;
			}
			await saveSelection(context, client, folder, selection);
			updateStatus(status, selection);
		}
		await vscode.tasks.executeTask(createTask(context, folder, selection, action, all));
	});
}

async function selectConfiguration(
	context: vscode.ExtensionContext,
	client: AssistantClient,
	status: vscode.StatusBarItem,
	mode: SelectionMode,
): Promise<void> {
	await showErrors(async () => {
		const folder = await chooseFolder();
		if (!folder) {
			return;
		}
		const report = await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Window, title: '正在扫描 CDK 项目' },
			() => client.inspect(folder.uri.fsPath),
		);
		const selection = await chooseFromReport(
			folder,
			report,
			loadSelection(context, folder),
			mode,
		);
		if (selection) {
			await saveSelection(context, client, folder, selection);
			updateStatus(status, selection);
		}
	});
}

async function chooseSelection(
	client: AssistantClient,
	folder: vscode.WorkspaceFolder,
): Promise<Selection | undefined> {
	return chooseFromReport(folder, await client.inspect(folder.uri.fsPath), undefined, 'project');
}

async function chooseFromReport(
	folder: vscode.WorkspaceFolder,
	report: DiscoveryReport,
	current: Selection | undefined,
	mode: SelectionMode,
): Promise<Selection | undefined> {
	if (report.workspaces.length > 0) {
		let workspace = report.workspaces.find((item) => item.path === current?.workspace);
		if (!workspace || mode === 'workspace' || mode === 'refresh') {
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
		if (!project || mode !== 'buildConfig') {
			project = await pickProject(workspace);
		}
		if (!project) {
			return undefined;
		}
		const buildConfig = await pickBuildConfig(project, current, mode);
		return buildConfig ? {
			folderUri: folder.uri.toString(),
			workspace: workspace.path,
			project: project.name,
			buildConfig,
		} : undefined;
	}

	let project = report.standaloneProjects.find((item) => item.path === current?.projectFile);
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
	return buildConfig ? {
		folderUri: folder.uri.toString(),
		projectFile: project.path,
		project: project.name,
		buildConfig,
	} : undefined;
}

async function pickProject(workspace: WorkspaceInfo): Promise<ProjectInfo | undefined> {
	if (workspace.projects.length === 1) {
		return workspace.projects[0];
	}
	const active = workspace.projects.find((project) => project.name === workspace.activeProject);
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

async function saveSelection(
	context: vscode.ExtensionContext,
	client: AssistantClient,
	folder: vscode.WorkspaceFolder,
	selection: Selection,
): Promise<void> {
	await context.workspaceState.update(stateKey(folder), selection);
	await client.persistSelection(
		folder.uri.fsPath,
		selection.workspace,
		selection.projectFile,
		selection.project,
		selection.buildConfig,
	);
}

function loadSelection(
	context: vscode.ExtensionContext,
	folder: vscode.WorkspaceFolder,
): Selection | undefined {
	return context.workspaceState.get<Selection>(stateKey(folder));
}

function stateKey(folder: vscode.WorkspaceFolder): string {
	return `${statePrefix}${folder.uri.toString()}`;
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
	context: vscode.ExtensionContext,
	folder: vscode.WorkspaceFolder,
	selection: Selection,
	action: BuildAction,
	all = false,
): vscode.Task {
	const args = [action, folder.uri.fsPath];
	if (selection.workspace) {
		args.push('--workspace', selection.workspace);
		if (all) {
			args.push('--all');
		} else {
			args.push('--project', selection.project, '--config', selection.buildConfig);
		}
	} else if (selection.projectFile) {
		args.push('--project-file', selection.projectFile, '--config', selection.buildConfig);
	}
	const task = new vscode.Task(
		{ type: 'cdk', action, folder: folder.name },
		folder,
		`CDK ${action}${all ? ' all' : ''}`,
		'cdk',
		new vscode.ProcessExecution(resolveAssistantPath(context), args),
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

async function runDoctor(context: vscode.ExtensionContext): Promise<void> {
	await showErrors(async () => {
		const folder = await chooseFolder();
		if (!folder) {
			return;
		}
		const task = new vscode.Task(
			{ type: 'cdk', action: 'doctor' },
			folder,
			'CDK doctor',
			'cdk',
			new vscode.ProcessExecution(resolveAssistantPath(context), ['doctor', folder.uri.fsPath]),
		);
		await vscode.tasks.executeTask(task);
	});
}

async function refreshStatus(
	context: vscode.ExtensionContext,
	status: vscode.StatusBarItem,
): Promise<void> {
	const folder = vscode.workspace.workspaceFolders?.[0];
	const selection = folder ? loadSelection(context, folder) : undefined;
	if (selection) {
		updateStatus(status, selection);
	} else if (folder) {
		status.text = '$(tools) CDK: 选择项目';
		status.show();
	} else {
		status.hide();
	}
}

function updateStatus(status: vscode.StatusBarItem, selection: Selection): void {
	status.text = `$(tools) ${selection.project} [${selection.buildConfig}]`;
	status.show();
}

async function showErrors(action: () => Promise<void>): Promise<void> {
	try {
		await action();
	} catch (error) {
		void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
	}
}
