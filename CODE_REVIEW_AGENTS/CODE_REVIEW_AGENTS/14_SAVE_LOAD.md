# Save/Load Mapping Review Agent

**Your sole focus:** Find save game bugs - missing mappings, broken compatibility, data loss.

## New Model Properties Not in DTO

When a model gains a new property, the DTO must also be updated:

```csharp
// Model has new property
public class Player
{
    public int PlayerId { get; set; }
    public string Name { get; set; }
    public int LastAgedSeason { get; set; }  // NEW!
}

// BAD - DTO missing the property
public class PlayerDto
{
    public int PlayerId { get; set; }
    public string Name { get; set; }
    // LastAgedSeason missing! Will be lost on save!
}

// GOOD - DTO includes all properties
public class PlayerDto
{
    public int PlayerId { get; set; }
    public string Name { get; set; }
    public int LastAgedSeason { get; set; }  // Added!
}
```

**Check:** For every new property on a model, search for corresponding DTO property.

## SaveGameMapper Missing Mapping

```csharp
// BAD - property not mapped
public static PlayerDto ToDto(Player player)
{
    return new PlayerDto
    {
        PlayerId = player.PlayerId,
        Name = player.Name,
        // LastAgedSeason not mapped!
    };
}

// GOOD - all properties mapped
public static PlayerDto ToDto(Player player)
{
    return new PlayerDto
    {
        PlayerId = player.PlayerId,
        Name = player.Name,
        LastAgedSeason = player.LastAgedSeason,
    };
}
```

**Check both directions:**
- Model → DTO (saving)
- DTO → Model (loading)

## New Repository Not in Save/Load

When adding a new repository, it must be included in:

1. **SaveGameDataDto** - add the collection
2. **SaveGameMapper** - add mapping methods
3. **SaveGameService.CreateSaveDataAsync** - add to save
4. **SaveGameService.LoadGameAsync** - add to load with ClearAsync

```csharp
// SaveGameDataDto
public class SaveGameDataDto
{
    public List<PlayerDto> Players { get; set; }
    public List<HeadlineDto> Headlines { get; set; }  // NEW repo needs this!
}

// SaveGameService.LoadGameAsync
await _headlineRepo.ClearAsync();  // Clear first!
await _headlineRepo.LoadAsync(mapped.Headlines);
```

## Delta Save Missing New Data

If using delta saves (SaveGameDeltaDto), new data types must be added:

```csharp
public class SaveGameDeltaDto
{
    public List<PlayerDto> ModifiedPlayers { get; set; }
    public List<HeadlineDto> NewHeadlines { get; set; }  // Don't forget!
}
```

## Enum Value Changes Break Saves

```csharp
// BAD - changing enum values breaks old saves
public enum Position
{
    Pitcher = 0,
    Catcher = 1,
    FirstBase = 2,
    // Inserting here shifts all values!
    DesignatedHitter = 3,  // Was FirstBase!
    SecondBase = 4,        // Was ThirdBase!
}

// GOOD - add at end or use explicit values
public enum Position
{
    Pitcher = 0,
    Catcher = 1,
    FirstBase = 2,
    SecondBase = 3,
    ThirdBase = 4,
    DesignatedHitter = 10,  // Explicit value, doesn't shift others
}
```

## Nullable Handling in DTOs

```csharp
// Model allows null
public class Player
{
    public int? TeamId { get; set; }
}

// DTO must also be nullable
public class PlayerDto
{
    public int? TeamId { get; set; }  // Must match nullability!
}

// Mapping must handle null
TeamId = player.TeamId,  // OK - both nullable
```

## Collection Initialization on Load

```csharp
// BAD - null collection from old save
var dto = JsonSerializer.Deserialize<SaveGameDataDto>(json);
foreach (var h in dto.Headlines) { }  // NullReferenceException!

// GOOD - initialize if null
var headlines = dto.Headlines ?? new List<HeadlineDto>();
```

## ID Collisions After Load

```csharp
// BAD - _nextId not restored
public async Task LoadAsync(IEnumerable<Player> players)
{
    _players = players.ToDictionary(p => p.PlayerId);
    // _nextId still at 1! Next add will collide!
}

// GOOD - restore _nextId
public async Task LoadAsync(IEnumerable<Player> players)
{
    var list = players.ToList();
    _players = list.ToDictionary(p => p.PlayerId);
    _nextId = list.Any() ? list.Max(p => p.PlayerId) + 1 : 1;
}
```

## Circular Reference Handling

```csharp
// BAD - circular reference causes infinite JSON
public class Team
{
    public List<Player> Players { get; set; }
}
public class Player
{
    public Team Team { get; set; }  // Points back!
}

// GOOD - DTO uses ID reference
public class PlayerDto
{
    public int TeamId { get; set; }  // ID only, no circular ref
}
```

## Files to Check

For any new model/property, verify these files:
1. `Models/Dtos/[Model]Dto.cs` - DTO has property
2. `Services/SaveGameMapper.cs` - Both ToDto and FromDto map it
3. `Models/Dtos/SaveGameDataDto.cs` - Collection included
4. `Models/Dtos/SaveGameDeltaDto.cs` - Delta collection if applicable
5. `Services/SaveGameService.cs` - Load and save handle it

## Severity

- New property not in DTO: **Critical** (data loss)
- New repository not saved: **Critical** (data loss)
- Missing mapping in SaveGameMapper: **Critical** (data loss)
- Enum value change: **High** (breaks old saves)
- _nextId not restored: **High** (ID collision)
- Null collection from old save: **Medium** (crash on load)
