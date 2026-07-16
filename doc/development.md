# Development

## build and run

Install the locked dependencies:

```powershell
npm ci
```

Run the full compile, lint, and Extension Host test sequence:

```powershell
npm test
```

Run individual checks when iterating:

```powershell
npm run compile
npm run lint
```

Package the extension as a VSIX:

```powershell
npm run package
```

The generated file is named `csky-cdk-assistant-X.Y.Z.vsix`. Install it locally with:

```powershell
code --install-extension ./csky-cdk-assistant-X.Y.Z.vsix
```

If npm cannot write to the default user cache directory on Windows, use a workspace-local temporary cache:

```powershell
npm ci --cache ./.npm-cache
npm run package
```

## Known Issues

- VS Code Web, WSL, Remote SSH, flashing, and embedded-target debugging are not supported. The extension only wraps local Windows CDK build operations.
- Malformed Workspace or project XML is reported and skipped without hiding other valid projects.
- Projects without any BuildSet cannot be selected for a build.
- Only the first workspace folder is shown in the status bar; commands prompt for a folder in multi-root workspaces.
