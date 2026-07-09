import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { XMLParser } from 'fast-xml-parser';
import {
	BuildAction,
	DiscoveryReport,
	ProjectInfo,
	Selection,
	WorkspaceInfo,
} from './types';

const defaultCdkMakePath = String.raw`C:\Program Files\C-Sky\CDK\cdk-make.exe`;
const excludePattern = '**/{.git,node_modules,target,dist,out}/**';
const xmlParser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	parseAttributeValue: false,
	trimValues: true,
});

type XmlObject = Record<string, unknown>;

export function resolveCdkMakePath(): string {
	const configured = vscode.workspace
		.getConfiguration('csky-cdk-assistant')
		.get<string>('cdkMakePath')
		?.trim();
	const executable = configured || defaultCdkMakePath;
	if (!fs.existsSync(executable)) {
		throw new Error(
			`找不到 cdk-make.exe: ${executable}。请设置 csky-cdk-assistant.cdkMakePath`,
		);
	}
	return executable;
}

export async function discoverProjects(
	folder: vscode.WorkspaceFolder,
): Promise<DiscoveryReport> {
	const workspaceUris = await discoverByExtension(folder, 'cdkws');
	const workspaces = await Promise.all(workspaceUris.map(parseWorkspaceFile));
	workspaces.sort((left, right) => left.path.localeCompare(right.path));

	let standaloneProjects: ProjectInfo[] = [];
	if (workspaces.length === 0) {
		const projectUris = await discoverByExtension(folder, 'cdkproj');
		standaloneProjects = await Promise.all(
			projectUris.map((uri) => parseProjectFile(uri)),
		);
		standaloneProjects.sort((left, right) => left.path.localeCompare(right.path));
	}

	return {
		root: folder.uri.fsPath,
		workspaces,
		standaloneProjects,
	};
}

export function parseProjectXml(
	xml: string,
	projectPath: string,
	defaultBuildConfig?: string,
): ProjectInfo {
	const document = object(xmlParser.parse(xml), 'XML document');
	const project = object(document.Project, 'Project');
	const buildConfigsNode = optionalObject(project.BuildConfigs);
	const buildConfigs = buildConfigsNode
		? values(buildConfigsNode.BuildConfig).map((value) =>
			attribute(object(value, 'BuildConfig'), 'Name'))
		: [];
	const validDefault = defaultBuildConfig &&
		buildConfigs.includes(defaultBuildConfig)
		? defaultBuildConfig
		: buildConfigs.length === 1
			? buildConfigs[0]
			: undefined;

	return {
		name: attribute(project, 'Name'),
		path: projectPath,
		language: optionalAttribute(project, 'Language'),
		projectType: optionalAttribute(project, 'Type'),
		buildConfigs,
		defaultBuildConfig: validDefault,
	};
}

export function buildArguments(
	selection: Selection,
	action: BuildAction,
	all = false,
): string[] {
	const args: string[] = [];
	if (selection.workspace) {
		args.push('-w', selection.workspace);
		if (all) {
			args.push('-a');
		} else {
			args.push('-p', selection.project, '-c', selection.buildConfig);
		}
	} else if (selection.projectFile) {
		if (all) {
			throw new Error('直接 .cdkproj 模式不支持 Build All');
		}
		args.push('-p', selection.projectFile, '-c', selection.buildConfig);
	} else {
		throw new Error('缺少 Workspace 或 Project 文件配置');
	}
	args.push('-d', action);
	return args;
}

async function parseWorkspaceFile(uri: vscode.Uri): Promise<WorkspaceInfo> {
	const document = object(xmlParser.parse(await readText(uri)), 'XML document');
	const workspace = object(document.CDK_Workspace, 'CDK_Workspace');
	const projectNodes = values(workspace.Project).map((value) =>
		object(value, 'Project'));
	const defaults = workspaceDefaults(workspace);
	const projects = await Promise.all(projectNodes.map(async (projectNode) => {
		const name = attribute(projectNode, 'Name');
		const relativePath = attribute(projectNode, 'Path');
		const projectPath = path.resolve(path.dirname(uri.fsPath), relativePath);
		return parseProjectFile(vscode.Uri.file(projectPath), defaults.get(name));
	}));
	const activeProject = projectNodes
		.find((project) => optionalAttribute(project, 'Active')?.toLowerCase() === 'yes');

	return {
		name: attribute(workspace, 'Name'),
		path: uri.fsPath,
		activeProject: activeProject
			? attribute(activeProject, 'Name')
			: undefined,
		projects,
	};
}

async function parseProjectFile(
	uri: vscode.Uri,
	defaultBuildConfig?: string,
): Promise<ProjectInfo> {
	try {
		return parseProjectXml(await readText(uri), uri.fsPath, defaultBuildConfig);
	} catch (error) {
		throw new Error(`无法解析 ${uri.fsPath}: ${errorMessage(error)}`);
	}
}

function workspaceDefaults(workspace: XmlObject): Map<string, string> {
	const buildMatrix = optionalObject(workspace.BuildMatrix);
	if (!buildMatrix) {
		return new Map();
	}
	const configurations = values(buildMatrix.WorkspaceConfiguration)
		.map((value) => object(value, 'WorkspaceConfiguration'));
	const selected = configurations.find(
		(configuration) =>
			optionalAttribute(configuration, 'Selected')?.toLowerCase() === 'yes',
	) ?? configurations[0];
	if (!selected) {
		return new Map();
	}
	return new Map(
		values(selected.Project).map((value) => {
			const project = object(value, 'BuildMatrix Project');
			return [
				attribute(project, 'Name'),
				attribute(project, 'ConfigName'),
			];
		}),
	);
}

async function discoverByExtension(
	folder: vscode.WorkspaceFolder,
	extension: 'cdkws' | 'cdkproj',
): Promise<vscode.Uri[]> {
	const entries = await vscode.workspace.fs.readDirectory(folder.uri);
	const immediate = entries
		.filter(([name, type]) =>
			type === vscode.FileType.File &&
			name.toLowerCase().endsWith(`.${extension}`))
		.map(([name]) => vscode.Uri.joinPath(folder.uri, name));
	if (immediate.length > 0) {
		return immediate.sort((left, right) =>
			left.fsPath.localeCompare(right.fsPath));
	}
	const found = await vscode.workspace.findFiles(
		new vscode.RelativePattern(folder, `**/*.${extension}`),
		excludePattern,
	);
	return found.sort((left, right) => left.fsPath.localeCompare(right.fsPath));
}

async function readText(uri: vscode.Uri): Promise<string> {
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(
			await vscode.workspace.fs.readFile(uri),
		);
	} catch (error) {
		throw new Error(`无法读取 ${uri.fsPath}: ${errorMessage(error)}`);
	}
}

function object(value: unknown, name: string): XmlObject {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new Error(`缺少或无效的 ${name} 节点`);
	}
	return value as XmlObject;
}

function optionalObject(value: unknown): XmlObject | undefined {
	return value === undefined ? undefined : object(value, 'XML');
}

function values(value: unknown): unknown[] {
	if (value === undefined) {
		return [];
	}
	return Array.isArray(value) ? value : [value];
}

function attribute(value: XmlObject, name: string): string {
	const result = optionalAttribute(value, name);
	if (!result) {
		throw new Error(`缺少 XML 属性 ${name}`);
	}
	return result;
}

function optionalAttribute(value: XmlObject, name: string): string | undefined {
	const attributeValue = value[`@_${name}`];
	return typeof attributeValue === 'string' ? attributeValue : undefined;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
