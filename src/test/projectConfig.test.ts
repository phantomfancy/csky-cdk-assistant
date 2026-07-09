import * as assert from 'assert';
import { parseProjectConfig, selectionsEqual } from '../projectConfig';

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
                },
                {
                    workspace: 'C:/work/test.cdkws',
                    project: 'app2',
                    buildConfig: 'BuildSet',
                },
            ),
            false,
        );
    });
});

