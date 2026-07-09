import * as assert from 'assert';
import { parseEnvelope } from '../assistant';

suite('Assistant protocol', () => {
	test('parses a successful version 1 envelope', () => {
		const value = parseEnvelope<{ name: string }>(
			JSON.stringify({
				schemaVersion: 1,
				ok: true,
				data: { name: 'test' },
			}),
		);
		assert.deepStrictEqual(value, { name: 'test' });
	});

	test('rejects an incompatible protocol version', () => {
		assert.throws(
			() => parseEnvelope(
				JSON.stringify({ schemaVersion: 2, ok: true, data: {} }),
			),
			/不兼容/,
		);
	});

	test('surfaces structured assistant errors', () => {
		assert.throws(
			() => parseEnvelope(
				JSON.stringify({
					schemaVersion: 1,
					ok: false,
					error: { code: 'parse_error', message: 'bad XML' },
				}),
			),
			/bad XML/,
		);
	});
});
