# Generate Large Log File Script

This script generates large test log files for testing Phase 1 crash fixes.

## Usage

```bash
node scripts/generate-large-log.js [entries] [output-file]
```

### Parameters

- `entries` (optional): Number of log entries to generate (default: 50,000)
- `output-file` (optional): Output filename (default: `test-large-dataset.log`)

### Examples

```bash
# Generate default 50k entry file
node scripts/generate-large-log.js

# Generate 50k entries with custom filename
node scripts/generate-large-log.js 50000 test-large.log

# Generate 100k entries
node scripts/generate-large-log.js 100000 test-very-large.log

# Generate 1 million entries (will take longer)
node scripts/generate-large-log.js 1000000 test-huge.log
```

## Output Format

The script generates logs in the format expected by NocLense parser:

```
[INFO] [12/17/2024, 09:18:05] [com.example.service.UserService]: Processing user request (id: 1)
[ERROR] [01/15/2025, 14:32:11] [com.example.controller.AuthController]: Payment processed - callId: abc123-def456
[WARN] [06/22/2025, 03:45:22] [com.example.database.DatabaseConnection]: Session created - extensionID: Optional[1017]
```

## Log Entry Variety

Each log entry includes:
- **Random log levels**: INFO, DEBUG, ERROR, WARN
- **Various components**: 10 different service/component names
- **Random timestamps**: Spread over the last year
- **Variety of messages**: 15 different message types
- **Optional fields**: Sometimes includes IDs, Call-IDs, Extension IDs

## File Sizes

Approximate file sizes:
- 10,000 entries: ~1.1 MB
- 50,000 entries: ~5.6 MB
- 100,000 entries: ~11.2 MB
- 500,000 entries: ~56 MB
- 1,000,000 entries: ~112 MB

## Testing Use Cases

### Test 2: Spread Operator Fix
Use a 50k+ entry file to test the spread operator fix:
```bash
node scripts/generate-large-log.js 50000 test-large-dataset.log
```

1. Upload this file to NocLense (should parse successfully)
2. Upload another file while the 50k logs are still loaded
3. Verify no "Maximum call stack size exceeded" error occurs

### Test 4: Large File Handling
Use a 100MB+ file to test chunked reading:
```bash
node scripts/generate-large-log.js 1000000 test-huge.log
```

This will create a ~112MB file that should trigger chunked reading and progress indicators.

## Performance

- Generation speed: ~600,000 entries/second
- Uses streaming write for memory efficiency
- Progress updates every second during generation

## Notes

- The script uses ES modules (package.json has `"type": "module"`)
- Generated files are compatible with NocLense parser
- Timestamps are randomized but maintain chronological order
- Some entries include Call-IDs and Extension IDs for correlation testing
