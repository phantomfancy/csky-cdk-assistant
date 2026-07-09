import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import * as vscode from 'vscode';
import { DiscoveryReport, Envelope } from './types';

const execFile = util.promisify(childProcess.execFile);
const protocolVersion = 1;

export function parseEnvelope<T>(text: string): T {
	let envelope: Envelope<T>;
	try {
		envelope = JSON.parse(text) as Envelope<T>;
	} catch (error) {
		throw new Error(`cdk-make-assistant 返回了无效 JSON: ${String(error)}`);
	}
	if (envelope.schemaVersion !== protocolVersion) {
		throw new Error(
			`不兼容的 cdk-make-assistant 协议版本 ${envelope.schemaVersion}，扩展需要版本 ${protocolVersion}`,
		);
	}
	if (!envelope.ok || envelope.data === undefined) {
		throw new Error(envelope.error?.message ?? 'cdk-make-assistant 执行失败');
	}
	return envelope.data;
}

export class AssistantClient {
	public constructor(private readonly executable: string) {}

	public async inspect(root: string): Promise<DiscoveryReport> {
		const { stdout } = await execFile(
			this.executable,
			['inspect', root, '--format', 'json'],
			{ windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
		);
		return parseEnvelope<DiscoveryReport>(stdout);
	}

	public async setCdkMakePath(cdkMakePath: string): Promise<void> {
		await execFile(
			this.executable,
			['config', 'set', 'cdk-make', cdkMakePath],
			{ windowsHide: true },
		);
	}

	public async persistSelection(
		root: string,
		workspace: string | undefined,
		projectFile: string | undefined,
		project: string,
		buildConfig: string,
	): Promise<void> {
		const args = ['configure', root, '--project', project, '--config', buildConfig, '--no-run'];
		if (workspace) {
			args.push('--workspace', workspace);
		} else if (projectFile) {
			args.push('--project-file', projectFile);
		}
		await execFile(this.executable, args, { windowsHide: true });
	}
}

export function resolveAssistantPath(context: vscode.ExtensionContext): string {
	const configured = vscode.workspace
		.getConfiguration('vscode-csky-cdk')
		.get<string>('assistantPath')
		?.trim();
	if (configured) {
		if (!fs.existsSync(configured)) {
			throw new Error(`配置的 cdk-make-assistant 不存在: ${configured}`);
		}
		return configured;
	}
	const bundled = context.asAbsolutePath(
		path.join('resources', 'win32-x64', 'cdk-make-assistant.exe'),
	);
	if (fs.existsSync(bundled)) {
		return bundled;
	}
	const development = path.resolve(
		context.extensionPath,
		'..',
		'cdk-make-assistant',
		'target',
		'debug',
		'cdk-make-assistant.exe',
	);
	if (fs.existsSync(development)) {
		return development;
	}
	throw new Error(
		'找不到 cdk-make-assistant.exe；请设置 vscode-csky-cdk.assistantPath 或重新打包扩展',
	);
}

