# LINQ Gotchas Review Agent

**Your sole focus:** Find LINQ bugs caused by deferred execution, multiple enumeration, and closures.

## Multiple Enumeration

```csharp
// BAD - enumerates twice (or more)
IEnumerable<Player> players = GetPlayers();
var count = players.Count();      // First enumeration
var first = players.First();      // Second enumeration
foreach (var p in players) { }    // Third enumeration!

// GOOD - materialize once
var players = GetPlayers().ToList();
var count = players.Count;
var first = players[0];
foreach (var p in players) { }
```

## Deferred Execution Surprise

```csharp
// BAD - query not executed yet!
var query = players.Where(p => p.IsActive);
players.Clear();  // Underlying data gone!
var result = query.ToList();  // Empty or throws!

// GOOD - execute immediately if data may change
var result = players.Where(p => p.IsActive).ToList();
players.Clear();  // result is safe
```

## Closure Capture in Loops

```csharp
// BAD - all closures capture same variable
var actions = new List<Action>();
foreach (var player in players)
{
    actions.Add(() => Console.WriteLine(player.Name));  // Captures 'player' variable!
}
// All actions print the LAST player's name!

// GOOD - capture in local scope
foreach (var player in players)
{
    var p = player;  // Local copy
    actions.Add(() => Console.WriteLine(p.Name));
}
```

## Modified Closure

```csharp
// BAD - variable modified after capture
int threshold = 50;
var query = players.Where(p => p.Overall > threshold);
threshold = 80;  // Changed!
var result = query.ToList();  // Uses 80, not 50!

// GOOD - capture value immediately
int threshold = 50;
var result = players.Where(p => p.Overall > threshold).ToList();
// Or use let/local variable
```

## OrderBy Instability

```csharp
// BAD - unstable sort, order changes between runs
players.OrderBy(p => p.Age);

// GOOD - add secondary sort for stability
players.OrderBy(p => p.Age).ThenBy(p => p.PlayerId);
```

## GroupBy Then First Without Order

```csharp
// BAD - which player is "first" is undefined
var topByTeam = players
    .GroupBy(p => p.TeamId)
    .Select(g => g.First());  // Random player from each team!

// GOOD - define the order explicitly
var topByTeam = players
    .GroupBy(p => p.TeamId)
    .Select(g => g.OrderByDescending(p => p.Overall).First());
```

## Select Side Effects

```csharp
// BAD - side effects in Select (only runs if enumerated)
var updated = players.Select(p => {
    p.Age++;  // Side effect!
    return p;
});
// If never enumerated, ages never increment!

// GOOD - use foreach for side effects
foreach (var p in players)
{
    p.Age++;
}
```

## Mixing Query and Loop Variables

```csharp
// BAD - query references loop variable
foreach (var team in teams)
{
    var teamPlayers = players.Where(p => p.TeamId == team.TeamId);
    // If teamPlayers is used after loop, wrong team!
}

// GOOD - materialize inside loop
foreach (var team in teams)
{
    var teamPlayers = players.Where(p => p.TeamId == team.TeamId).ToList();
}
```

## Null Coalescing with LINQ

```csharp
// BAD - FirstOrDefault can return null, then method called
var name = players.FirstOrDefault(p => p.PlayerId == id).Name;  // NullRef!

// GOOD - null check or null-conditional
var name = players.FirstOrDefault(p => p.PlayerId == id)?.Name;
var player = players.FirstOrDefault(p => p.PlayerId == id);
if (player != null) { var name = player.Name; }
```

## Chained Where Conditions

```csharp
// NOT A BUG - but be aware
players.Where(p => p.IsActive).Where(p => p.Age > 30);
// Equivalent to:
players.Where(p => p.IsActive && p.Age > 30);
// Both are fine, but combined is slightly more efficient
```

## Severity

- Multiple enumeration of expensive source: **High**
- Closure captures wrong variable: **High**
- Deferred execution data disappears: **High**
- Modified closure after capture: **Medium**
- GroupBy.First without order: **Medium**
- Side effects in Select: **Medium**
- OrderBy without ThenBy (when stability matters): **Low**
