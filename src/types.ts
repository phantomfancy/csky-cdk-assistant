export type BuildAction = 'build' | 'clean' | 'rebuild';

export interface ProjectInfo {
	name: string;
	path: string;
	language?: string;
	projectType?: string;
	buildConfigs: string[];
	defaultBuildConfig?: string;
}

export interface WorkspaceInfo {
	name: string;
	path: string;
	activeProject?: string;
	projects: ProjectInfo[];
}

export interface DiscoveryReport {
	root: string;
	workspaces: WorkspaceInfo[];
	standaloneProjects: ProjectInfo[];
}

export interface Envelope<T> {
	schemaVersion: number;
	ok: boolean;
	data?: T;
	error?: { code: string; message: string };
}

export interface Selection {
	folderUri: string;
	workspace?: string;
	projectFile?: string;
	project: string;
	buildConfig: string;
}

