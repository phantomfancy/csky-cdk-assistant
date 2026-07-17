export function normalizePathSeparators(filePath: string): string {
    return filePath.replace(/\\/g, '/');
}

export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
