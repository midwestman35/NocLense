# Duplicate Code Review Agent

**Your sole focus:** Find duplicate or near-duplicate implementations — copy-pasted logic, redundant methods, repeated patterns that should be consolidated.

## Duplicate Methods Across Services

```csharp
// BAD - same logic in two services
// In TradeService.cs:
private int CalculatePlayerValue(Player p) =>
    p.Overall * 10 + p.Potential * 5 - p.Age;

// In FreeAgencyService.cs:
private int GetPlayerWorth(Player p) =>
    p.Overall * 10 + p.Potential * 5 - p.Age;

// GOOD - extract to shared service or helper
// In PlayerValuationService.cs:
public int CalculatePlayerValue(Player p) =>
    p.Overall * 10 + p.Potential * 5 - p.Age;
```

## Copy-Pasted LINQ Queries

```csharp
// BAD - same query repeated in multiple places
// In RosterService.cs:
var starters = team.Players
    .Where(p => p.Position != Position.Pitcher && !p.IsInjured)
    .OrderByDescending(p => p.Overall)
    .Take(9);

// In LineupService.cs:
var availableBatters = team.Players
    .Where(p => p.Position != Position.Pitcher && !p.IsInjured)
    .OrderByDescending(p => p.Overall)
    .Take(9);

// GOOD - extract to a shared method or extension
public static IEnumerable<Player> GetAvailableStarters(this Team team) =>
    team.Players
        .Where(p => p.Position != Position.Pitcher && !p.IsInjured)
        .OrderByDescending(p => p.Overall)
        .Take(9);
```

## Repeated Validation Logic

```csharp
// BAD - same validation in multiple methods
public async Task TradePlayerAsync(Player player, Team target)
{
    if (player.Contract == null)
        throw new InvalidOperationException("Player has no contract");
    if (target.Players.Count >= 40)
        throw new InvalidOperationException("Target roster full");
    // ...
}

public async Task WaivePlayerAsync(Player player, Team team)
{
    if (player.Contract == null)
        throw new InvalidOperationException("Player has no contract");
    // Same check again...
}

// GOOD - extract guard methods
private static void EnsureHasContract(Player player)
{
    if (player.Contract == null)
        throw new InvalidOperationException($"Player {player.PlayerId} has no contract");
}
```

## Duplicate DTO Mapping

```csharp
// BAD - same mapping logic in multiple places
// In SaveGameService.cs:
var dto = new PlayerDto
{
    Id = player.PlayerId,
    Name = player.FullName,
    Position = (int)player.Position,
    Overall = player.Overall
};

// In ExportService.cs:
var export = new PlayerDto
{
    Id = player.PlayerId,
    Name = player.FullName,
    Position = (int)player.Position,
    Overall = player.Overall
};

// GOOD - single mapping method or extension
public static PlayerDto ToDto(this Player player) => new()
{
    Id = player.PlayerId,
    Name = player.FullName,
    Position = (int)player.Position,
    Overall = player.Overall
};
```

## Repeated Calculation Formulas

```csharp
// BAD - same formula in multiple files
// In StatsService.cs:
var era = innings > 0 ? (earnedRuns * 9.0) / innings : 0;

// In StatsDisplayComponent.razor:
var era = innings > 0 ? (earnedRuns * 9.0) / innings : 0;

// In StatisticsHelper.cs:
var era = innings > 0 ? (earnedRuns * 9.0) / innings : 0;

// GOOD - single source of truth
public static double CalculateEra(int earnedRuns, double innings) =>
    innings > 0 ? (earnedRuns * 9.0) / innings : 0;
```

## Near-Duplicate Classes

```csharp
// BAD - two classes that do almost the same thing
public class PlayerSearchService
{
    public List<Player> Search(string name, Position? pos) { /* ... */ }
}

public class PlayerFilterService
{
    public List<Player> Filter(string name, Position? position) { /* ... */ }
}

// Flag when two classes/services have overlapping responsibilities
// with similar method signatures and logic
```

## Redundant Repository Wrappers

```csharp
// BAD - service method that just delegates to repo with no added value
public async Task<Player?> GetPlayerAsync(int id)
{
    return await _playerRepo.GetByIdAsync(id);
}

// Only flag if the method adds ZERO logic — no validation, no caching,
// no transformation. Simple pass-through wrappers add complexity without value.
```

## Duplicate Test Setup

```csharp
// BAD - same setup repeated across test classes
// In TradeServiceTests.cs:
private Player CreateTestPlayer() => new()
{
    PlayerId = 1, FullName = "Test Player", Position = Position.Shortstop,
    Overall = 75, Potential = 80, Age = 25
};

// In RosterServiceTests.cs:
private Player CreateTestPlayer() => new()
{
    PlayerId = 1, FullName = "Test Player", Position = Position.Shortstop,
    Overall = 75, Potential = 80, Age = 25
};

// GOOD - shared test fixture or builder
// In TestHelpers/PlayerBuilder.cs:
public static Player CreateDefault() => new() { /* ... */ };
```

## What NOT to Flag

- **Interface + implementation pairs** — Having IFooService and FooService is the project pattern, not duplication.
- **Similar but intentionally different logic** — e.g., batting stats vs pitching stats calculations that look similar but have domain-specific differences.
- **Test assertions that repeat production logic** — Tests SHOULD independently verify formulas, not share code with production.
- **Trivial one-liners** — A simple `return await _repo.GetAllAsync()` appearing in a few places is not worth extracting.

## Severity

- Same business logic in multiple services: **High**
- Duplicate calculation formulas across files: **High**
- Copy-pasted LINQ queries (3+ occurrences): **High**
- Duplicate DTO mapping: **Medium**
- Repeated validation that could be a guard method: **Medium**
- Duplicate test setup across test classes: **Medium**
- Redundant pass-through wrapper methods: **Low**
- Near-duplicate classes with overlapping responsibility: **Low**
