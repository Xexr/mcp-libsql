# Release Process

This document outlines the process for publishing new versions of `@xexr/mcp-libsql` to npm and creating GitHub releases.

## Prerequisites

1. **npm Account**: Ensure you have an npm account with publish access to the `@xexr` scope
2. **npm Token**: Create an npm token and add it as `NPM_TOKEN` secret in GitHub repository settings
3. **GitHub Token**: The `GITHUB_TOKEN` is automatically provided by GitHub Actions

## Release Types

Use semantic versioning (semver) for releases:

- **Patch** (`1.0.0` → `1.0.1`): Bug fixes, documentation updates
- **Minor** (`1.0.0` → `1.1.0`): New features, backward compatible changes
- **Major** (`1.0.0` → `2.0.0`): Breaking changes

## Manual Release Process

### 1. Prepare for Release

```bash
# Ensure you're on main branch with latest changes
git checkout main
git pull origin main

# Run full test suite
pnpm test:coverage

# Run type checking
pnpm typecheck

# Run linting
pnpm lint

# Build the project
pnpm build
```

### 2. Create Release

Choose the appropriate release type:

```bash
# For patch releases (bug fixes)
pnpm release:patch

# For minor releases (new features)
pnpm release:minor

# For major releases (breaking changes)
pnpm release:major
```

These scripts will:
- Update the version in `package.json`
- Create a git tag
- Push the tag to GitHub
- Trigger the automated CI/CD pipeline

### 3. Automated Process

Once you push a tag, GitHub Actions will:

1. **Run Tests**: Execute the full test suite with coverage
2. **Type Check**: Verify TypeScript types
3. **Lint**: Check code quality
4. **Build**: Compile TypeScript to JavaScript
5. **Publish to npm**: Automatically publish to npm registry
6. **Create GitHub Release**: Generate a GitHub release with release notes

## Manual Publishing (If Needed)

If you need to publish manually:

```bash
# Build the project
pnpm build

# Publish to npm
pnpm publish
```

## Troubleshooting

### Publishing Fails

1. **Check npm token**: Ensure `NPM_TOKEN` secret is correctly set in GitHub
2. **Verify access**: Confirm you have publish access to `@xexr` scope
3. **Check version**: Ensure the version doesn't already exist on npm

### GitHub Release Fails

1. **Check GitHub token**: Ensure repository has proper permissions
2. **Verify tag**: Confirm the tag was created and pushed correctly

### Build Fails

1. **Run tests locally**: `pnpm test`
2. **Check TypeScript**: `pnpm typecheck`
3. **Fix linting**: `pnpm lint:fix`

## Release Checklist

Before creating a release:

- [ ] All tests pass (`pnpm test`)
- [ ] TypeScript compiles without errors (`pnpm typecheck`)
- [ ] Code passes linting (`pnpm lint`)
- [ ] Documentation is updated
- [ ] CHANGELOG.md is updated (if exists)
- [ ] Version bump is appropriate for the changes
- [ ] All changes are committed and pushed to main

## Post-Release

After a successful release:

1. Verify the package is available on [npmjs.com](https://www.npmjs.com/package/@xexr/mcp-libsql)
2. Check the GitHub release page
3. Test installation: `npm install @xexr/mcp-libsql`
4. Update any dependent projects if needed