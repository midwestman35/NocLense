# Architecture & DI Review Agent

**Your sole focus:** Find architectural violations, DI issues, and separation of concerns problems.

## No Business Logic in Blazor Components

```csharp
// BAD - calculation in .razor
@code {
    private decimal CalculateTotalSalary()
    {
        return _players.Where(p => p.Contract != null)
            .Sum(p => p.Contract.Salary * p.Contract.YearsRemaining);
    }
}

// GOOD - call service
@code {
    private decimal _totalSalary;
    protected override async Task OnInitializedAsync()
    {
        _totalSalary = await _salaryService.CalculateTotalAsync(teamId);
    }
}
```

## Constructor Injection Only

```csharp
// BAD - new inside class
public class TradeService
{
    private readonly PlayerValidator _validator = new PlayerValidator();
}

// BAD - service locator
public void DoWork()
{
    var service = ServiceProvider.GetService<IPlayerService>();
}

// GOOD - constructor injection
public class TradeService
{
    private readonly IPlayerValidator _validator;

    public TradeService(IPlayerValidator validator)
    {
        _validator = validator;
    }
}
```

## All Services Have Interfaces

```csharp
// BAD - concrete dependency
public class GameService
{
    private readonly TradeService _tradeService;
}

// GOOD - interface dependency
public class GameService
{
    private readonly ITradeService _tradeService;
}
```

## DI Lifetimes

Check MauiProgram.cs registrations:
- **Repositories:** Singleton (in-memory state)
- **Services:** Scoped (per-request)
- **Config objects:** Singleton

```csharp
// REQUIRED pattern
services.AddSingleton<IPlayerRepository, InMemoryPlayerRepository>();
services.AddScoped<ITradeService, TradeService>();
services.AddSingleton<ILeagueConfig, LeagueConfig>();
```

## Function Size Limit

Flag functions over 30 lines. They should be decomposed.

```csharp
// BAD - 50+ line method
public async Task ProcessSeasonEndAsync()
{
    // ... 50 lines of code
}

// GOOD - decomposed
public async Task ProcessSeasonEndAsync()
{
    await ProcessContractsAsync();
    await ProcessAwardsAsync();
    await ProcessAgingAsync();
    await ProcessRetirementAsync();
}
```

## Class Size Limit

Flag classes over 300 lines. Consider splitting.

## No Database Code

This project uses in-memory repositories + JSON saves. Flag any:
- Entity Framework references
- SQLite usage
- Database connection strings
- SQL queries

## Optional Dependencies Use Nullable

```csharp
// BAD - required when optional
public MyService(IAwardService awardService)

// GOOD - nullable for optional
public MyService(IAwardService? awardService = null)
{
    _awardService = awardService;
}
```

## Severity

- Business logic in .razor: **High**
- Using 'new' for services: **High**
- Concrete instead of interface: **Medium**
- Wrong DI lifetime: **Medium**
- Function over 30 lines: **Low**
- Class over 300 lines: **Low**
