# Rollback Plan

This document outlines the steps to rollback changes if issues are encountered during the multi-file support implementation.

## Pre-Implementation Backup

### Files to Backup Before Changes
1. `src/App.tsx` - Main application component
2. `src/components/FileUploader.tsx` - File upload component
3. `src/utils/parser.ts` - Log parsing utility
4. `src/contexts/LogContext.tsx` - Log state management

### Backup Location
Backups will be stored in: `backup/YYYY-MM-DD_HH-MM-SS/`

## Rollback Procedures

### Quick Rollback (Git)
If using git, the quickest rollback method:
```bash
# View recent commits
git log --oneline -10

# Rollback to previous commit (if changes are committed)
git reset --hard HEAD~1

# Or rollback to specific commit
git reset --hard <commit-hash>
```

### Manual Rollback
If git is not available or changes aren't committed:

1. **Stop the development server** (if running)
2. **Restore files from backup:**
   ```bash
   cp backup/YYYY-MM-DD_HH-MM-SS/src/App.tsx src/App.tsx
   cp backup/YYYY-MM-DD_HH-MM-SS/src/components/FileUploader.tsx src/components/FileUploader.tsx
   cp backup/YYYY-MM-DD_HH-MM-SS/src/utils/parser.ts src/utils/parser.ts
   cp backup/YYYY-MM-DD_HH-MM-SS/src/contexts/LogContext.tsx src/contexts/LogContext.tsx
   ```
3. **Clear build cache** (if needed):
   ```bash
   rm -rf node_modules/.vite
   rm -rf dist
   ```
4. **Restart development server:**
   ```bash
   npm run dev
   ```

## Rollback Triggers

Rollback should be considered if:
- Application crashes on file upload
- Multiple files cause memory issues
- File parsing fails for previously working files
- UI becomes unresponsive
- Data loss occurs when merging files
- Performance degrades significantly

## Testing Before Rollback

Before rolling back, document the issue:
1. What feature was being used?
2. What error occurred?
3. Browser console errors (if any)
4. File size(s) being processed
5. Number of files being merged

## Post-Rollback Verification

After rolling back, verify:
- [ ] Single file upload works
- [ ] Existing logs display correctly
- [ ] Filtering works
- [ ] Timeline scrubber works
- [ ] No console errors
- [ ] UI is responsive

## Incremental Rollback

If only specific features are problematic, we can rollback incrementally:

### Phase 1: File Size Validation Only
- Keep: File size warnings
- Rollback: Multiple file support

### Phase 2: Multiple File Support Only
- Keep: Multiple file selection UI
- Rollback: File merging logic

## Emergency Contacts

If critical issues occur:
1. Document the issue in this file
2. Create a backup of current state
3. Execute rollback procedure
4. Test basic functionality
5. Report findings

