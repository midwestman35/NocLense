# Blazor Patterns Review Agent

**Your sole focus:** Find Blazor/UI-specific issues in .razor files and UI code.

## CultureInfo.InvariantCulture Required

```csharp
// BAD - flag ALL ToString with format but no culture
salary.ToString("C0")
date.ToString("MM/dd")
value.ToString("N2")
percentage.ToString("P1")

// GOOD - always specify culture
salary.ToString("C0", CultureInfo.InvariantCulture)
date.ToString("MM/dd", CultureInfo.InvariantCulture)
```

## async void Must Have try-catch

```csharp
// BAD - unhandled exceptions silently lost
private async void OnButtonClick()
{
    await DoSomethingAsync();
}

// GOOD - wrapped in try-catch
private async void OnButtonClick()
{
    try { await DoSomethingAsync(); }
    catch (Exception ex) { _errorMessage = ex.Message; }
}
```

## LoadDataAsync Pattern

```csharp
// BAD - loading logic in OnInitializedAsync
protected override async Task OnInitializedAsync()
{
    _isLoading = true;
    _data = await _service.GetDataAsync();
    _isLoading = false;
}

// GOOD - extracted for retry support
protected override async Task OnInitializedAsync() => await LoadDataAsync();

private async Task LoadDataAsync()
{
    _isLoading = true;
    _errorMessage = null;
    try { _data = await _service.GetDataAsync(); }
    catch (Exception ex) { _errorMessage = ex.Message; }
    finally { _isLoading = false; }
}
```

## Virtualize for Large Lists

```csharp
// BAD - renders all items (slow for 100+ items)
@foreach (var item in _largeList)
{
    <div>@item.Name</div>
}

// GOOD - only renders visible items
<Virtualize Items="_largeList" Context="item">
    <div>@item.Name</div>
</Virtualize>
```

Flag any `@foreach` on lists that could exceed 50 items.

## @key on Loops

```csharp
// BAD - inefficient re-renders
@foreach (var player in _players)
{
    <PlayerCard Player="player" />
}

// GOOD - keyed for efficient updates
@foreach (var player in _players)
{
    <PlayerCard @key="player.PlayerId" Player="player" />
}
```

## No IndexOf in Virtualize

```csharp
// BAD - O(n) per item = O(n²) total
<Virtualize Items="_players" Context="p">
    <div>@(_players.IndexOf(p) + 1). @p.Name</div>
</Virtualize>

// GOOD - pre-compute lookup
@code {
    Dictionary<int, int> _playerIndex = _players
        .Select((p, i) => (p, i))
        .ToDictionary(x => x.p.PlayerId, x => x.i);
}
<Virtualize Items="_players" Context="p">
    <div>@(_playerIndex[p.PlayerId] + 1). @p.Name</div>
</Virtualize>
```

## Severity

- Missing CultureInfo: **High**
- async void without try-catch: **High**
- Missing LoadDataAsync pattern: **Medium**
- foreach on large list without Virtualize: **Medium**
- Missing @key on loops: **Low**
