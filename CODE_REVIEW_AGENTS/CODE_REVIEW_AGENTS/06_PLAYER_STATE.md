# Player State Safety Review Agent

**Your sole focus:** Find player state consistency issues in trades, transfers, and roster changes.

## StartingLineup/StartingRotation (NOT IsStarter)

`Player.IsStarter` was removed. The system now uses:
- `Team.StartingLineup` - 9 slots for position players
- `Team.StartingRotation` - 5 slots for pitchers
- `Team.Bench` / `Team.Bullpen` - computed from players NOT in lineup/rotation

```csharp
// BAD - IsStarter doesn't exist
player.IsStarter = false;

// GOOD - use lineup/rotation slots
team.StartingLineup.ClearSlot(position);
team.StartingRotation.RemovePitcher(playerId);
```

## Contract Transfers

Every player transfer MUST handle contracts:

```csharp
// BAD - orphaned contract
player.TeamId = newTeamId;
await playerRepo.UpdateAsync(player);

// GOOD - transfer contract too
player.TeamId = newTeamId;
if (player.Contract != null)
{
    player.Contract.TeamId = newTeamId;
}
await playerRepo.UpdateAsync(player);
```

## FortyManRoster Limits

```csharp
// BAD - throws at 40
team.FortyManRoster.AddPlayer(player); // Might throw!

// GOOD - check first
if (team.FortyManRoster.Count >= 40)
    throw new InvalidOperationException("40-man roster full");
team.FortyManRoster.AddPlayer(player);
```

## PitcherRole for Position Players

```csharp
// BAD - position player with pitcher role
var shortstop = new Player { Position = Position.Shortstop, PitcherRole = PitcherRole.Starter };

// GOOD - position players are None
var shortstop = new Player { Position = Position.Shortstop, PitcherRole = PitcherRole.None };
```

## MinorLeagueLevel Methods

```csharp
// BAD - setting fields directly
player.MinorLeagueLevel = MinorLeagueLevel.None;
player.TeamId = majorLeagueTeamId;

// GOOD - use dedicated methods
player.PromoteToMajors();  // Clears MinorLeagueLevel, handles state

player.AssignToMinors(MinorLeagueLevel.AAA);  // Sets level properly
```

## TeamId on Expired Contracts

When contracts expire, clear TeamId BEFORE auto-managing lineup:

```csharp
// BAD - player re-added to lineup
await _rosterHelper.AutoManageLineup(team);
player.TeamId = null;  // Too late!

// GOOD - clear first
player.TeamId = null;
await _rosterHelper.AutoManageLineup(team);
```

## Injured Players in Lineup

AutoFillLineup and AutoFillRotation must exclude injured players:

```csharp
// Check that lineup management excludes injured
var candidates = players.Where(p =>
    !p.IsRetired &&
    !p.IsInMinors &&
    !p.IsInjured &&  // REQUIRED
    p.TeamId.HasValue
);
```

## Severity

- Missing contract transfer: **Critical**
- Setting MinorLeagueLevel directly: **High**
- FortyManRoster without count check: **High**
- Wrong PitcherRole on position player: **Medium**
- Injured players in lineup candidates: **Medium**
