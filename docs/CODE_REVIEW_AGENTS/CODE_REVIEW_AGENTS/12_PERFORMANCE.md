# Performance Review Agent

**Your sole focus:** Find code that will be slow at scale (30 teams × 40 players × 162 games).

## O(n²) Nested Loops

```csharp
// BAD - O(n²) on large collections
foreach (var player in allPlayers)           // 1200 players
{
    foreach (var other in allPlayers)         // × 1200 = 1.4M iterations!
    {
        if (player.TeamId == other.TeamId) ...
    }
}

// GOOD - use lookup
var playersByTeam = allPlayers.GroupBy(p => p.TeamId).ToDictionary(g => g.Key, g => g.ToList());
foreach (var player in allPlayers)
{
    var teammates = playersByTeam[player.TeamId];
}
```

## LINQ in Loops

```csharp
// BAD - LINQ query executed every iteration
foreach (var game in games)  // 2430 games
{
    var team = teams.First(t => t.TeamId == game.HomeTeamId);  // Scans every time!
}

// GOOD - build lookup once
var teamLookup = teams.ToDictionary(t => t.TeamId);
foreach (var game in games)
{
    var team = teamLookup[game.HomeTeamId];
}
```

## Repeated .ToList() / .ToArray()

```csharp
// BAD - materializes multiple times
var players = GetPlayers().ToList();
var count = GetPlayers().ToList().Count;      // Second ToList!
var first = GetPlayers().ToList().First();    // Third ToList!

// GOOD - materialize once
var players = GetPlayers().ToList();
var count = players.Count;
var first = players.First();
```

## String Concatenation in Loops

```csharp
// BAD - O(n²) string allocations
var result = "";
foreach (var player in players)
{
    result += player.Name + ", ";  // New string each time!
}

// GOOD - StringBuilder or Join
var result = string.Join(", ", players.Select(p => p.Name));
```

## Allocations in Hot Paths

```csharp
// BAD - allocates every call (called 1000s of times per game)
public double CalculateChance()
{
    var factors = new List<double>();  // Allocation!
    factors.Add(speed);
    factors.Add(power);
    return factors.Average();
}

// GOOD - no allocation
public double CalculateChance()
{
    return (speed + power) / 2.0;
}
```

## Unnecessary .Where().First()

```csharp
// BAD - iterates twice
var player = players.Where(p => p.PlayerId == id).First();

// GOOD - single pass
var player = players.First(p => p.PlayerId == id);

// BETTER - O(1) lookup
var player = playerDict[id];
```

## Count() vs Any()

```csharp
// BAD - counts entire collection
if (players.Count() > 0)
if (players.Count() == 0)

// GOOD - stops at first element
if (players.Any())
if (!players.Any())
```

## Repeated Property Access

```csharp
// BAD - computed property called repeatedly
foreach (var team in teams)
{
    // If Team.Roster is computed each time...
    var pitchers = team.Roster.Where(p => p.IsPitcher);
    var catchers = team.Roster.Where(p => p.Position == Position.Catcher);
    var total = team.Roster.Count;  // 3 computations!
}

// GOOD - cache computed property
foreach (var team in teams)
{
    var roster = team.Roster;  // Compute once
    var pitchers = roster.Where(p => p.IsPitcher);
    var catchers = roster.Where(p => p.Position == Position.Catcher);
    var total = roster.Count;
}
```

## Boxing in Hot Paths

```csharp
// BAD - boxes value types
object key = playerId;  // Boxing!
dictionary[key] = value;

// BAD - boxing in string formatting
string.Format("{0}", playerId);  // Boxing!

// GOOD - use generics, interpolation
Dictionary<int, T> dict;
$"{playerId}"  // No boxing with interpolation
```

## Severity

- O(n²) on player/game collections: **Critical**
- LINQ in loop without caching: **High**
- String concatenation in loop: **High**
- Repeated ToList() calls: **Medium**
- Count() instead of Any(): **Medium**
- Allocations in frequently-called methods: **Medium**
