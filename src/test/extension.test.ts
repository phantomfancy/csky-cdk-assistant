import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { CdkTaskProvider } from '../extensionMain';
import { saveSelection } from '../projectConfig';

suite('Extension Test Suite', () => {
    test('activates and registers its public commands', async () => {
        const extension = vscode.extensions.getExtension(
            'phantomfancy.csky-cdk-assistant',
        );
        assert.ok(extension, 'development extension was not loaded');
        await extension.activate();

        const commands = await vscode.commands.getCommands(true);
        for (const command of [
            'csky-cdk-assistant.build',
            'csky-cdk-assistant.configureCdkMake',
            'csky-cdk-assistant.doctor',
            'csky-cdk-assistant.selectWorkspace',
        ]) {
            assert.ok(commands.includes(command), `${command} was not registered`);
        }
    });

    test('resolves a configured task with the workspace as cwd', async () => {
        const root = vscode.Uri.file(path.join(
            os.tmpdir(),
            `csky-cdk-assistant-task-${process.pid}-${Date.now()}`,
        ));
        const executable = vscode.Uri.joinPath(root, 'cdk-make.exe');
        const workspace = vscode.Uri.joinPath(root, 'app.cdkws');
        const folder: vscode.WorkspaceFolder = {
            uri: root,
            name: 'task-fixture',
            index: 0,
        };
        try {
            await vscode.workspace.fs.createDirectory(root);
            await vscode.workspace.fs.writeFile(executable, new Uint8Array());
            await saveSelection(folder, {
                workspace: workspace.fsPath,
                project: 'app',
                buildConfig: 'Debug',
                cdkMakePath: executable.fsPath,
            });
            const unresolved = new vscode.Task(
                { type: 'csky-cdk', action: 'build' },
                folder,
                'fixture',
                'csky-cdk',
            );

            const resolved = await new CdkTaskProvider().resolveTask(unresolved);

            assert.ok(resolved);
            assert.ok(resolved.execution instanceof vscode.ProcessExecution);
            assert.strictEqual(resolved.execution.options?.cwd, root.fsPath);
            assert.deepStrictEqual(
                resolved.execution.args,
                [
                    '-w',
                    workspace.fsPath.replace(/\\/g, '/'),
                    '-p',
                    'app',
                    '-c',
                    'Debug',
                    '-d',
                    'build',
                ],
            );
        } finally {
            await vscode.workspace.fs.delete(root, { recursive: true, useTrash: false });
        }
    });
});
