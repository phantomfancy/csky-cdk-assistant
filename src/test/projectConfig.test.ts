import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    loadSelection,
    parseProjectConfig,
    projectConfigUri,
    selectionsEqual,
} from '../projectConfig';

suite('C-SKY CDK project configuration', () => {
    test('parses workspace configuration', () => {
        assert.deepStrictEqual(
            parseProjectConfig(JSON.stringify({
                schemaVersion: 1,
                workspace: 'test/test.cdkws',
                project: 'app',
                buildConfig: 'BuildSet',
                cdkMakePath: 'D:/CDK/cdk-make.exe',
            })),
            {
                schemaVersion: 1,
                workspace: 'test/test.cdkws',
                project: 'app',
                buildConfig: 'BuildSet',
                cdkMakePath: 'D:/CDK/cdk-make.exe',
            },
        );
    });

    test('rejects a standalone project configuration', () => {
        assert.throws(
            () => parseProjectConfig(JSON.stringify({
                schemaVersion: 1,
                projectFile: 'app.cdkproj',
                project: 'app',
                buildConfig: 'BuildSet',
            })),
            /不支持独立 .cdkproj/,
        );
    });

    test('stores project configuration beside its cdkws file', () => {
        const root = path.join(os.tmpdir(), 'csky-cdk-assistant-project-root');
        const folder: vscode.WorkspaceFolder = {
            uri: vscode.Uri.file(root),
            name: 'work',
            index: 0,
        };
        const uri = projectConfigUri(folder, {
            workspace: path.join(root, 'firmware', 'app.cdkws'),
            project: 'app',
            buildConfig: 'BuildSet',
        });

        assert.strictEqual(
            uri.fsPath.toLowerCase(),
            path.join(root, 'firmware', '.vscode', 'csky-cdk.json').toLowerCase(),
        );
    });

    test('rejects a cdkws outside the VS Code workspace folder', () => {
        const root = path.join(os.tmpdir(), 'csky-cdk-assistant-project-root');
        const folder: vscode.WorkspaceFolder = {
            uri: vscode.Uri.file(root),
            name: 'project',
            index: 0,
        };

        assert.throws(
            () => projectConfigUri(folder, {
                workspace: path.join(os.tmpdir(), 'other-cdk-project', 'app.cdkws'),
                project: 'app',
                buildConfig: 'BuildSet',
            }),
            /不在 VS Code Workspace Folder 中/,
        );
    });

    test('prefers a config beside cdkws over its legacy root copy', async () => {
        const root = vscode.Uri.file(path.join(
            os.tmpdir(),
            `csky-cdk-assistant-config-${process.pid}-${Date.now()}`,
        ));
        const project = vscode.Uri.joinPath(root, 'firmware');
        const folder: vscode.WorkspaceFolder = {
            uri: root,
            name: 'work',
            index: 0,
        };
        try {
            await vscode.workspace.fs.createDirectory(
                vscode.Uri.joinPath(root, '.vscode'),
            );
            await vscode.workspace.fs.createDirectory(
                vscode.Uri.joinPath(project, '.vscode'),
            );
            await writeJson(vscode.Uri.joinPath(root, '.vscode', 'csky-cdk.json'), {
                schemaVersion: 1,
                workspace: 'firmware/app.cdkws',
                project: 'app',
                buildConfig: 'Debug',
                cdkMakePath: 'D:/CDK/old/cdk-make.exe',
            });
            await writeJson(vscode.Uri.joinPath(project, '.vscode', 'csky-cdk.json'), {
                schemaVersion: 1,
                workspace: 'app.cdkws',
                project: 'app',
                buildConfig: 'Release',
                cdkMakePath: 'D:/CDK/new/cdk-make.exe',
            });

            const selection = await loadSelection(folder);

            assert.strictEqual(selection?.buildConfig, 'Release');
            assert.strictEqual(selection?.cdkMakePath, 'D:/CDK/new/cdk-make.exe');
        } finally {
            await vscode.workspace.fs.delete(root, { recursive: true, useTrash: false });
        }
    });

    test('compares selections with normalized path separators', () => {
        assert.strictEqual(
            selectionsEqual(
                {
                    workspace: String.raw`C:\work\test.cdkws`,
                    project: 'app',
                    buildConfig: 'BuildSet',
                },
                {
                    workspace: 'C:/work/test.cdkws',
                    project: 'app',
                    buildConfig: 'BuildSet',
                },
            ),
            true,
        );
        assert.strictEqual(
            selectionsEqual(
                {
                    workspace: 'C:/work/test.cdkws',
                    project: 'app',
                    buildConfig: 'BuildSet',
                    cdkMakePath: String.raw`D:\CDK\cdk-make.exe`,
                },
                {
                    workspace: 'C:/work/test.cdkws',
                    project: 'app2',
                    buildConfig: 'BuildSet',
                    cdkMakePath: 'D:/CDK/cdk-make.exe',
                },
            ),
            false,
        );
    });
});

async function writeJson(uri: vscode.Uri, value: unknown): Promise<void> {
    await vscode.workspace.fs.writeFile(
        uri,
        new TextEncoder().encode(JSON.stringify(value)),
    );
}

