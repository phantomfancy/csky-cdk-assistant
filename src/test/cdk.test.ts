import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    buildArguments,
    discoverProjects,
    parseProjectXml,
    resolveCdkMakePath,
} from '../cdk';

suite('C-SKY CDK XML parser', () => {
    test('parses project metadata and BuildSets', () => {
        const project = parseProjectXml(
            `<?xml version="1.0" encoding="UTF-8"?>
            <Project Name="app" Language="C" Type="Application Without OS">
                <BuildConfigs>
                    <BuildConfig Name="Debug"/>
                    <BuildConfig Name="Release"/>
                </BuildConfigs>
            </Project>`,
            String.raw`C:\work\app.cdkproj`,
            'Release',
        );

        assert.strictEqual(project.name, 'app');
        assert.strictEqual(project.path, 'C:/work/app.cdkproj');
        assert.strictEqual(project.language, 'C');
        assert.deepStrictEqual(project.buildConfigs, ['Debug', 'Release']);
        assert.strictEqual(project.defaultBuildConfig, 'Release');
    });

    test('uses the only BuildSet as default', () => {
        const project = parseProjectXml(
            `<Project Name="app"><BuildConfigs>
                <BuildConfig Name="BuildSet"/>
            </BuildConfigs></Project>`,
            'app.cdkproj',
        );

        assert.strictEqual(project.defaultBuildConfig, 'BuildSet');
    });

    test('discovers a multi-project workspace', async () => {
        const root = await createWorkspaceFixture();
        try {
            const report = await discoverProjects({
                uri: root,
                name: 'test_cdkws',
                index: 0,
            });

            assert.strictEqual(report.workspaces.length, 1);
            assert.strictEqual(report.root.includes('\\'), false);
            assert.strictEqual(report.workspaces[0].path.includes('\\'), false);
            assert.deepStrictEqual(
                report.workspaces[0].projects.map((project) => project.name),
                ['test_cdkproj', 'test2'],
            );
            for (const project of report.workspaces[0].projects) {
                assert.strictEqual(project.path.includes('\\'), false);
            }
            assert.deepStrictEqual(
                report.workspaces[0].projects[0].buildConfigs,
                ['BuildSet', 'TestBuildSet1', 'TestBuildSet2'],
            );
        } finally {
            await vscode.workspace.fs.delete(root, { recursive: true, useTrash: false });
        }
    });

    test('maps workspace selection to cdk-make arguments', () => {
        assert.deepStrictEqual(
            buildArguments({
                workspace: String.raw`C:\work\test.cdkws`,
                project: 'app',
                buildConfig: 'BuildSet',
            }, 'rebuild'),
            [
                '-w',
                'C:/work/test.cdkws',
                '-p',
                'app',
                '-c',
                'BuildSet',
                '-d',
                'rebuild',
            ],
        );
    });

    test('maps Build All to the workspace argument', () => {
        assert.deepStrictEqual(
            buildArguments({
                workspace: String.raw`C:\work\test.cdkws`,
                project: 'app',
                buildConfig: 'BuildSet',
            }, 'build', true),
            ['-w', 'C:/work/test.cdkws', '-a', '-d', 'build'],
        );
    });

    test('uses the project cdk-make path before the global setting', async () => {
        const root = vscode.Uri.file(path.join(
            os.tmpdir(),
            `csky-cdk-assistant-cdk-path-${process.pid}-${Date.now()}`,
        ));
        const executable = vscode.Uri.joinPath(root, 'tools', 'cdk-make.exe');
        try {
            await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(root, 'tools'));
            await vscode.workspace.fs.writeFile(executable, new Uint8Array());

            assert.strictEqual(
                resolveCdkMakePath({
                    workspace: vscode.Uri.joinPath(root, 'test.cdkws').fsPath,
                    project: 'app',
                    buildConfig: 'BuildSet',
                    cdkMakePath: 'tools/cdk-make.exe',
                }),
                executable.fsPath.replace(/\\/g, '/'),
            );
        } finally {
            await vscode.workspace.fs.delete(root, { recursive: true, useTrash: false });
        }
    });

    test('keeps valid projects when another project cannot be parsed', async () => {
        const root = vscode.Uri.file(path.join(
            os.tmpdir(),
            `csky-cdk-assistant-invalid-project-${process.pid}-${Date.now()}`,
        ));
        try {
            await vscode.workspace.fs.createDirectory(root);
            await writeText(vscode.Uri.joinPath(root, 'test.cdkws'), `
<CDK_Workspace Name="test">
    <Project Name="valid" Path="valid.cdkproj"/>
    <Project Name="invalid" Path="invalid.cdkproj"/>
</CDK_Workspace>`);
            await writeText(vscode.Uri.joinPath(root, 'valid.cdkproj'), `
<Project Name="valid"><BuildConfigs><BuildConfig Name="BuildSet"/>
</BuildConfigs></Project>`);
            await writeText(vscode.Uri.joinPath(root, 'invalid.cdkproj'), '<Project>');

            const report = await discoverProjects({
                uri: root,
                name: 'invalid_project_fixture',
                index: 0,
            });

            assert.deepStrictEqual(
                report.workspaces[0].projects.map((project) => project.name),
                ['valid'],
            );
            assert.strictEqual(report.issues.length, 1);
            assert.match(report.issues[0].path, /invalid\.cdkproj$/);
        } finally {
            await vscode.workspace.fs.delete(root, { recursive: true, useTrash: false });
        }
    });

    test('reports a malformed workspace without hiding valid workspaces', async () => {
        const root = await createWorkspaceFixture();
        try {
            await writeText(vscode.Uri.joinPath(root, 'invalid.cdkws'), '<CDK_Workspace>');

            const report = await discoverProjects({
                uri: root,
                name: 'invalid_workspace_fixture',
                index: 0,
            });

            assert.strictEqual(report.workspaces.length, 1);
            assert.strictEqual(report.issues.length, 1);
            assert.match(report.issues[0].path, /invalid\.cdkws$/);
        } finally {
            await vscode.workspace.fs.delete(root, { recursive: true, useTrash: false });
        }
    });
});

