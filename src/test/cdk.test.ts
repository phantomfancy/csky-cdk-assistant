import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { buildArguments, discoverProjects, parseProjectXml } from '../cdk';

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

	test('discovers the real multi-project fixture', async () => {
		const fixture = path.resolve(__dirname, '..', '..', '..', 'test_cdkws');
		const report = await discoverProjects({
			uri: vscode.Uri.file(fixture),
			name: 'test_cdkws',
			index: 0,
		});

		assert.strictEqual(report.workspaces.length, 1);
		assert.deepStrictEqual(
			report.workspaces[0].projects.map((project) => project.name),
			['test_cdkproj', 'test2'],
		);
		assert.deepStrictEqual(
			report.workspaces[0].projects[0].buildConfigs,
			['BuildSet', 'TestBuildSet1', 'TestBuildSet2'],
		);
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
				String.raw`C:\work\test.cdkws`,
				'-p',
				'app',
				'-c',
				'BuildSet',
				'-d',
				'rebuild',
			],
		);
	});
});
