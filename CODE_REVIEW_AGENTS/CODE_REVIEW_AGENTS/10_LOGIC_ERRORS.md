# Logic Errors Review Agent

**Your sole focus:** Find code that compiles but does the wrong thing.

## Inverted Conditions

```csharp
// BAD - logic inverted
if (player.IsRetired)
    activeRoster.Add(player);  // Adding retired player!

if (!player.TeamId.HasValue)
    teamPlayers.Add(player);   // Adding player without team!

// Check: Does the condition match the action?
```

## Wrong Operators

```csharp
// BAD - assignment instead of comparison
if (player.Age = 30)  // Always true, sets age to 30!

// BAD - wrong comparison operator
if (salary < maxSalary)  // Should be <= ?
if (index > 0)           // Should be >= 0 ?

// BAD - && vs || confusion
if (player.IsRetired && player.IsInjured)  // Both required?
if (player.IsRetired || player.IsInjured)  // Either one?
```

## Off-By-One Errors

```csharp
// BAD - wrong loop bounds
for (int i = 0; i <= players.Count; i++)  // IndexOutOfRange!
for (int i = 1; i < players.Count; i++)   // Skips first element!

// BAD - wrong slice
players.Take(10)   // Is this 0-9 or 1-10? Verify intent.
players.Skip(1)    // Intentionally skipping first?
```

## Unreachable Code

```csharp
// BAD - code after return
return result;
_logger.Log("Done");  // Never executes!

// BAD - impossible condition
if (value < 0 && value > 100)  // Always false!

// BAD - redundant condition
if (player != null)
{
    if (player != null)  // Already checked!
```

## Missing Return Paths

```csharp
// BAD - not all paths return
public Player? GetPlayer(int id)
{
    if (id > 0)
        return _players[id];
    // What if id <= 0? Missing return!
}

// BAD - missing else
if (condition)
    result = valueA;
// result is uninitialized if condition is false!
```

## Wrong Variable Used

```csharp
// BAD - copy-paste error
playerA.Salary = playerA.Salary;  // Should be playerB?
team1.Wins = team1.Wins;          // No change!

// BAD - loop variable shadowing
foreach (var player in players)
{
    var player = GetOtherPlayer();  // Shadows loop variable!
}
```

## Swapped Arguments

```csharp
// BAD - arguments in wrong order
Trade(toTeam, fromTeam, player);     // Reversed teams?
Calculate(height, width);             // Swapped dimensions?
CreateRange(endDate, startDate);      // Reversed dates?
```

## Accidental Early Exit

```csharp
// BAD - return inside loop
foreach (var player in players)
{
    if (player.IsEligible)
        return player;  // Only checks first eligible!
    // Should this collect ALL eligible?
}

// BAD - break instead of continue
foreach (var p in players)
{
    if (p.IsRetired)
        break;      // Stops entire loop!
    // Should be continue?
}
```

## Exception Swallowing

```csharp
// BAD - silent failure
try { await SaveAsync(); }
catch { }  // Error disappears!

// BAD - generic catch hides bugs
catch (Exception) { return null; }  // What went wrong?
```

## Async/Await Issues

```csharp
// BAD - missing await
async Task ProcessAsync()
{
    SaveAsync();  // Fire and forget! Missing await.
}

// BAD - async void (except event handlers)
public async void DoWork()  // Can't be awaited, exceptions lost
```

## Severity

- Inverted condition: **Critical**
- Wrong operator in business logic: **Critical**
- Missing return path: **High**
- Off-by-one in loop: **High**
- Swapped arguments: **High**
- Exception swallowing: **Medium**
- Unreachable code: **Low**
