# Dead Code Review Agent

**Your sole focus:** Find unused code — dead imports, unreachable branches, orphaned methods, commented-out blocks, and unused variables.

## Unused Imports / Using Statements

```csharp
// BAD - using statement not referenced anywhere in the file
using System.Text.RegularExpressions;  // Nothing uses Regex!
using Microsoft.Extensions.Logging;     // No ILogger in this class!

// Remove unused usings. IDE can detect these, but AI often leaves them behind.
```

## Unused Private Methods

```csharp
// BAD - private method never called
public class TradeService
{
    public async Task ExecuteTradeAsync(Trade trade) { /* ... */ }

    private int CalculateTradeWeight(Player p)  // Never called anywhere!
    {
        return p.Overall * 10 + p.Potential * 5;
    }
}

// Search the entire file for references before flagging.
// If zero call sites exist, it's dead code.
```

## Unused Private Fields and Variables

```csharp
// BAD - field assigned but never read
private readonly ILogger _logger;  // Injected but never used!

// BAD - variable assigned but never referenced
var totalSalary = team.Players.Sum(p => p.Salary);
// totalSalary never used below this line

// BAD - loop variable unused
foreach (var player in players)
{
    count++;  // player is never referenced!
}
```

## Commented-Out Code

```csharp
// BAD - commented-out code left behind
public async Task SimulateGameAsync(Game game)
{
    // var oldResult = _legacySimulator.Run(game);
    // if (oldResult.HomeScore > 10) { ApplyMercyRule(); }
    var result = _simulator.SimulateAsync(game);
    // TODO: remove above comments
}

// Comments explaining WHY are fine. Commented-out CODE is dead code.
// If it's not running, delete it. Git has the history.
```

## Unreachable Code

```csharp
// BAD - code after unconditional return
public int GetScore(Player p)
{
    if (p == null) throw new ArgumentNullException(nameof(p));
    return p.Overall;
    var bonus = p.Potential;  // Unreachable!
    return p.Overall + bonus; // Unreachable!
}

// BAD - condition that can never be true
if (player.Age < 0)  // Age is validated as >= 16 at creation
{
    HandleNegativeAge();  // Dead branch
}

// BAD - redundant else after return
if (condition) return x;
else return y;  // else is unnecessary (but not dead — just style)
```

## Orphaned Test Helpers

```csharp
// BAD - test helper method no longer used by any test
private Player CreatePitcherWithEra(double era)  // No test calls this!
{
    var player = CreateTestPlayer();
    player.Position = Position.Pitcher;
    return player;
}

// Check: Is every private/helper method in test files actually called?
```

## Unused Parameters

```csharp
// BAD - parameter accepted but never used
public async Task ProcessSeasonAsync(int seasonYear, bool includePlayoffs)
{
    var games = await _gameRepo.GetBySeasonAsync(seasonYear);
    // includePlayoffs is never referenced!
    foreach (var game in games) { /* ... */ }
}

// If the parameter is from an interface, it may be intentionally unused.
// Flag only if the method is concrete and the parameter serves no purpose.
```

## Dead Enum Values

```csharp
// BAD - enum value defined but never used in any switch/if/assignment
public enum TrainingIntensity
{
    Light,
    Normal,
    Intense,
    Extreme,
    Legendary  // Never referenced anywhere in the codebase!
}
```

## Obsolete Event Handlers

```csharp
// BAD - event handler method exists but event was removed or unwired
private void OnPlayerTraded(object sender, TradeEventArgs e)
{
    // This handler exists but nothing subscribes to it anymore
    RefreshRoster();
}
```

## What NOT to Flag

- **Interface method implementations** — even if the body is empty, the interface contract requires them.
- **Public API methods** — they may be called by Blazor components via reflection/binding or by future code.
- **Conditional compilation blocks** (`#if DEBUG`) — these are intentionally toggled.
- **Virtual/override methods** — base class may require them even if the override seems empty.
- **Event handlers wired in .razor files** — check the markup before flagging, as `@onclick` bindings aren't visible in the .cs file alone.

## Severity

- Commented-out code blocks (3+ lines): **High**
- Unused private methods: **High**
- Unused private fields/variables: **High**
- Unused using statements: **Medium**
- Unreachable code after return/throw: **Medium**
- Unused method parameters (concrete methods): **Medium**
- Dead enum values: **Low**
- Orphaned test helpers: **Low**
