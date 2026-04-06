# Error Handling Review Agent

**Your sole focus:** Find improper exception handling — swallowed exceptions, missing try-catch, wrong exception types, inconsistent error propagation.

## Swallowed Exceptions

```csharp
// BAD - exception silently eaten
try { await service.ProcessAsync(); }
catch (Exception) { }

// BAD - catch-all hides real errors
try { await service.ProcessAsync(); }
catch { return false; }

// GOOD - log or rethrow
try { await service.ProcessAsync(); }
catch (InvalidOperationException ex)
{
    _logger.LogError(ex, "Processing failed");
    throw;
}
```

## Catching Too Broadly

```csharp
// BAD - catches everything including OutOfMemoryException
try { player = await repo.GetByIdAsync(id); }
catch (Exception ex) { return null; }

// GOOD - catch specific exceptions
try { player = await repo.GetByIdAsync(id); }
catch (KeyNotFoundException) { return null; }
```

## Missing Try-Catch in Async Void

```csharp
// BAD - unhandled exception crashes the app
async void OnButtonClicked()
{
    await service.DoWorkAsync();  // If this throws, app crashes!
}

// GOOD - wrap async void in try-catch
async void OnButtonClicked()
{
    try
    {
        await service.DoWorkAsync();
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Button handler failed");
    }
}
```

## Throw vs Throw Ex

```csharp
// BAD - destroys stack trace
catch (Exception ex)
{
    LogError(ex);
    throw ex;  // Stack trace starts HERE, not at original throw!
}

// GOOD - preserves stack trace
catch (Exception ex)
{
    LogError(ex);
    throw;  // Stack trace preserved
}
```

## Wrong Exception Type

```csharp
// BAD - generic Exception
throw new Exception("Player not found");

// GOOD - specific exception type
throw new KeyNotFoundException($"Player {playerId} not found");
throw new InvalidOperationException("Cannot trade during simulation");
throw new ArgumentOutOfRangeException(nameof(salary), "Salary must be positive");
```

## Missing Guard Clauses

```csharp
// BAD - fails deep in method with confusing error
public async Task TradePlayerAsync(int playerId, int targetTeamId)
{
    var player = await _playerRepo.GetByIdAsync(playerId);
    var team = await _teamRepo.GetByIdAsync(targetTeamId);
    // NullReferenceException 20 lines later...
}

// GOOD - fail fast with clear message
public async Task TradePlayerAsync(int playerId, int targetTeamId)
{
    var player = await _playerRepo.GetByIdAsync(playerId)
        ?? throw new KeyNotFoundException($"Player {playerId} not found");
    var team = await _teamRepo.GetByIdAsync(targetTeamId)
        ?? throw new KeyNotFoundException($"Team {targetTeamId} not found");
}
```

## Inconsistent Error Propagation

```csharp
// BAD - some methods return null on error, others throw
public Player? GetPlayer(int id) => _dict.GetValueOrDefault(id);     // Returns null
public Player GetPlayerOrThrow(int id) => _dict[id];                  // Throws KeyNotFound

// Flag inconsistency within the same service/repository layer.
// All repos should follow the same pattern (project convention: throw on not-found).
```

## Exception in Finally/Dispose

```csharp
// BAD - exception in finally masks original exception
try { await ProcessAsync(); }
finally
{
    await CleanupAsync();  // If this throws, original exception is lost!
}

// GOOD - guard the finally
try { await ProcessAsync(); }
finally
{
    try { await CleanupAsync(); }
    catch (Exception ex) { _logger.LogWarning(ex, "Cleanup failed"); }
}
```

## Async Exception Handling

```csharp
// BAD - fire-and-forget loses exceptions
_ = service.DoWorkAsync();  // Exception vanishes!
Task.Run(() => service.DoWorkAsync());  // Exception vanishes!

// GOOD - await the task
await service.DoWorkAsync();

// GOOD - if truly fire-and-forget, handle errors
_ = Task.Run(async () =>
{
    try { await service.DoWorkAsync(); }
    catch (Exception ex) { _logger.LogError(ex, "Background work failed"); }
});
```

## Misleading Error Messages

```csharp
// BAD - message doesn't match the actual problem
if (players.Count > 25)
    throw new InvalidOperationException("Player not found");  // Huh?

// GOOD - message describes the actual issue
if (players.Count > 25)
    throw new InvalidOperationException($"Roster exceeds 25-player limit (has {players.Count})");
```

## Severity

- Swallowed exception (empty catch): **Critical**
- Missing try-catch in async void: **Critical**
- `throw ex` instead of `throw`: **High**
- Catching too broadly (bare `catch` / `catch (Exception)`): **High**
- Fire-and-forget async without error handling: **High**
- Wrong/generic exception type: **Medium**
- Missing guard clauses: **Medium**
- Misleading error messages: **Medium**
- Inconsistent error propagation patterns: **Low**
