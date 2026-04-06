# Edge Cases Review Agent

**Your sole focus:** Find code that breaks with unusual but valid inputs.

## Empty Collections

```csharp
// BAD - crashes on empty
var best = players.First();           // Throws if empty!
var avg = stats.Average(s => s.Hits); // Throws if empty!
var top = players.Max(p => p.Overall); // Throws if empty!

// GOOD - handle empty
var best = players.FirstOrDefault();
var avg = stats.Any() ? stats.Average(s => s.Hits) : 0;
var top = players.Any() ? players.Max(p => p.Overall) : 0;
```

## Single Element Collections

```csharp
// BAD - assumes multiple elements
var second = players.Skip(1).First();  // Fails with 1 player!
var range = players.Max() - players.Min();  // OK but verify intent

// Check: What if collection has exactly 1 item?
```

## Zero and Negative Values

```csharp
// BAD - division by zero
var average = totalHits / gamesPlayed;  // gamesPlayed could be 0!
var ratio = wins / (wins + losses);      // Both could be 0!

// GOOD - guard against zero
var average = gamesPlayed > 0 ? totalHits / gamesPlayed : 0;

// BAD - negative not considered
var index = playerId - 1;  // What if playerId is 0 or negative?
array[count - 1];          // What if count is 0?
```

## Null in Collections

```csharp
// BAD - assumes no nulls in collection
foreach (var player in players)
{
    roster.Add(player.Name);  // player could be null!
}

// BAD - null element in LINQ
players.Where(p => p.TeamId == teamId)  // If p is null, crashes
players.OrderBy(p => p.Name)             // If p is null, crashes

// GOOD - filter nulls first
players.Where(p => p != null && p.TeamId == teamId)
```

## Boundary Dates

```csharp
// Check: What happens at boundaries?
- Season start (March 27)
- Season end (September 30)
- Year boundary (Dec 31 → Jan 1)
- Leap year (Feb 29)

// BAD - doesn't handle year rollover
var nextMonth = new DateTime(date.Year, date.Month + 1, 1);  // Fails in December!

// GOOD
var nextMonth = date.AddMonths(1);
```

## String Edge Cases

```csharp
// BAD - assumes non-empty string
var first = name[0];           // Crashes if empty!
var abbrev = name.Substring(0, 3);  // Crashes if < 3 chars!

// GOOD - check length
var abbrev = name.Length >= 3 ? name[..3] : name;
var first = string.IsNullOrEmpty(name) ? '?' : name[0];
```

## Index Boundaries

```csharp
// BAD - hardcoded index assumptions
var pitcher = rotation[4];     // What if < 5 pitchers?
var cleanup = lineup[3];       // What if < 4 batters?

// GOOD - bounds check
var pitcher = rotation.Count > 4 ? rotation[4] : null;
```

## Extreme Values

```csharp
// Check behavior with:
- int.MaxValue / int.MinValue
- Very large salaries (overflow?)
- 0 years experience (rookie)
- 50+ years old (ancient player)
- 162-0 record (perfect season)
- 0-162 record (worst season)

// BAD - overflow possible
var totalSalary = players.Sum(p => p.Salary);  // Could overflow int!

// GOOD - use larger type
var totalSalary = players.Sum(p => (long)p.Salary);
```

## New/Default Entity State

```csharp
// Check: What if entity was just created?
var player = new Player();
// player.TeamId is null
// player.Contract is null
// player.Stats may be empty

// BAD - assumes initialized
player.Contract.Salary  // NullReferenceException!
player.Stats.Last()     // InvalidOperationException!
```

## Concurrent Modification

```csharp
// BAD - modifying while iterating
foreach (var player in roster)
{
    if (player.IsRetired)
        roster.Remove(player);  // InvalidOperationException!
}

// GOOD - ToList() creates copy
foreach (var player in roster.ToList())
{
    if (player.IsRetired)
        roster.Remove(player);
}
```

## Optional/Missing Data

```csharp
// Check: What if optional data is missing?
- Player has no contract (free agent)
- Player has no stats (just drafted)
- Team has no games played yet
- Season archives don't exist for old seasons

// Each of these needs explicit handling
```

## Severity

- Empty collection .First()/.Max(): **Critical**
- Division by zero possible: **Critical**
- Null in collection not handled: **High**
- Index out of bounds possible: **High**
- Concurrent modification: **High**
- String boundary not checked: **Medium**
- Extreme value not considered: **Medium**
- New entity state not handled: **Medium**
