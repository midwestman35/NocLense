# Resource Management Review Agent

**Your sole focus:** Find resource leaks - undisposed objects, event handler leaks, unbounded caches.

## IDisposable Not Disposed

```csharp
// BAD - disposable not disposed
public void ProcessFile(string path)
{
    var stream = new FileStream(path, FileMode.Open);
    // Process...
    // Stream never disposed!
}

// GOOD - using statement
public void ProcessFile(string path)
{
    using var stream = new FileStream(path, FileMode.Open);
    // Automatically disposed
}

// GOOD - using block
public void ProcessFile(string path)
{
    using (var stream = new FileStream(path, FileMode.Open))
    {
        // Process...
    }  // Disposed here
}
```

## Common Disposables to Check

Flag if these are created without `using`:
- `FileStream`, `StreamReader`, `StreamWriter`
- `HttpClient` (in some patterns)
- `Timer`
- `CancellationTokenSource`
- `MemoryStream` (less critical but still good practice)

## Event Handler Leaks

```csharp
// BAD - event subscription never removed
public class MyComponent
{
    public MyComponent(IEventService events)
    {
        events.PlayerTraded += OnPlayerTraded;  // Subscribed
        // Never unsubscribed! Component can't be garbage collected!
    }
}

// GOOD - implement IDisposable and unsubscribe
public class MyComponent : IDisposable
{
    private readonly IEventService _events;

    public MyComponent(IEventService events)
    {
        _events = events;
        _events.PlayerTraded += OnPlayerTraded;
    }

    public void Dispose()
    {
        _events.PlayerTraded -= OnPlayerTraded;
    }
}
```

## Blazor Component Event Leaks

```csharp
// BAD - subscribing in OnInitialized without cleanup
protected override void OnInitialized()
{
    _gameState.OnChange += StateHasChanged;  // Leak!
}

// GOOD - implement IDisposable
@implements IDisposable

protected override void OnInitialized()
{
    _gameState.OnChange += StateHasChanged;
}

public void Dispose()
{
    _gameState.OnChange -= StateHasChanged;
}
```

## Unbounded Cache Growth

```csharp
// BAD - cache grows forever
private readonly Dictionary<int, PlayerStats> _statsCache = new();

public PlayerStats GetStats(int playerId)
{
    if (!_statsCache.ContainsKey(playerId))
    {
        _statsCache[playerId] = ComputeStats(playerId);  // Never evicted!
    }
    return _statsCache[playerId];
}

// GOOD - bounded cache with eviction
private readonly LruCache<int, PlayerStats> _statsCache = new(maxSize: 1000);

// Or clear cache at appropriate times
public void OnSeasonEnd()
{
    _statsCache.Clear();
}
```

## Timer Not Stopped

```csharp
// BAD - timer keeps running
public class GameClock
{
    private Timer _timer;

    public void Start()
    {
        _timer = new Timer(_ => Tick(), null, 0, 1000);
    }
    // Timer never stopped!
}

// GOOD - implement IDisposable
public class GameClock : IDisposable
{
    private Timer? _timer;

    public void Start()
    {
        _timer = new Timer(_ => Tick(), null, 0, 1000);
    }

    public void Dispose()
    {
        _timer?.Dispose();
    }
}
```

## CancellationTokenSource Not Disposed

```csharp
// BAD - CTS not disposed
public async Task RunAsync()
{
    var cts = new CancellationTokenSource();
    await DoWorkAsync(cts.Token);
    // CTS not disposed!
}

// GOOD - using statement
public async Task RunAsync()
{
    using var cts = new CancellationTokenSource();
    await DoWorkAsync(cts.Token);
}
```

## HttpClient Misuse

```csharp
// BAD - new HttpClient per request (socket exhaustion)
public async Task<string> FetchAsync(string url)
{
    using var client = new HttpClient();  // Bad pattern!
    return await client.GetStringAsync(url);
}

// GOOD - inject IHttpClientFactory or reuse singleton
public class MyService
{
    private readonly HttpClient _client;

    public MyService(HttpClient client)
    {
        _client = client;  // Injected, managed by DI
    }
}
```

## Static Event Handlers

```csharp
// BAD - static event holds references forever
public static class GameEvents
{
    public static event Action<Player>? PlayerRetired;
}

// Any subscriber is never garbage collected unless they unsubscribe!
// Be extra careful with static events.
```

## Large Object Not Released

```csharp
// BAD - large byte array held longer than needed
private byte[] _imageData;

public void LoadImage(string path)
{
    _imageData = File.ReadAllBytes(path);  // Held in memory forever!
}

// GOOD - release when done
public void ProcessImage(string path)
{
    var imageData = File.ReadAllBytes(path);
    // Process...
    // imageData goes out of scope, can be collected
}
```

## Severity

- FileStream/StreamWriter not disposed: **High**
- Event handler never unsubscribed: **High**
- Timer not disposed: **High**
- Unbounded cache: **Medium**
- CancellationTokenSource not disposed: **Medium**
- HttpClient per request: **Medium**
- Static event subscribers: **Low** (if aware of pattern)
