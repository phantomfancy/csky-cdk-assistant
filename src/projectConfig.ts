import * as path from 'path';
import * as vscode from 'vscode';
import { ProjectConfig, Selection } from './types';

const configDirectory = '.vscode';
const configFileName = 'csky-cdk.json';

export function projectConfigUri(folder: vscode.WorkspaceFolder): vscode.Uri {
	return vscode.Uri.joinPath(folder.uri, configDirectory, configFileName);
}

export async function loadSelection(
	folder: vscode.WorkspaceFolder,
): Promise<Selection | undefined> {
	const uri = projectConfigUri(folder);
	let bytes: Uint8Array;
	try {
		bytes = await vscode.workspace.fs.readFile(uri);
	} catch (error) {
		if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
			return undefined;
		}
		throw error;
	}
	const config = parseProjectConfig(
		new TextDecoder('utf-8', { fatal: true }).decode(bytes),
	);
	return {
		workspace: config.workspace
			? path.resolve(folder.uri.fsPath, config.workspace)
			: undefined,
		projectFile: config.projectFile
			? path.resolve(folder.uri.fsPath, config.projectFile)
			: undefined,
		project: config.project,
		buildConfig: config.buildConfig,
	};
}

export async function saveSelection(
	folder: vscode.WorkspaceFolder,
	selection: Selection,
): Promise<void> {
	const directory = vscode.Uri.joinPath(folder.uri, configDirectory);
	const target = projectConfigUri(folder);
	const temporary = vscode.Uri.joinPath(
		directory,
		`${configFileName}.${process.pid}.tmp`,
	);
	const config: ProjectConfig = {
		schemaVersion: 1,
		workspace: selection.workspace
			? relativePath(folder, selection.workspace)
			: undefined,
		projectFile: selection.projectFile
			? relativePath(folder, selection.projectFile)
			: undefined,
		project: selection.project,
		buildConfig: selection.buildConfig,
	};
	await vscode.workspace.fs.createDirectory(directory);
	await vscode.workspace.fs.writeFile(
		temporary,
		new TextEncoder().encode(`${JSON.stringify(config, undefined, 2)}\r\n`),
	);
	await vscode.workspace.fs.rename(temporary, target, { overwrite: true });
}

export function parseProjectConfig(text: string): ProjectConfig {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch (error) {
		throw new Error(`csky-cdk.json 不是有效 JSON: ${String(error)}`);
	}
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new Error('csky-cdk.json 必须是 JSON 对象');
	}
	const config = value as Record<string, unknown>;
	if (config.schemaVersion !== 1) {
		throw new Error(`不支持的 csky-cdk.json 版本: ${String(config.schemaVersion)}`);
	}
	const workspace = optionalString(config.workspace, 'workspace');
	const projectFile = optionalString(config.projectFile, 'projectFile');
	if ((workspace === undefined) === (projectFile === undefined)) {
		throw new Error('workspace 与 projectFile 必须且只能设置一个');
	}
	return {
		schemaVersion: 1,
		...(workspace ? { workspace } : {}),
		...(projectFile ? { projectFile } : {}),
		project: requiredString(config.project, 'project'),
		buildConfig: requiredString(config.buildConfig, 'buildConfig'),
	};
}

function relativePath(
	folder: vscode.WorkspaceFolder,
	absolutePath: string,
): string {
	const relative = path.relative(folder.uri.fsPath, absolutePath);
	if (relative.startsWith('..') || path.isAbsolute(relative)) {
		throw new Error(`配置路径不在 Workspace Folder 中: ${absolutePath}`);
	}
	return relative.split(path.sep).join('/');
}

function requiredString(value: unknown, name: string): string {
	const result = optionalString(value, name);
	if (!result) {
		throw new Error(`${name} 必须是非空字符串`);
	}
	return result;
}

function optionalString(value: unknown, name: string): string | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (typeof value !== 'string') {
		throw new Error(`${name} 必须是字符串`);
	}
	return value;
}
