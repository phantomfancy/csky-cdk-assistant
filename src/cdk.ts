import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { XMLParser } from 'fast-xml-parser';
import { normalizePathSeparators } from './pathUtils';
import {
    BuildAction,
    DiscoveryIssue,
    DiscoveryReport,
    ProjectInfo,
    Selection,
    WorkspaceInfo,
} from './types';

const defaultCdkMakePath = 'C:/Program Files/C-Sky/CDK/cdk-make.exe';
const defaultExcludePattern = '**/{.git,node_modules,target,dist,out}/**';
const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: false,
    trimValues: true,
});

type XmlObject = Record<string, unknown>;

export function resolveCdkMakePath(selection?: Selection): string {
    const configured = vscode.workspace
        .getConfiguration('csky-cdk-assistant')
        .get<string>('cdkMakePath')
        ?.trim();
    const selected = selection?.cdkMakePath?.trim();
    const executable = normalizePathSeparators(
        selected && selection && !path.isAbsolute(selected)
            ? path.resolve(path.dirname(selection.workspace), selected)
            : selected || configured || defaultCdkMakePath,
    );
    let stat: fs.Stats;
    try {
        stat = fs.statSync(executable);
    } catch {
        throw new Error(
            `找不到 cdk-make.exe: ${executable}。请设置项目 csky-cdk.json 或全局 csky-cdk-assistant.cdkMakePath`,
        );
    }
    if (!stat.isFile()) {
        throw new Error(`cdk-make.exe 不是文件: ${executable}`);
    }
    return executable;
}

export function inspectCdkMake(executable: string): {
    size: number;
    modified: Date;
} {
    const stat = fs.statSync(executable);
    if (!stat.isFile()) {
        throw new Error(`cdk-make.exe 不是文件: ${executable}`);
    }
    return { size: stat.size, modified: stat.mtime };
}

export async function discoverProjects(
    folder: vscode.WorkspaceFolder,
): Promise<DiscoveryReport> {
    const issues: DiscoveryIssue[] = [];
    const workspaceUris = await discoverByExtension(folder, 'cdkws');
    const workspaceResults = await Promise.all(workspaceUris.map(async (uri): Promise<{
        workspace?: WorkspaceInfo;
        issues: DiscoveryIssue[];
    }> => {
        try {
            return await parseWorkspaceFile(uri);
        } catch (error) {
            return {
                issues: [{
                    path: normalizePathSeparators(uri.fsPath),
                    message: errorMessage(error),
                }],
            };
        }
    }));
    const workspaces: WorkspaceInfo[] = [];
    for (const result of workspaceResults) {
        issues.push(...result.issues);
        if (result.workspace) {
            workspaces.push(result.workspace);
        }
    }
    workspaces.sort((left, right) => left.path.localeCompare(right.path));

    return {
        root: normalizePathSeparators(folder.uri.fsPath),
        workspaces,
        issues,
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
        path: normalizePathSeparators(projectPath),
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
    const args = ['-w', normalizePathSeparators(selection.workspace)];
    if (all) {
        args.push('-a');
    } else {
        args.push('-p', selection.project, '-c', selection.buildConfig);
    }
    args.push('-d', action);
    return args;
}

async function parseWorkspaceFile(uri: vscode.Uri): Promise<{
    workspace: WorkspaceInfo;
    issues: DiscoveryIssue[];
}> {
    const document = object(xmlParser.parse(await readText(uri)), 'XML document');
    const workspace = object(document.CDK_Workspace, 'CDK_Workspace');
    const projectNodes = values(workspace.Project).map((value) =>
        object(value, 'Project'));
    const defaults = workspaceDefaults(workspace);
    const projectResults = await Promise.all(projectNodes.map(async (projectNode) => {
        let projectPath: string | undefined;
        try {
            const name = attribute(projectNode, 'Name');
            const relativePath = attribute(projectNode, 'Path');
            projectPath = path.resolve(path.dirname(uri.fsPath), relativePath);
            return {
                project: await parseProjectFile(
                    vscode.Uri.file(projectPath),
                    defaults.get(name),
                ),
            };
        } catch (error) {
            return {
                issue: {
                    path: normalizePathSeparators(projectPath ?? uri.fsPath),
                    message: errorMessage(error),
                },
            };
        }
    }));
    const projects = projectResults.flatMap((result) =>
        result.project ? [result.project] : []);
    const activeProject = projectNodes
        .find((project) => optionalAttribute(project, 'Active')?.toLowerCase() === 'yes');

    return {
        workspace: {
            name: attribute(workspace, 'Name'),
            path: normalizePathSeparators(uri.fsPath),
            activeProject: activeProject
                ? attribute(activeProject, 'Name')
                : undefined,
            projects,
        },
        issues: projectResults.flatMap((result) =>
            result.issue ? [result.issue] : []),
    };
}

async function parseProjectFile(
    uri: vscode.Uri,
    defaultBuildConfig?: string,
): Promise<ProjectInfo> {
    try {
        return parseProjectXml(await readText(uri), uri.fsPath, defaultBuildConfig);
    } catch (error) {
        throw new Error(
            `无法解析 ${normalizePathSeparators(uri.fsPath)}: ${errorMessage(error)}`,
        );
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
    extension: 'cdkws',
): Promise<vscode.Uri[]> {
    const entries = await vscode.workspace.fs.readDirectory(folder.uri);
    const immediate = entries
        .filter(([name, type]) =>
            type === vscode.FileType.File &&
            name.toLowerCase().endsWith(`.${extension}`))
        .map(([name]) => vscode.Uri.joinPath(folder.uri, name));
    if (immediate.length > 0) {
        return immediate.sort((left, right) =>
            normalizePathSeparators(left.fsPath).localeCompare(
                normalizePathSeparators(right.fsPath),
            ));
    }
    const found = await vscode.workspace.findFiles(
        new vscode.RelativePattern(folder, `**/*.${extension}`),
        discoveryExcludePattern(folder),
    );
    return found.sort((left, right) =>
        normalizePathSeparators(left.fsPath).localeCompare(
            normalizePathSeparators(right.fsPath),
        ));
}

function discoveryExcludePattern(folder: vscode.WorkspaceFolder): string {
    const configured = vscode.workspace
        .getConfiguration('csky-cdk-assistant', folder.uri)
        .get<string>('discoveryExclude')
        ?.trim();
    return configured || defaultExcludePattern;
}

async function readText(uri: vscode.Uri): Promise<string> {
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(
            await vscode.workspace.fs.readFile(uri),
        );
    } catch (error) {
        throw new Error(
            `无法读取 ${normalizePathSeparators(uri.fsPath)}: ${errorMessage(error)}`,
        );
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
