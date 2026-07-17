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
        const readOnlySetting = extension.packageJSON.contributes
            .configuration.properties['csky-cdk-assistant.readOnlyMode'];
        assert.strictEqual(readOnlySetting.type, 'boolean');
        assert.strictEqual(readOnlySetting.default, false);

        const commands = await vscode.commands.getCommands(true);
        for (const command of extension.packageJSON.contributes.commands) {
            assert.ok(
                commands.includes(command.command),
                `${command.command} was not registered`,
            );
        }
    });

    test('resolves configured tasks in read-only and native modes', async () => {
        const root = vscode.Uri.file(path.join(
            os.tmpdir(),
            `csky-cdk-assistant-task-${process.pid}-${Date.now()}`,
        ));
        const executable = vscode.Uri.joinPath(root, 'cdk-make.exe');
        const workspace = vscode.Uri.joinPath(root, 'app.cdkws');
        const project = vscode.Uri.joinPath(root, 'app.cdkproj');
        const folder: vscode.WorkspaceFolder = {
            uri: root,
            name: 'task-fixture',
            index: 0,
        };
        try {
            await vscode.workspace.fs.createDirectory(root);
            await vscode.workspace.fs.writeFile(executable, new Uint8Array());
            await vscode.workspace.fs.writeFile(
                workspace,
                new TextEncoder().encode(
                    '<CDK_Workspace Name="app">' +
                    '<Project Name="app" Path="app.cdkproj"/>' +
                    '</CDK_Workspace>',
                ),
            );
            await vscode.workspace.fs.writeFile(
                project,
                new TextEncoder().encode('<Project Name="app"/>'),
            );
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

            const resolved = await new CdkTaskProvider(true).resolveTask(unresolved);

            assert.ok(resolved);
            assert.ok(resolved.execution instanceof vscode.ProcessExecution);
            assert.strictEqual(resolved.execution.options?.cwd, root.fsPath);
            assert.strictEqual(resolved.execution.process, process.execPath);
            assert.strictEqual(
                resolved.execution.options?.env?.ELECTRON_RUN_AS_NODE,
                '1',
            );
            assert.deepStrictEqual(
                resolved.execution.args.slice(3),
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
            assert.match(resolved.execution.args[0], /readOnlyCdkRunner\.js$/);
            assert.deepStrictEqual(
                JSON.parse(resolved.execution.args[1]).map(path.normalize),
                [workspace.fsPath, project.fsPath].map(path.normalize),
            );
            assert.strictEqual(
                resolved.execution.args[2],
                executable.fsPath.replace(/\\/g, '/'),
            );

            const writable = await new CdkTaskProvider().resolveTask(unresolved);

            assert.ok(writable);
            assert.ok(writable.execution instanceof vscode.ProcessExecution);
            assert.strictEqual(
                writable.execution.process,
                executable.fsPath.replace(/\\/g, '/'),
            );
            assert.deepStrictEqual(
                writable.execution.args,
                resolved.execution.args.slice(3),
            );
            assert.strictEqual(writable.execution.options?.cwd, root.fsPath);
            assert.strictEqual(writable.execution.options?.env, undefined);
        } finally {
            await vscode.workspace.fs.delete(root, { recursive: true, useTrash: false });
        }
    });
});
