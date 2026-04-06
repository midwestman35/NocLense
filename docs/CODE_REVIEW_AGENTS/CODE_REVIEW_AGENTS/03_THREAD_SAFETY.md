# Thread Safety Review Agent

**Your sole focus:** Find thread safety issues, improper randomness, and DateTime.Now usage.

## IRandomProvider Required

```csharp
// BAD - flag ALL of these
Random.Shared.Next()
new Random().NextDouble()
var rng = new Random();

// GOOD - inject IRandomProvider
public MyService(IRandomProvider random) { _random = random; }
// Then use: _random.NextDouble()
```

## DateTime.Now Forbidden in Services

```csharp
// BAD - game has its own calendar
var today = DateTime.Now;
var expiry = DateTime.Now.AddDays(7);

// GOOD - pass date as parameter
public void Process(DateTime currentDate) { ... }
// Caller provides: gameState.CurrentDate
```

## Repository Locking

All repositories MUST have a lock:
```csharp
// REQUIRED pattern
public class InMemoryPlayerRepository : IPlayerRepository
{
    private readonly Lock _lock = new();
    private readonly Dictionary<int, Player> _players = new();

    public async Task<Player?> GetByIdAsync(int id)
    {
        lock (_lock) { return _players.GetValueOrDefault(id); }
    }
}
```

Flag any repository missing `private readonly Lock _lock = new();`

## No Parallel.ForEach for State Mutations

```csharp
// BAD - race conditions
Parallel.ForEach(players, p => { p.Age++; repo.UpdateAsync(p); });

// GOOD - sequential
foreach (var p in players) { p.Age++; await repo.UpdateAsync(p); }
```

## Service State Needs Locking

If a service has mutable internal state (dictionaries, caches), it needs locking:
```csharp
// BAD - no lock on mutable state
private readonly Dictionary<int, State> _states = new();
public void Add(int id, State s) { _states[id] = s; }

// GOOD - locked access
private readonly Lock _stateLock = new();
public void Add(int id, State s)
{
    lock (_stateLock) { _states[id] = s; }
}
```

## Severity

- Random.Shared or new Random(): **Critical**
- DateTime.Now in service: **Critical**
- Missing repository lock: **High**
- Parallel.ForEach with state: **High**
- Service state without lock: **Medium**
