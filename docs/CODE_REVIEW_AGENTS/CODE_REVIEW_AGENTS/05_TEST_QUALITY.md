# Test Quality Review Agent

**Your sole focus:** Find test quality issues, coverage gaps, and pattern violations.

## Naming Convention

```csharp
// BAD - missing segments
[Fact]
public void TestPlayerCreation() { }

[Fact]
public void ShouldReturnTrue() { }

// GOOD - MethodName_Scenario_ExpectedResult
[Fact]
public void GetById_ExistingPlayer_ReturnsPlayer() { }

[Fact]
public void CalculateAge_BirthdayToday_IncrementsAge() { }
```

## No Reference Mutation

```csharp
// BAD - mutates same reference, doesn't test persistence
var player = await repo.GetByIdAsync(1);
player.Name = "New Name";
await repo.UpdateAsync(player);
player.Name.Should().Be("New Name"); // Tests the SAME object!

// GOOD - fetch again to verify persistence
var player = await repo.GetByIdAsync(1);
player.Name = "New Name";
await repo.UpdateAsync(player);

var fetched = await repo.GetByIdAsync(1); // Fresh fetch
fetched.Name.Should().Be("New Name");
```

## bUnit v2 API

```csharp
// BAD - v1 API (obsolete)
public class MyTests : TestContext
{
    var cut = RenderComponent<MyComponent>();
}

// GOOD - v2 API
public class MyTests : BunitContext
{
    var cut = Render<MyComponent>();
}
```

## PageTestHelper Usage

```csharp
// BAD - manual service registration
Services.AddSingleton(Substitute.For<IPlayerRepository>());
Services.AddSingleton(Substitute.For<ITeamRepository>());
// ... 20 more registrations

// GOOD - use helper
var mocks = PageTestHelper.RegisterCommonServices(Services);
mocks.PlayerRepo.GetByIdAsync(1).Returns(testPlayer);
```

## Mock Fidelity

```csharp
// BAD - reimplements business logic in mock
mockRepo.GetActivePlayersAsync().Returns(callInfo =>
    _players.Where(p => !p.IsRetired && p.TeamId.HasValue).ToList()
);

// GOOD - returns configured data
var activePlayers = new List<Player> { player1, player2 };
mockRepo.GetActivePlayersAsync().Returns(activePlayers);
```

## Tab Click Pattern (bUnit)

```csharp
// BAD - stale reference after re-render
var tab = cut.Find(".nav-link");
tab.Click();
tab.ClassList.Should().Contain("active"); // STALE!

// GOOD - re-query after click
cut.Find(".nav-link").Click();
var activeTab = cut.Find(".nav-link.active"); // Fresh query
activeTab.Should().NotBeNull();
```

## File Placement

- Model tests go in model test files
- Service tests go in service test files
- Don't put model tests in repository test files

## Coverage Check

Flag if new code lacks corresponding tests:
- New service method → needs unit test
- New repository method → needs unit test
- New Blazor component → needs bUnit test
- Bug fix → needs regression test

## Severity

- Missing test for new code: **High**
- Wrong naming convention: **Medium**
- Reference mutation in test: **Medium**
- Using bUnit v1 API: **Low**
- Mock reimplements logic: **Low**

**Note:** Weak assertions and formula testing are covered by Agent 16 (Assertion Quality).