async function createWorkspaceFixture(): Promise<vscode.Uri> {
    const root = vscode.Uri.file(path.join(
        os.tmpdir(),
        `csky-cdk-assistant-test-${process.pid}-${Date.now()}`,
    ));
    const project1Dir = vscode.Uri.joinPath(root, 'test_cdkproj');
    const project2Dir = vscode.Uri.joinPath(root, 'test2');
    await vscode.workspace.fs.createDirectory(project1Dir);
    await vscode.workspace.fs.createDirectory(project2Dir);
    await writeText(vscode.Uri.joinPath(root, 'test.cdkws'), `
<CDK_Workspace Name="test_cdkws">
    <Project Name="test_cdkproj" Path="test_cdkproj/test_cdkproj.cdkproj" Active="yes"/>
    <Project Name="test2" Path="test2/test2.cdkproj"/>
    <BuildMatrix>
        <WorkspaceConfiguration Name="Debug" Selected="yes">
            <Project Name="test_cdkproj" ConfigName="BuildSet"/>
            <Project Name="test2" ConfigName="BuildSet"/>
        </WorkspaceConfiguration>
    </BuildMatrix>
</CDK_Workspace>`);
    await writeText(vscode.Uri.joinPath(project1Dir, 'test_cdkproj.cdkproj'), `
<Project Name="test_cdkproj" Language="C" Type="Application Without OS">
    <BuildConfigs>
        <BuildConfig Name="BuildSet"/>
        <BuildConfig Name="TestBuildSet1"/>
        <BuildConfig Name="TestBuildSet2"/>
    </BuildConfigs>
</Project>`);
    await writeText(vscode.Uri.joinPath(project2Dir, 'test2.cdkproj'), `
<Project Name="test2" Language="C" Type="Application Without OS">
    <BuildConfigs>
        <BuildConfig Name="BuildSet"/>
    </BuildConfigs>
</Project>`);
    return root;
}

async function writeText(uri: vscode.Uri, content: string): Promise<void> {
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content.trim()));
}
