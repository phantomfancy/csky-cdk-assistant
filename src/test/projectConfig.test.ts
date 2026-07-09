import * as assert from 'assert';
import { parseProjectConfig } from '../projectConfig';

suite('C-SKY CDK project configuration', () => {
	test('parses workspace configuration', () => {
		assert.deepStrictEqual(
			parseProjectConfig(JSON.stringify({
				schemaVersion: 1,
				workspace: 'test/test.cdkws',
				project: 'app',
				buildConfig: 'BuildSet',
			})),
			{
				schemaVersion: 1,
				workspace: 'test/test.cdkws',
				project: 'app',
				buildConfig: 'BuildSet',
			},
		);
	});

	test('rejects workspace and projectFile together', () => {
		assert.throws(
			() => parseProjectConfig(JSON.stringify({
				schemaVersion: 1,
				workspace: 'test.cdkws',
				projectFile: 'app.cdkproj',
				project: 'app',
				buildConfig: 'BuildSet',
			})),
			/必须且只能设置一个/,
		);
	});
});

