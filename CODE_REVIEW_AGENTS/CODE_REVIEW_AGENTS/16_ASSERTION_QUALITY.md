# Assertion Quality Review Agent

**Your sole focus:** Find weak test assertions, missing formula verification, and untested calculation components.

## Weak Assertions (CRITICAL)

```csharp
// BAD - doesn't verify actual requirement
player.Age.Should().BeGreaterThan(0);  // Requirement was 25-32!
result.Should().NotBeNull();            // Doesn't verify value
items.Should().HaveCount(3);            // Doesn't verify contents

// GOOD - verifies actual requirement
player.Age.Should().BeInRange(25, 32);  // Tests the actual range
result.Should().NotBeNull();
result.Value.Should().Be(expectedValue); // Verifies the value too
items.Should().BeEquivalentTo(expected); // Verifies actual contents
```

**Red flags to catch:**
- `.BeGreaterThan(0)` for bounded ranges — should use `.BeInRange(min, max)`
- `.NotBeNull()` as the ONLY assertion — should verify values
- `.HaveCount(x)` without `.Contain()` or `.BeEquivalentTo()`
- `.BeOfType<T>()` without verifying property values
- `.BeTrue()` / `.BeFalse()` without context on what's being verified
- Statistical tests with < 1000 samples

## Formula/Calculation Testing (CRITICAL)

```csharp
// BAD - doesn't verify formula is correct
var obp = service.CalculateOBP(stats);
obp.Should().BeGreaterThan(0);  // Would pass even if formula is wrong!

// GOOD - uses known values with hand-calculated result
// Formula: (H + BB + HBP) / (AB + BB + HBP + SF)
// Expected: (30 + 10 + 5) / (100 + 10 + 5 + 2) = 0.3846
var stats = new PlayerStats { Hits = 30, AtBats = 100, Walks = 10, HBP = 5, SacFlies = 2 };
var obp = service.CalculateOBP(stats);
obp.Should().BeApproximately(0.3846, 0.0001);
```

**Red flags to catch:**
- Formula tests without exact expected values
- Missing comment documenting the expected calculation
- Tests where ALL numeric inputs are zero (won't catch missing terms)
- Tests that only verify "greater than zero" for calculated values

## Component Isolation Testing

For formulas with multiple inputs (X + Y + Z), verify each component matters:

```csharp
// BAD - only tests with HBP = 0, won't catch if HBP is missing from formula
var stats = new PlayerStats { Hits = 30, Walks = 10, HBP = 0 };

// GOOD - tests that HBP affects the result
var without = service.CalculateOBP(new PlayerStats { Hits = 30, Walks = 10, HBP = 0 });
var with = service.CalculateOBP(new PlayerStats { Hits = 30, Walks = 10, HBP = 5 });
with.Should().BeGreaterThan(without);  // Proves HBP is included in formula
```

**Red flags to catch:**
- Multi-component formulas where some inputs are always zero in tests
- Synergy/bonus calculations without isolation tests for each modifier
- Probability calculations without boundary testing (0%, 100%, edge values)

## Boundary Value Testing

```csharp
// BAD - only tests middle values
player.Age = 28;
result.Should().BeInRange(25, 32);

// GOOD - tests boundaries
[Theory]
[InlineData(25)]  // Min boundary
[InlineData(32)]  // Max boundary
[InlineData(24)]  // Below min - should fail/clamp
[InlineData(33)]  // Above max - should fail/clamp
public void GenerateAge_AtBoundaries_HandlesCorrectly(int age) { }
```

## Where to Look

Focus on test files for:
- Services with "Calculate", "Compute", "Get...Bonus", "Get...Modifier" methods
- Statistical/random generation (handedness, age distribution, playstyle fit)
- Synergy bonuses, training multipliers, trigger probabilities
- Any method returning percentages, ratios, or multipliers

## Severity

- Weak assertion (BeGreaterThan(0) for specific ranges): **Critical**
- Formula test without known values: **Critical**
- Missing component isolation for multi-input formula: **High**
- Statistical test with < 1000 samples: **High**
- Missing boundary value tests: **Medium**
- Calculation test with all-zero inputs: **Medium**
