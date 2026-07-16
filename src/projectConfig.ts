import * as path from 'path';
import * as vscode from 'vscode';
import { normalizePathSeparators } from './pathUtils';
import { ProjectConfig, Selection } from './types';

const configDirectory = '.vscode';
const configFileName = 'csky-cdk.json';
const configSearchExclude = '**/{.git,node_modules,target,dist,out}/**';

export function projectConfigUri(
    folder: vscode.WorkspaceFolder,
    selection?: Selection,
): vscode.Uri {
    const root = selection
        ? projectRoot(folder, selection.workspace)
        : folder.uri.fsPath;
    return vscode.Uri.file(path.join(root, configDirectory, configFileName));
}

export async function loadSelection(
    folder: vscode.WorkspaceFolder,
): Promise<Selection | undefined> {
    const defaultUri = projectConfigUri(folder);
    const candidates = [defaultUri];
    const discovered = await vscode.workspace.findFiles(
        new vscode.RelativePattern(folder, `**/${configDirectory}/${configFileName}`),
        configSearchExclude,
    );
    for (const uri of discovered) {
        if (!candidates.some((candidate) => samePath(candidate.fsPath, uri.fsPath))) {
            candidates.push(uri);
        }
    }
    const configured = (await Promise.all(candidates.map(async (uri) => {
        try {
            return await readSelection(folder, uri);
        } catch (error) {
            if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
                return undefined;
            }
            throw error;
        }
    }))).flatMap((selection) => selection ? [selection] : []);
    const colocated = configured.filter((candidate) =>
        samePath(
            candidate.configUri.fsPath,
            projectConfigUri(folder, candidate.selection).fsPath,
        ));
    if (colocated.length > 1) {
        throw ambiguousConfigurationError();
    }
    if (colocated.length === 1) {
        const selected = colocated[0];
        const hasDifferentWorkspace = configured.some((candidate) =>
            !samePath(candidate.selection.workspace, selected.selection.workspace));
        if (hasDifferentWorkspace) {
            throw ambiguousConfigurationError();
        }
        return selected.selection;
    }
    if (configured.length <= 1) {
        return configured[0]?.selection;
    }
    throw ambiguousConfigurationError();
}

export async function saveSelection(
    folder: vscode.WorkspaceFolder,
    selection: Selection,
): Promise<void> {
    const target = projectConfigUri(folder, selection);
    const directory = vscode.Uri.file(path.dirname(target.fsPath));
    const temporary = vscode.Uri.joinPath(
        directory,
        `${configFileName}.${process.pid}.tmp`,
    );
    const config: ProjectConfig = {
        schemaVersion: 1,
        workspace: relativePath(target, selection.workspace),
        project: selection.project,
        buildConfig: selection.buildConfig,
        ...(selection.cdkMakePath ? { cdkMakePath: selection.cdkMakePath } : {}),
    };
    await vscode.workspace.fs.createDirectory(directory);
    await vscode.workspace.fs.writeFile(
        temporary,
        new TextEncoder().encode(`${JSON.stringify(config, undefined, 2)}\r\n`),
    );
    await vscode.workspace.fs.rename(temporary, target, { overwrite: true });
}

export function selectionsEqual(
    left: Selection | undefined,
    right: Selection | undefined,
): boolean {
    if (!left || !right) {
        return left === right;
    }
    return samePath(left.workspace, right.workspace) &&
        left.project === right.project &&
        left.buildConfig === right.buildConfig &&
        sameOptionalPath(left.cdkMakePath, right.cdkMakePath);
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
    if (config.projectFile !== undefined) {
        throw new Error('不支持独立 .cdkproj 配置，请设置 workspace');
    }
    const cdkMakePath = optionalNonEmptyString(config.cdkMakePath, 'cdkMakePath');
    return {
        schemaVersion: 1,
        workspace: requiredString(config.workspace, 'workspace'),
        project: requiredString(config.project, 'project'),
        buildConfig: requiredString(config.buildConfig, 'buildConfig'),
        ...(cdkMakePath ? { cdkMakePath } : {}),
    };
}

async function readSelection(
    folder: vscode.WorkspaceFolder,
    uri: vscode.Uri,
): Promise<{
    configUri: vscode.Uri;
    selection: Selection;
}> {
    const config = parseProjectConfig(
        new TextDecoder('utf-8', { fatal: true }).decode(
            await vscode.workspace.fs.readFile(uri),
        ),
    );
    const root = path.dirname(path.dirname(uri.fsPath));
    const workspace = path.resolve(root, config.workspace);
    projectRoot(folder, workspace);
    if (path.extname(workspace).toLowerCase() !== '.cdkws') {
        throw new Error(`workspace 必须指向 .cdkws 文件: ${config.workspace}`);
    }
    return {
        configUri: uri,
        selection: {
            workspace: normalizePathSeparators(workspace),
            project: config.project,
            buildConfig: config.buildConfig,
            cdkMakePath: config.cdkMakePath,
        },
    };
}

function relativePath(
    target: vscode.Uri,
    absolutePath: string,
): string {
    const root = path.dirname(path.dirname(target.fsPath));
    const relative = path.relative(root, absolutePath);
    if (isOutside(relative)) {
        throw new Error(
            `配置路径不在项目目录中: ${normalizePathSeparators(absolutePath)}`,
        );
    }
    return normalizePathSeparators(relative);
}

function projectRoot(folder: vscode.WorkspaceFolder, workspace: string): string {
    const root = path.dirname(workspace);
    const relative = path.relative(folder.uri.fsPath, root);
    if (isOutside(relative)) {
        throw new Error(
            `CDK Workspace 不在 VS Code Workspace Folder 中: ${normalizePathSeparators(workspace)}`,
        );
    }
    return root;
}

function isOutside(relativePath: string): boolean {
    return relativePath === '..' ||
        relativePath.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativePath);
}

function samePath(left: string, right: string): boolean {
    return normalizePathSeparators(left).toLowerCase() ===
        normalizePathSeparators(right).toLowerCase();
}

function sameOptionalPath(
    left: string | undefined,
    right: string | undefined,
): boolean {
    if (!left || !right) {
        return left === right;
    }
    return samePath(left, right);
}

function ambiguousConfigurationError(): Error {
    return new Error(
        '找到多个 csky-cdk.json，无法确定当前项目；请分别作为 VS Code Workspace Folder 打开',
    );
}

function requiredString(value: unknown, name: string): string {
    const result = optionalString(value, name);
    if (!result?.trim()) {
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

function optionalNonEmptyString(value: unknown, name: string): string | undefined {
    const result = optionalString(value, name);
    if (result !== undefined && !result.trim()) {
        throw new Error(`${name} 必须是非空字符串`);
    }
    return result;
}
