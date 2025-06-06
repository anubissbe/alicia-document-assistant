# Security Alerts Fix Guide

## Issue: 3336 Security Alerts on GitHub

### Root Cause Analysis

The high number of security alerts is likely due to:

1. **Historical VS Code Extension Dependencies**: The previously removed VS Code extension (`document-writer/`) had numerous dependencies that are still in git history
2. **Cached Security Scans**: GitHub's security scanning may be showing alerts from previous commits
3. **Transitive Dependencies**: Old package-lock.json files in history containing vulnerable sub-dependencies

### Immediate Actions

1. **Verify Current State** (Already Done)
   - Current `web-app/` has 0 vulnerabilities
   - Only 4 direct dependencies (ws, node-fetch, http-server, eslint)

2. **Update GitHub Security Settings**
   ```
   Go to: Settings → Security → Code security and analysis
   - Click "Dismiss alerts" for resolved issues
   - Re-run security scan
   ```

3. **Clean Git History** (Optional - Destructive!)
   If you want to completely remove old dependencies from history:
   ```bash
   # WARNING: This rewrites git history!
   git filter-branch --tree-filter 'rm -rf document-writer/node_modules document-writer/package-lock.json' HEAD
   ```

### Recommended Non-Destructive Approach

1. **Dismiss Alerts in GitHub UI**
   - Go to Security tab
   - Filter by "Closed" or "In removed code"
   - Bulk dismiss outdated alerts

2. **Create Security Advisory**
   ```markdown
   The 3336 security alerts were from a VS Code extension 
   that has been completely removed from the codebase. 
   Current web application has 0 vulnerabilities.
   ```

3. **Update Default Branch Protection**
   - Require security scan pass for PRs
   - Block PRs with new vulnerabilities

### Prevention

1. **Keep Dependencies Minimal**
   - Current approach with only 4 dependencies is good
   - Regular `npm audit` checks

2. **Use Dependabot**
   - Already configured in `.github/dependabot.yml`
   - Will auto-create PRs for updates

3. **Security Workflows**
   - CodeQL analysis (already added)
   - Dependency review (already added)
   - Regular audit workflow

### Current Security Status

✅ **Web App**: 0 vulnerabilities
✅ **Dependencies**: All up to date
✅ **Security Workflows**: Comprehensive coverage
✅ **Community Standards**: Security policy in place

The alerts should clear once GitHub re-scans after the VS Code extension removal.