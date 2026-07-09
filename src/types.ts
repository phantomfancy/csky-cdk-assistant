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

export interface Selection {
    workspace?: string;
    projectFile?: string;
    project: string;
    buildConfig: string;
}

export interface ProjectConfig {
    schemaVersion: 1;
    workspace?: string;
    projectFile?: string;
    project: string;
    buildConfig: string;
}

