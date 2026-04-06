# Null Safety & Error Handling Review Agent

**Your sole focus:** Find null safety issues and improper error handling.

## Nullable .Value Access

```csharp
// BAD - flag these
var teamId = player.TeamId!.Value;
var id = nullable!.Value;

// GOOD - null check first
if (player.TeamId.HasValue)
    var teamId = player.TeamId.Value;

// GOOD - or use null-conditional
var teamId = player.TeamId ?? defaultValue;
```

## Required Dependencies

```csharp
// BAD - no validation
public MyService(IRepo repo) { _repo = repo; }

// GOOD - fail fast
public MyService(IRepo repo)
{
    ArgumentNullException.ThrowIfNull(repo);
    _repo = repo;
}
```

## Repository UpdateAsync

```csharp
// BAD - silent insert
public async Task UpdateAsync(Entity e) { _dict[e.Id] = e; }

// GOOD - throw if not found
public async Task UpdateAsync(Entity e)
{
    if (!_dict.ContainsKey(e.Id))
        throw new KeyNotFoundException($"Entity {e.Id} not found");
    _dict[e.Id] = e;
}
```

## Return Empty, Not Null

```csharp
// BAD
return players.Any() ? players : null;

// GOOD
return players ?? new List<Player>();
return Array.Empty<Player>();
```

## No DateTime.Now Fallbacks

```csharp
// BAD - masks bugs
var date = gameState?.CurrentDate ?? DateTime.Now;

// GOOD - fail explicitly
if (gameState is null) throw new InvalidOperationException("GameState required");
var date = gameState.CurrentDate;
```

## Enum Validation in DTOs

```csharp
// BAD - accepts invalid values
Position = (Position)dto.Position;

// GOOD - validate
if (!Enum.IsDefined(typeof(Position), dto.Position))
    throw new InvalidOperationException($"Invalid position: {dto.Position}");
Position = (Position)dto.Position;
```

## Severity

- Missing null check before .Value: **Critical**
- DateTime.Now fallback: **High**
- Missing ArgumentNullException: **Medium**
- Return null instead of empty: **Low**
