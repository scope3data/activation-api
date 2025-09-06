# Optimization Modes

Scope3 offers two primary approaches to campaign optimization, each designed for different team needs and strategic preferences.

## 🎯 Built-in Optimization

**Perfect for:** Teams seeking efficiency and simplicity, agencies managing multiple clients, or campaigns where speed-to-market is critical.

### How It Works

When you create a campaign without specifying `inventoryManagement` parameters, Scope3 automatically optimizes your inventory allocation:

```javascript
await create_campaign({
  brandAgentId: "ba_123",
  name: "Brand Awareness Q4",
  prompt:
    "Maximize reach for our new product launch targeting tech-savvy millennials",
  budget: {
    total: 100000,
    currency: "USD",
  },
  startDate: "2024-10-01",
  endDate: "2024-12-31",
  // No inventoryManagement specified = scope3_managed mode
});
```

### What Scope3 Handles Automatically

**Inventory Mix Optimization**

- Analyzes available publisher inventory for your campaign goals
- Selects optimal mix of premium and programmatic options
- Balances reach, efficiency, and brand safety requirements

**Signal Selection**

- Chooses appropriate targeting signals based on campaign prompt
- Combines first-party data, contextual signals, and audience insights
- Optimizes signal costs against performance goals

**Budget Allocation**

- Distributes budget across selected inventory sources
- Sets appropriate daily caps and pacing strategies
- Adjusts allocation based on early performance indicators

**Performance-Based Rebalancing**

- Monitors campaign performance across all inventory sources
- Automatically shifts budget toward higher-performing options
- Maintains overall campaign goals while maximizing efficiency

### Example: Auto-Optimized Campaign Flow

```javascript
// 1. Simple campaign creation
const campaign = await create_campaign({
  brandAgentId: "ba_456",
  name: "Holiday Electronics Campaign",
  prompt:
    "Target electronics enthusiasts ages 25-45 with premium video inventory",
  budget: { total: 75000, currency: "USD" },
  startDate: "2024-11-15",
  endDate: "2024-12-24",
});

// 2. Scope3 automatically creates inventory options like:
// - Premium CTV (Hulu, Samsung TV+) with contextual targeting: $30,000
// - YouTube Select with electronics affinity data: $25,000
// - Premium display on tech sites with 1P lookalikes: $20,000

// 3. Daily optimization adjustments:
// Week 1: Equal distribution to gather data
// Week 2: 60% to CTV (best CTR), 25% YouTube, 15% display
// Week 3: Further optimization based on conversion data
```

### Built-in Optimization Benefits

✅ **Faster Time-to-Market** - Launch campaigns in minutes, not hours
✅ **Expert-Level Strategy** - Leverage Scope3's optimization algorithms
✅ **Continuous Improvement** - Benefit from platform-wide learning
✅ **Reduced Complexity** - Focus on creative and messaging, not tactical details
✅ **Consistent Performance** - Proven strategies applied to your campaigns

## 🎛️ Granular Control

**Perfect for:** Teams with specific strategic requirements, experienced traders comfortable with manual optimization, or campaigns requiring custom inventory mixes.

### How It Works

Specify `user_managed` mode to take full control over inventory selection and allocation:

```javascript
await create_campaign({
  brandAgentId: "ba_123",
  name: "Performance Campaign Q4",
  budget: {
    total: 100000,
    currency: "USD",
  },
  inventoryManagement: {
    mode: "user_managed",
    optimizationGoal: "conversions",
    constraints: {
      maxCpm: 45,
      brandSafetyLevel: "high",
      minimumReach: 5000000,
    },
  },
});
```

### Manual Inventory Configuration

After creating a user-managed campaign, configure your specific inventory mix:

```javascript
// High-value CTV inventory with first-party data
await create_inventory_option({
  campaignId: "camp_123",
  name: "Premium CTV + 1P Data",
  mediaProductId: "hulu_premium_ctv",
  targeting: {
    signalType: "buyer",
    signalProvider: "customer_data_platform",
    signalConfiguration: {
      audiences: ["high_ltv_customers", "lookalike_premium"],
    },
  },
  budgetAllocation: {
    amount: 40000,
    percentage: 40,
    dailyCap: 2000,
    pacing: "even",
    currency: "USD",
  },
});

// Contextual targeting on premium sites
await create_inventory_option({
  campaignId: "camp_123",
  name: "Premium Display + Contextual",
  mediaProductId: "premium_display_network",
  targeting: {
    signalType: "scope3",
    signalConfiguration: {
      contextualKeywords: ["luxury", "premium", "high-end"],
      categories: ["automotive", "technology"],
    },
  },
  budgetAllocation: {
    amount: 35000,
    percentage: 35,
    pacing: "front_loaded",
    currency: "USD",
  },
});

// Programmatic scale with third-party data
await create_inventory_option({
  campaignId: "camp_123",
  name: "Programmatic Scale + 3P Data",
  mediaProductId: "open_exchange_display",
  targeting: {
    signalType: "third_party",
    signalProvider: "liveramp",
    signalConfiguration: {
      segments: ["auto_intenders", "luxury_shoppers"],
    },
  },
  budgetAllocation: {
    amount: 25000,
    percentage: 25,
    dailyCap: 1500,
    pacing: "asap",
    currency: "USD",
  },
});
```

