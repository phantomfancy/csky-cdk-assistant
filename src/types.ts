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
    issues: DiscoveryIssue[];
}

export interface DiscoveryIssue {
    path: string;
    message: string;
}

export interface Selection {
    workspace: string;
    project: string;
    buildConfig: string;
    cdkMakePath?: string;
}

export interface ProjectConfig {
    schemaVersion: 1;
    workspace: string;
    project: string;
    buildConfig: string;
    cdkMakePath?: string;
}

