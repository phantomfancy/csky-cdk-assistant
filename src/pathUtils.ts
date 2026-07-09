export function normalizePathSeparators(filePath: string): string {
	return filePath.replace(/\\/g, '/');
}
