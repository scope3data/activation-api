# Creative Management Guide

This guide provides a comprehensive walkthrough of creative management in the Scope3 Campaign API, following AdCP (Ad Context Protocol) standards and integrating creative agents for AI-powered creative generation.

## Table of Contents

- [Quick Start](#quick-start)
- [Understanding the Creative Hierarchy](#understanding-the-creative-hierarchy)
- [Core Workflows](#core-workflows)
- [Creative Agents Integration](#creative-agents-integration)
- [Best Practices](#best-practices)
- [Advanced Features](#advanced-features)

## Quick Start

### 1. Create Your First Creative (5 minutes)

```
👤 You: "Create a creative called 'Holiday Sale 2024' for buyer agent ba_123 with a banner image and headline text"

🤖 Claude: I'll create a creative with multiple assets for your holiday campaign.

*Uses: creative/create*
- creativeName: "Holiday Sale 2024"
- buyerAgentId: "ba_123"
- assets:
  - Banner image (1200x628)
  - Headline text: "Save 50% This Holiday"
  - CTA text: "Shop Now"
- advertiserDomains: ["yourstore.com"]

✅ Creative "Holiday Sale 2024" created successfully!
Creative ID: creative_abc123
Assets: 3 (banner image, headline, CTA)
Status: Draft
```

### 2. Assign to Campaign

```
👤 You: "Assign that creative to campaign camp_456"

🤖 Claude: I'll assign the Holiday Sale creative to your campaign.

*Uses: creative/assign*

✅ Creative assigned successfully!
The Holiday Sale 2024 creative is now active in campaign camp_456
```

### 3. Check Performance

```
👤 You: "Show me all creatives for campaign camp_456"

🤖 Claude: Here are the creatives assigned to your campaign.

*Uses: campaign/list_creatives*

📊 Campaign camp_456 has 1 creative:
🎨 Holiday Sale 2024 (v1.0.0)
   📈 Performance: 12,450 impressions, 234 clicks (1.88% CTR)
   🎯 Primary Asset: Banner image (1200x628)
```

## Understanding the Creative Hierarchy

### AdCP Creative Structure

Following AdCP standards, our creative management uses a **Creative → Assets** hierarchy:

```
Creative (Container)
├── Primary Asset (hero image/video)
├── Companion Assets (additional images, text)
└── Metadata (domains, categories, audience)
```

### Key Concepts

**Creative**: A conceptual advertising unit that contains multiple assets

- Has a name, description, and version
- Contains 1+ assets that work together
- Can be assigned to multiple campaigns
- Owned by a buyer agent

**Asset**: Individual files or content pieces

- Images, videos, text, audio, HTML, native components
- Has specific technical properties (dimensions, duration, format)
- Can have different roles (primary, companion, fallback)
- Reusable across creatives

**Buyer Agent**: The advertiser account that owns creatives

- All creatives belong to a buyer agent
- Campaigns can only use creatives from their buyer agent
- Enables resource sharing and brand consistency

## Core Workflows

### Workflow 1: Create Creative from Scratch

```
1️⃣ Upload Individual Assets (Optional)
👤 "Upload a logo image for buyer agent ba_123"
🤖 Uses: creative/upload_asset
📎 Asset uploaded: logo_image_001

2️⃣ Create Creative with Assets
👤 "Create a display creative called 'Q1 Campaign' using the logo plus headline 'New Products'"
🤖 Uses: creative/create
🎨 Creative created with 2 assets

3️⃣ Assign to Campaign
👤 "Assign creative cr_789 to campaign camp_123"
🤖 Uses: creative/assign
✅ Assignment complete
```

### Workflow 2: Campaign-Centric Approach

```
1️⃣ Start with Campaign
👤 "Attach creatives to campaign camp_456 for buyer agent ba_123"

2️⃣ Choose Approach:

Option A - Use Existing:
👤 "Attach existing creatives cr_111 and cr_222"
🤖 Uses: campaign/attach_creative

Option B - Create New:
👤 "Create a new video creative called 'Product Demo' and attach it"
🤖 Uses: campaign/attach_creative (with newCreatives)

Option C - Natural Language:
👤 "Create banner creatives for our spring sale targeting millennials"
🤖 Uses: campaign/attach_creative (with prompt)
```

### Workflow 3: Bulk Creative Management

```
1️⃣ List All Creatives
👤 "List all creatives for buyer agent ba_123"
🤖 Uses: creative/list
📦 Shows all creatives with campaign assignments

2️⃣ Filter and Search
👤 "Show me all video creatives not assigned to any campaigns"
🤖 Uses: creative/list with filters
📹 Filtered results: unassigned video creatives

3️⃣ Bulk Operations
👤 "Assign creatives cr_001, cr_002, cr_003 to campaign camp_789"
🤖 Uses: campaign/attach_creative
✅ Multiple assignments completed
```

## Creative Agents Integration

Creative agents provide AI-powered creative generation following AdCP PR #23. Here's how they integrate:

### What are Creative Agents?

Creative agents are AI-powered tools that can:

- **Generate creatives conversationally** through natural language
- **Create both static assets** (images, text) and **dynamic code** (interactive ads)
- **Optimize creatives in real-time** based on performance data
- **Understand brand guidelines** and maintain consistency

### Integration Points

#### 1. Manifest Mode (Static Asset Generation)

```
👤 "Use a creative agent to build a banner creative for our coffee brand"

🤖 I'll engage a creative agent to generate assets for your coffee brand.

*Behind the scenes:*
1. Creative agent generates asset manifest
2. Assets are created (images, text, layouts)
3. Manifest feeds into creative/create
4. Creative is ready for campaign assignment

✅ Creative generated via creative agent:
- Primary: Coffee cup hero image (1200x628)
- Text: "Premium Coffee, Premium Experience"
- CTA: "Order Now"
- Brand colors and fonts automatically applied
```

#### 2. Code Mode (Dynamic Creative Generation)

```
👤 "Create a dynamic video creative that personalizes based on viewer location"

🤖 I'll deploy a creative agent to build a personalized video creative.

*Behind the scenes:*
1. Creative agent writes executable creative code
2. Code handles real-time personalization logic
3. Dynamic creative deployed to AdCP publishers
4. Real-time inference for each impression

✅ Dynamic creative deployed:
- Base video template with location placeholders
- Real-time city/weather data integration
- Personalized call-to-action based on local offers
```

#### 3. Conversational Creative Refinement

```
👤 "I don't like the blue color in the banner, make it more green"

🤖 I'll refine the creative using the creative agent.

*Creative agent conversation:*
🎨 Agent: Analyzing current banner design...
🎨 Agent: Shifting color palette from blue (#2196F3) to green (#4CAF50)
🎨 Agent: Maintaining brand contrast and accessibility
🎨 Agent: Generating updated banner version

✅ Creative updated:
- New version with green color scheme
- All brand guidelines maintained
- Ready for A/B testing against original
```

### Integration Architecture

Our creative management system integrates creative agents through:

```
1. Natural Language Interface
   User Request → Claude → Creative Agent → Asset Generation

2. Asset Pipeline Integration
   Creative Agent Output → creative/create → Campaign Assignment

3. Performance Feedback Loop
   Campaign Performance → Creative Agent → Optimization → New Variants

4. Brand Consistency Engine
   Brand Guidelines → Creative Agent → All Generated Assets
```

### Creative Agent Tools

When creative agents are available, these tools will integrate seamlessly:

**`build_creative`**: Conversational creative generation

- Natural language creative briefs
- Iterative refinement through conversation
- Brand guideline adherence
- Multi-format output (static + dynamic)

**`manage_creative_library`**: AI-powered asset organization

- Auto-tagging of assets
- Content similarity detection
- Usage pattern analysis
- Asset recommendation engine

## Best Practices

### 1. Organize with Buyer Agents

```
✅ Good: Separate buyer agents by brand
- Nike buyer agent → Nike creatives
- Adidas buyer agent → Adidas creatives

❌ Avoid: Mixing brands in one buyer agent
- Single agent with mixed brand creatives
```

### 2. Use Descriptive Names

```
✅ Good Naming:
- Creative: "Summer Sale 2024 - Video Series"
- Asset: "Hero video - Summer sale announcement (30s)"

❌ Poor Naming:
- Creative: "Creative_001"
- Asset: "video.mp4"
```

### 3. Leverage Asset Reuse

```
✅ Smart Reuse:
1. Upload logo once → Use in multiple creatives
2. Create brand text templates → Reuse across campaigns
3. Standard CTA buttons → Consistent experience

📈 Benefits:
- Brand consistency
- Faster creative development
- Lower production costs
```

### 4. Campaign Assignment Strategy

```
✅ Strategic Assignment:
- A/B test: Same campaign, multiple creative variants
- Seasonal: Rotate creatives by time period
- Audience: Different creatives for different segments

📊 Track Performance:
- Use campaign/list_creatives for performance data
- Monitor CTR, conversions by creative
- Optimize based on data
```

### 5. Creative Lifecycle Management

```
📅 Lifecycle Stages:
Draft → Review → Active → Optimized → Archived

🔄 Best Practices:
- Keep drafts until approved
- Archive old creatives (don't delete)
- Version creatives for major changes
- Tag creatives for easy searching
```

## Advanced Features

### Dynamic Creative Optimization (DCO)

When creative agents are integrated:

```
👤 "Set up dynamic optimization for creative cr_123"

🤖 I'll configure dynamic creative optimization.

*Configuration:*
- Template: Base creative with variable elements
- Dynamic Elements: Headlines, images, CTAs
- Optimization Goal: Click-through rate
- Personalization: Location, device, time of day

📈 Result: Creative automatically adapts for each user
```

### Multi-Format Creative Packages

```
👤 "Create a responsive creative package for all screen sizes"

🤖 I'll create a creative package with multiple format variants.

*Package Contents:*
- Desktop: 728x90 leaderboard
- Mobile: 320x50 banner
- Tablet: 300x250 rectangle
- CTV: 16:9 video format

✅ All formats share brand assets and messaging
🔄 Automatic format selection based on placement
```

### Creative Performance Analytics

```
👤 "Show me performance breakdown for creative cr_456"

🤖 Here's the detailed performance analysis:

📊 Creative Performance (Last 30 Days):
- Total Impressions: 847,392
- Clicks: 12,834 (1.51% CTR)
- Conversions: 432 (3.37% CVR)

📈 Performance by Asset:
- Hero image: 89% of impressions
- Headline A: 2.1% CTR
- Headline B: 1.8% CTR

💡 Optimization Suggestions:
- Test new hero image variants
- Headline A performing better - scale up
- Consider video format for mobile placements
```

### Brand Safety and Compliance

```
👤 "Ensure all creatives comply with financial services regulations"

🤖 I'll check creative compliance for financial services.

*Compliance Checks:*
- Required disclaimers: ✅ Present
- Font size minimums: ✅ Met
- Required legal text: ✅ Included
- Prohibited claims: ✅ None detected

✅ All creatives compliant with regulations
📋 Compliance report generated for legal review
```

## Common Questions

### Q: How many assets can a creative have?

**A:** No hard limit, but we recommend 3-5 assets per creative for optimal performance and management.

### Q: Can I use the same creative across multiple campaigns?

**A:** Yes! That's a key feature. Assign one creative to multiple campaigns within the same buyer agent.

### Q: What happens if I update a creative that's assigned to active campaigns?

**A:** Updates create new versions. Active campaigns continue using the assigned version unless you explicitly update the assignment.

### Q: How do I organize creatives for multiple brands?

**A:** Use separate buyer agents for each brand. Each buyer agent has its own creative library.

### Q: Can creative agents work with my existing brand guidelines?

**A:** Yes! Creative agents can be trained on your brand guidelines, logo usage, color palettes, and messaging frameworks.

---

## Next Steps

1. **Start Simple**: Create your first creative with `creative/create`
2. **Explore Workflows**: Try both creative-centric and campaign-centric approaches
3. **Leverage AI**: Experiment with creative agents when available
4. **Monitor Performance**: Use analytics to optimize your creative mix
5. **Scale Up**: Build creative libraries and reuse assets efficiently

Need help? All creative management tools work conversationally with Claude - just describe what you want to accomplish!
