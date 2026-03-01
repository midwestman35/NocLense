# Repository Patterns Review Agent

**Your sole focus:** Find repository implementation issues and data access patterns.

## IReadOnlyList Returns

```csharp
// BAD - exposes mutable list
public async Task<List<Player>> GetAllAsync()

// BAD - lazy evaluation issues
public async Task<IEnumerable<Player>> GetAllAsync()

// GOOD - immutable snapshot
public async Task<IReadOnlyList<Player>> GetAllAsync()
{
    lock (_lock)
    {
        return _players.Values.ToList();
    }
}
```

## Materialize Before Clear

In LoadAsync, materialize the input BEFORE clearing:

```csharp
// BAD - clearing destroys source if same reference
public async Task LoadAsync(IEnumerable<Player> players)
{
    await ClearAsync();  // Might destroy 'players'!
    foreach (var p in players) { ... }
}

// GOOD - materialize first
public async Task LoadAsync(IEnumerable<Player> players)
{
    var playerList = players.ToList();  // Materialize!
    await ClearAsync();
    foreach (var p in playerList) { ... }
}
```

## UpdateAsync Throws on Missing

```csharp
// BAD - silently inserts
public async Task UpdateAsync(Player player)
{
    _players[player.PlayerId] = player;
}

// GOOD - throws if not found
public async Task UpdateAsync(Player player)
{
    lock (_lock)
    {
        if (!_players.ContainsKey(player.PlayerId))
            throw new KeyNotFoundException($"Player {player.PlayerId} not found");
        _players[player.PlayerId] = player;
    }
}
```

## Lock Required

Every in-memory repository needs a lock:

```csharp
// REQUIRED
private readonly Lock _lock = new();

// All public methods use it
public async Task<Player?> GetByIdAsync(int id)
{
    lock (_lock)
    {
        return _players.GetValueOrDefault(id);
    }
}
```

## NextId Pattern

```csharp
// REQUIRED for repositories with auto-increment IDs
private int _nextId = 1;

public async Task<Player> AddAsync(Player player)
{
    lock (_lock)
    {
        player.PlayerId = _nextId++;
        _players[player.PlayerId] = player;
        return player;
    }
}
```

## ClearAsync Resets State

```csharp
// GOOD - resets everything
public async Task ClearAsync()
{
    lock (_lock)
    {
        _players.Clear();
        _nextId = 1;  // Reset ID counter too!
    }
}
```

## No Business Logic in Repositories

```csharp
// BAD - filtering logic in repo
public async Task<IReadOnlyList<Player>> GetEligibleFreeAgentsAsync()
{
    return _players.Values
        .Where(p => !p.IsRetired && p.Contract?.IsExpired == true && p.Age < 40)
        .ToList();
}

// GOOD - simple data access, logic in service
public async Task<IReadOnlyList<Player>> GetAllAsync()
{
    return _players.Values.ToList();
}
// Service does the filtering
```

## Severity

- Missing lock: **Critical**
- UpdateAsync doesn't throw: **High**
- Returning List instead of IReadOnlyList: **Medium**
- Not materializing before clear: **Medium**
- Business logic in repository: **Low**
