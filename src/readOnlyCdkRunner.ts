import * as fs from 'fs';
import { ChildProcess, spawn } from 'child_process';

interface FileModeSnapshot {
    filePath: string;
    mode: number;
}

interface RunnerInvocation {
    executable: string;
    args: string[];
    protectedFilePaths: string[];
}

async function main(): Promise<void> {
    let fileModeSnapshots: FileModeSnapshot[] = [];
    let restorePending = false;
    const restoreOriginalFileModes = (): void => {
        if (!restorePending) {
            return;
        }
        restoreFileModes(fileModeSnapshots);
        restorePending = false;
    };
    const restoreOnProcessExit = (): void => {
        try {
            restoreOriginalFileModes();
        } catch (error) {
            reportFailure(`恢复 CDK 工程元数据权限失败: ${errorMessage(error)}`);
        }
    };
    process.once('exit', restoreOnProcessExit);

    let stage = '解析执行参数';
    try {
        const invocation = parseRunnerInvocation(process.argv.slice(2));
        stage = '保护 CDK 工程元数据';
        fileModeSnapshots = makeFilesReadOnly(invocation.protectedFilePaths);
        restorePending = true;
        stage = '运行 cdk-make.exe';
        process.exitCode = await runCdkMake(invocation.executable, invocation.args);
    } catch (error) {
        reportFailure(`${stage}失败: ${errorMessage(error)}`);
    } finally {
        try {
            restoreOriginalFileModes();
        } catch (error) {
            reportFailure(`恢复 CDK 工程元数据权限失败: ${errorMessage(error)}`);
        }
        if (!restorePending) {
            process.off('exit', restoreOnProcessExit);
        }
    }
}

export function parseRunnerInvocation(rawArgs: readonly string[]): RunnerInvocation {
    const [protectedFilePathsJson, executable, ...args] = rawArgs;
    if (!protectedFilePathsJson) {
        throw new Error('缺少受保护文件列表');
    }
    if (!executable) {
        throw new Error('缺少 cdk-make.exe 路径');
    }
    let protectedFilePaths: unknown;
    try {
        protectedFilePaths = JSON.parse(protectedFilePathsJson);
    } catch (error) {
        throw new Error(`受保护文件列表不是有效 JSON: ${errorMessage(error)}`);
    }
    if (
        !Array.isArray(protectedFilePaths) ||
        protectedFilePaths.length === 0 ||
        protectedFilePaths.some((filePath) =>
            typeof filePath !== 'string' || filePath.length === 0)
    ) {
        throw new Error('受保护文件列表必须是非空路径数组');
    }
    return {
        executable,
        args,
        protectedFilePaths: protectedFilePaths as string[],
    };
}

export function makeFilesReadOnly(filePaths: readonly string[]): FileModeSnapshot[] {
    const fileModeSnapshots: FileModeSnapshot[] = [];
    try {
        for (const filePath of filePaths) {
            const mode = fs.statSync(filePath).mode;
            fs.chmodSync(filePath, mode & ~0o222);
            fileModeSnapshots.push({ filePath, mode });
        }
        return fileModeSnapshots;
    } catch (error) {
        restoreFileModes(fileModeSnapshots);
        throw error;
    }
}

export function restoreFileModes(fileModeSnapshots: readonly FileModeSnapshot[]): void {
    let firstError: unknown;
    for (const { filePath, mode } of [...fileModeSnapshots].reverse()) {
        try {
            fs.chmodSync(filePath, mode);
        } catch (error) {
            firstError ??= error;
        }
    }
    if (firstError) {
        throw firstError instanceof Error
            ? firstError
            : new Error(String(firstError));
    }
}

async function runCdkMake(
    executable: string,
    args: readonly string[],
): Promise<number> {
    const childEnvironment = { ...process.env };
    delete childEnvironment.ELECTRON_RUN_AS_NODE;
    const child = spawn(executable, args, {
        cwd: process.cwd(),
        env: childEnvironment,
        stdio: 'inherit',
        windowsHide: true,
    });
    const signalHandlers = registerSignalHandlers(child);
    try {
        return await new Promise<number>((resolve, reject) => {
            child.once('error', reject);
            child.once('close', (code) => resolve(code ?? 1));
        });
    } finally {
        for (const [signal, handler] of signalHandlers) {
            process.off(signal, handler);
        }
    }
}

function registerSignalHandlers(
    child: ChildProcess,
): ReadonlyArray<[NodeJS.Signals, () => void]> {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    return signals.map((signal) => {
        const handler = (): void => {
            if (!child.killed) {
                child.kill(signal);
            }
        };
        process.on(signal, handler);
        return [signal, handler];
    });
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function reportFailure(messageText: string): void {
    process.stderr.write(`C-SKY CDK: ${messageText}\n`);
    process.exitCode = 1;
}

if (require.main === module) {
    void main();
}
