import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { resolveWorkspaceMetadataFiles } from '../cdk';
import {
    makeFilesReadOnly,
    parseRunnerInvocation,
    restoreFileModes,
} from '../readOnlyCdkRunner';

suite('C-SKY CDK read-only runner', () => {
    test('validates the runner invocation', () => {
        assert.deepStrictEqual(
            parseRunnerInvocation(
                ['["app.cdkws"]', 'cdk-make.exe', '-w', 'app.cdkws'],
            ),
            {
                executable: 'cdk-make.exe',
                args: ['-w', 'app.cdkws'],
                protectedFilePaths: ['app.cdkws'],
            },
        );
        assert.throws(() => parseRunnerInvocation([]), /缺少受保护文件列表/);
        assert.throws(
            () => parseRunnerInvocation(['{}', 'cdk-make.exe']),
            /必须是非空路径数组/,
        );
    });

    test('protects all workspace metadata without changing any bytes', async () => {
        const root = vscode.Uri.file(path.join(
            os.tmpdir(),
            `csky-cdk-assistant-runner-${process.pid}-${Date.now()}`,
        ));
        const workspace = vscode.Uri.joinPath(root, 'test.cdkws');
        const project1 = vscode.Uri.joinPath(root, 'project1', 'project1.cdkproj');
        const project2 = vscode.Uri.joinPath(root, 'project2', 'project2.cdkproj');
        const contents = new Map<string, Buffer>([
            [workspace.fsPath, Buffer.from([
                '<CDK_Workspace Name="test">',
                '  <Project Name="project1" Path="project1/project1.cdkproj"/>',
                '  <Project Name="project2" Path="project2/project2.cdkproj"/>',
                '</CDK_Workspace>',
                '',
            ].join('\r\n'))],
            [project1.fsPath, Buffer.from('<Project Name="project1"/>\r\n')],
            [project2.fsPath, Buffer.from('<Project Name="project2"/>\r\n')],
        ]);
        try {
            await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(root, 'project1'));
            await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(root, 'project2'));
            for (const [filePath, bytes] of contents) {
                fs.writeFileSync(filePath, bytes);
            }
            const metadataFiles = resolveWorkspaceMetadataFiles(workspace.fsPath);
            assert.deepStrictEqual(
                metadataFiles.map((filePath) => path.normalize(filePath)),
                [workspace.fsPath, project1.fsPath, project2.fsPath].map(path.normalize),
            );

            const originalModes = new Map(
                metadataFiles.map((filePath) => [filePath, fs.statSync(filePath).mode]),
            );
            const fileModeSnapshots = makeFilesReadOnly(metadataFiles);
            try {
                for (const filePath of metadataFiles) {
                    assert.throws(() => fs.writeFileSync(filePath, 'modified'));
                }
            } finally {
                restoreFileModes(fileModeSnapshots);
            }

            for (const [filePath, bytes] of contents) {
                assert.deepStrictEqual(fs.readFileSync(filePath), bytes);
                assert.strictEqual(fs.statSync(filePath).mode, originalModes.get(filePath));
            }
        } finally {
            await vscode.workspace.fs.delete(root, { recursive: true, useTrash: false });
        }
    });
});
