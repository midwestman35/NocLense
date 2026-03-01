# Over-Engineering Review Agent

**Your sole focus:** Find unnecessary complexity — premature abstractions, wrapper classes that add no value, overly generic solutions for simple problems, and unnecessary indirection.

## Premature Abstraction

```csharp
// BAD - interface + class for something used exactly once
public interface IPlayerNameFormatter
{
    string Format(Player player);
}

public class PlayerNameFormatter : IPlayerNameFormatter
{
    public string Format(Player player) => $"{player.FirstName} {player.LastName}";
}

// GOOD - just inline it or use a simple method
var displayName = $"{player.FirstName} {player.LastName}";
```

## Unnecessary Wrapper Classes

```csharp
// BAD - class wraps a single value with no added behavior
public class TeamId
{
    public int Value { get; }
    public TeamId(int value) => Value = value;
}

// Now every call site does team.Id.Value instead of team.Id
// Only worth it if it adds validation, comparison, or domain logic.

// BAD - service wraps another service 1:1
public class PlayerServiceWrapper : IPlayerServiceWrapper
{
    private readonly IPlayerService _inner;

    public async Task<Player> GetAsync(int id) => await _inner.GetAsync(id);
    public async Task SaveAsync(Player p) => await _inner.SaveAsync(p);
    // Every method just delegates — this class adds nothing.
}
```

## Overly Generic Solutions

```csharp
// BAD - generic method for one concrete use
public T ProcessEntity<T>(T entity, Func<T, T> transform, Action<T> validate)
    where T : class, IEntity
{
    validate(entity);
    return transform(entity);
}

// Called exactly once:
ProcessEntity(player, p => { p.Age++; return p; }, p => { });

// GOOD - just write the specific code
player.Age++;
```

## Unnecessary Design Patterns

```csharp
// BAD - Strategy pattern for two fixed options
public interface IScoringStrategy { int Calculate(Game game); }
public class HomeScoringStrategy : IScoringStrategy { /* ... */ }
public class AwayScoringStrategy : IScoringStrategy { /* ... */ }
public class ScoringStrategyFactory
{
    public IScoringStrategy Create(bool isHome) =>
        isHome ? new HomeScoringStrategy() : new AwayScoringStrategy();
}

// GOOD - just use a parameter or simple if/else
public int CalculateScore(Game game, bool isHome) =>
    isHome ? game.HomeScore : game.AwayScore;

// BAD - Builder pattern for a class with 3 properties
public class PlayerSearchCriteriaBuilder
{
    private string? _name;
    private Position? _position;
    private int? _minOverall;

    public PlayerSearchCriteriaBuilder WithName(string n) { _name = n; return this; }
    public PlayerSearchCriteriaBuilder WithPosition(Position p) { _position = p; return this; }
    public PlayerSearchCriteriaBuilder WithMinOverall(int o) { _minOverall = o; return this; }
    public PlayerSearchCriteria Build() => new(_name, _position, _minOverall);
}

// GOOD - just use the constructor or object initializer
var criteria = new PlayerSearchCriteria("Smith", Position.Pitcher, 70);
```

## Unnecessary Indirection Layers

```csharp
// BAD - method calls method calls method, each adding nothing
public async Task<Player> GetPlayerAsync(int id)
{
    return await FetchPlayerAsync(id);
}

private async Task<Player> FetchPlayerAsync(int id)
{
    return await RetrievePlayerAsync(id);
}

private async Task<Player> RetrievePlayerAsync(int id)
{
    return await _repo.GetByIdAsync(id);  // Finally, the actual work!
}

// GOOD - one method, direct call
public async Task<Player> GetPlayerAsync(int id) =>
    await _repo.GetByIdAsync(id);
```

## Configuration for Things That Never Change

```csharp
// BAD - configurable constant that will never be changed
public class GameSettings
{
    public int InningsPerGame { get; set; } = 9;
    public int OutsPerInning { get; set; } = 3;
    public int StrikesPerOut { get; set; } = 3;
    public int BallsPerWalk { get; set; } = 4;
}

// These are rules of baseball. They don't need configuration.
// GOOD - use constants
public const int InningsPerGame = 9;
```

## Unnecessary Async

```csharp
// BAD - async method that does no async work
public async Task<int> GetRosterSizeAsync(Team team)
{
    return team.Players.Count;  // No awaits — why is this async?
}

// GOOD - synchronous when no I/O involved
public int GetRosterSize(Team team) => team.Players.Count;

// Exception: if the method implements an async interface, the async
// signature is required even without awaits. Don't flag those.
```

## What NOT to Flag

- **Interfaces for DI-registered services** — this is the project pattern and enables testing with NSubstitute.
- **Repository pattern** — even simple repos benefit from the abstraction in this project.
- **Constants classes** — extracting magic numbers into named constants is required by Agent 01, not over-engineering.
- **Async methods that call async repos** — the async is required for the I/O path even if the in-memory repo is synchronous.
- **Clone() on presets** — the project requires defensive copies for mutable state.

## Severity

- Wrapper class that delegates 1:1 with no added logic: **High**
- Generic method/class used for exactly one type: **High**
- Design pattern where simple code would suffice: **Medium**
- Unnecessary indirection layers (3+ hops): **Medium**
- Async method with no awaits (concrete, not interface): **Medium**
- Configuration for values that never change: **Low**
- Interface for a class with only one implementation and no testing need: **Low**