### Advanced Portfolio Management

**Allocation Adjustments**

```javascript
// Shift budget based on performance
await adjust_inventory_allocation({
  campaignId: "camp_123",
  adjustments: [
    { inventoryOptionId: "io_premium_ctv", newAmount: 50000 }, // Increase top performer
    { inventoryOptionId: "io_programmatic", newAmount: 15000 }, // Reduce underperformer
  ],
});
```

**Performance Analysis**

```javascript
// Get detailed performance breakdown
const performance = await analyze_inventory_performance({
  campaignId: "camp_123",
  dateRange: { start: "2024-10-01", end: "2024-10-07" },
  groupBy: ["inventoryOption", "signalType", "dayOfWeek"],
});
```

### Granular Control Benefits

✅ **Strategic Precision** - Execute specific inventory strategies
✅ **Advanced Optimization** - Fine-tune every aspect of allocation
✅ **Institutional Knowledge** - Build and leverage team expertise
✅ **Custom Requirements** - Handle unique brand or compliance needs
✅ **Maximum Transparency** - Full visibility into allocation decisions

## 🔄 Hybrid Mode (Coming Soon)

Combine the best of both approaches:

```javascript
await create_campaign({
  inventoryManagement: {
    mode: "hybrid",
    baseOptimization: "scope3_managed",
    userOverrides: {
      maxCpmOverride: 35,
      preferredInventory: ["premium_ctv", "youtube_select"],
      budgetConstraints: {
        premiumMinimum: 0.6, // 60% minimum to premium inventory
      },
    },
  },
});
```

## Choosing the Right Mode

### Use Built-in Optimization When:

- ✅ Launching campaigns quickly is priority
- ✅ Team lacks deep programmatic expertise
- ✅ Campaign goals are standard (reach, awareness, performance)
- ✅ Trust in platform optimization is high
- ✅ Focus should be on creative and messaging strategy

### Use Granular Control When:

- ✅ Specific inventory relationships need to be maintained
- ✅ Custom allocation strategies are required
- ✅ Team has strong programmatic trading experience
- ✅ Campaign has unique compliance or brand safety needs
- ✅ Maximum control and transparency are essential

### Decision Framework

| Factor                   | Built-in Optimization | Granular Control |
| ------------------------ | --------------------- | ---------------- |
| **Speed to Launch**      | ⭐⭐⭐⭐⭐            | ⭐⭐             |
| **Strategic Control**    | ⭐⭐                  | ⭐⭐⭐⭐⭐       |
| **Learning Required**    | ⭐                    | ⭐⭐⭐⭐         |
| **Custom Requirements**  | ⭐⭐                  | ⭐⭐⭐⭐⭐       |
| **Optimization Quality** | ⭐⭐⭐⭐⭐            | ⭐⭐⭐⭐         |

## Mode Switching

You can change optimization modes for existing campaigns:

```javascript
// Switch from auto to manual mid-campaign
await update_campaign({
  campaignId: "camp_123",
  inventoryManagement: {
    mode: "user_managed",
    transitionStrategy: "preserve_performance", // Maintain current allocation as starting point
  },
});
```

This creates inventory options matching your current auto-optimized allocation, giving you a starting point for manual optimization.

## Best Practices

### For Built-in Optimization

1. **Provide Rich Context** - Detailed campaign prompts help our AI understand your goals
2. **Set Clear Budgets** - Include total budget, currency, and date ranges
3. **Monitor Early Performance** - Review first week results to ensure alignment
4. **Trust the Process** - Allow 7-14 days for optimization to stabilize

### For Granular Control

1. **Start with Discovery** - Use `discover_publisher_products` to explore options
2. **Plan Your Portfolio** - Design allocation strategy before creating options
3. **Test Systematically** - Create similar inventory options with single variable changes
4. **Monitor and Adjust** - Use performance analysis to guide allocation changes

---

_Both modes are designed to help you achieve your campaign goals - choose the one that best fits your team's needs and expertise level._
