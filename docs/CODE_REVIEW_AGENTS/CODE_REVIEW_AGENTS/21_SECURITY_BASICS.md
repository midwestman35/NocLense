# Security Basics Review Agent

**Your sole focus:** Find security issues in AI-generated code — hardcoded secrets, exposed internals in error messages, insecure defaults, and information leakage.

## Hardcoded Secrets

```csharp
// BAD - API keys, passwords, tokens in source code
private const string ApiKey = "sk-abc123def456";
private const string ConnectionString = "Server=prod;Password=hunter2";
private const string Secret = "my-jwt-secret-key";
var client = new HttpClient();
client.DefaultRequestHeaders.Add("Authorization", "Bearer eyJhbGciOi...");

// GOOD - load from configuration or environment
var apiKey = configuration["ApiKey"];
var connectionString = configuration.GetConnectionString("Default");

// Also flag: passwords in comments, URLs with credentials
// e.g., "mongodb://admin:password123@host:27017"
```

## Verbose Error Messages Exposing Internals

```csharp
// BAD - stack trace or internal details shown to user
catch (Exception ex)
{
    ErrorMessage = ex.ToString();  // Full stack trace visible in UI!
}

// BAD - database/file path details in user-facing messages
catch (Exception ex)
{
    ErrorMessage = $"Failed to load: {ex.Message}";
    // ex.Message might contain: "Could not find file 'C:\Users\Brian\AppData\...'"
}

// GOOD - generic user message, detailed internal log
catch (Exception ex)
{
    _logger.LogError(ex, "Failed to load game save");
    ErrorMessage = "Unable to load saved game. Please try again.";
}
```

## Sensitive Data in Logs or Debug Output

```csharp
// BAD - logging sensitive information
_logger.LogInformation("User logged in: {Email} with password {Password}", email, password);
Console.WriteLine($"Processing save file at: {fullPath}");
Debug.WriteLine($"Player data: {JsonSerializer.Serialize(player)}");

// GOOD - sanitize or omit sensitive fields
_logger.LogInformation("User logged in: {Email}", email);
_logger.LogDebug("Processing save file for slot {SlotId}", slotId);
```

## Insecure Deserialization

```csharp
// BAD - deserializing untrusted data without validation
var saveData = JsonSerializer.Deserialize<SaveGameDto>(userProvidedJson);
// What if the JSON is crafted to have extreme values?

// BAD - no type checking after deserialization
var settings = JsonSerializer.Deserialize<GameSettings>(fileContent)!;
// Assumes deserialization always succeeds and matches expected shape

// GOOD - validate after deserialization
var saveData = JsonSerializer.Deserialize<SaveGameDto>(fileContent);
if (saveData is null)
    throw new InvalidOperationException("Corrupt save file");
ValidateSaveData(saveData);  // Check ranges, required fields, etc.
```

## Path Traversal

```csharp
// BAD - user input used directly in file path
var filePath = Path.Combine(savesFolder, userProvidedFileName);
var content = File.ReadAllText(filePath);
// userProvidedFileName could be "../../secrets.json"

// GOOD - validate the resolved path stays within expected directory
var filePath = Path.GetFullPath(Path.Combine(savesFolder, fileName));
if (!filePath.StartsWith(savesFolder, StringComparison.OrdinalIgnoreCase))
    throw new InvalidOperationException("Invalid file path");
```

## Insecure Defaults

```csharp
// BAD - permissive defaults that should be restrictive
var options = new JsonSerializerOptions
{
    IncludeFields = true,                    // Exposes private state?
    ReferenceHandler = ReferenceHandler.All, // Could cause issues
};

// BAD - disabling security features for convenience
#pragma warning disable CA2007  // Don't suppress security warnings
```

## Information Leakage in UI

```csharp
// BAD - showing internal IDs, file paths, or system info in UI
<p>Player ID: @player.PlayerId (internal: @player.GetHashCode())</p>
<p>Save location: @Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData)</p>
<p>Version: @Assembly.GetExecutingAssembly().FullName</p>

// BAD - debug info left in production UI
<div class="debug">@JsonSerializer.Serialize(gameState)</div>
@* TODO: remove before release *@
```

## Leftover Debug/Test Code

```csharp
// BAD - debug backdoors left in production code
if (playerName == "TESTADMIN") { UnlockAllTeams(); }
if (Environment.GetEnvironmentVariable("SKIP_VALIDATION") == "1") return;

// BAD - hardcoded test data in production paths
var testPlayers = new List<Player>
{
    new() { FullName = "Test Player 1", Overall = 99 }
};

// BAD - Console.WriteLine left behind
Console.WriteLine($"DEBUG: trade value = {value}");
```

## What NOT to Flag

- **Fictional game data** — player names, team names, and city names are intentionally invented. Not secrets.
- **Game constants** — salary caps, roster limits, and age thresholds are gameplay values, not sensitive data.
- **In-memory repository patterns** — the project intentionally uses no database; no SQL injection risk exists.
- **Internal error messages in service-layer exceptions** — these are caught by error handling, not shown to users. Only flag if the message propagates to UI.
- **File I/O for save games** — the project uses JSON persistence by design. Only flag if paths are user-controllable or unvalidated.

## Severity

- Hardcoded secrets (API keys, passwords, tokens): **Critical**
- Path traversal vulnerability: **Critical**
- Stack traces or internal details shown in UI: **High**
- Sensitive data in logs: **High**
- Insecure deserialization without validation: **High**
- Debug/test backdoors in production code: **High**
- Console.WriteLine debug output left behind: **Medium**
- Information leakage in UI components: **Medium**
- Insecure serialization defaults: **Low**
