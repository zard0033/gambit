# Agent Coordination and Delegation Map

## Organizational Hierarchy

```
                           [Human Developer]
                                 |
                 +---------------+---------------+
                 |               |               |
         creative-director  technical-director  producer
                 |               |               |
        +--------+--------+     |        (coordinates all)
        |        |        |     |
  game-designer art-dir  narr-dir  lead-programmer  qa-lead
        |                 |         |                |
       sys              +-+--+   +--+--+--+         qa-t
                         |    |   |  |  |
                        wrt  wrld gp tl ui

  Additional Leads (report to producer/directors):
    release-manager         -- Release pipeline, versioning, deployment
    localization-lead       -- i18n, string tables, translation pipeline
    prototyper              -- Rapid throwaway prototypes, concept validation
    security-engineer       -- Anti-cheat, exploits, data privacy, network security
    accessibility-specialist -- WCAG, colorblind, remapping, text scaling
    community-manager       -- Patch notes, player feedback, crisis comms
    devops-engineer         -- CI/CD, build scripts, version control workflow
    analytics-engineer      -- Event tracking, dashboards, A/B test design
```

### Legend
```
sys  = systems-designer       gp  = gameplay-programmer
wrt  = writer                 tl  = tools-programmer
wrld = world-builder          ui  = ui-programmer
                               qa-t = qa-tester
narr-dir = narrative-director
art-dir = art-director
```

## Delegation Rules

### Who Can Delegate to Whom

| From | Can Delegate To |
|------|----------------|
| creative-director | game-designer, art-director, narrative-director |
| technical-director | lead-programmer, devops-engineer |
| producer | Any agent (task assignment within their domain only) |
| game-designer | systems-designer |
| lead-programmer | gameplay-programmer, tools-programmer, ui-programmer |
| art-director | ux-designer |
| narrative-director | writer, world-builder |
| qa-lead | qa-tester |
| release-manager | devops-engineer (release builds), qa-lead (release testing) |
| localization-lead | writer (string review), ui-programmer (text fitting) |
| prototyper | (works independently, reports findings to producer and relevant leads) |
| security-engineer | lead-programmer (secure patterns) |
| accessibility-specialist | ux-designer (accessible patterns), ui-programmer (implementation), qa-tester (a11y testing) |
| community-manager | (works with producer for approval, release-manager for patch note timing) |

### Escalation Paths

| Situation | Escalate To |
|-----------|------------|
| Two designers disagree on a mechanic | game-designer |
| Game design vs narrative conflict | creative-director |
| Game design vs technical feasibility | producer (facilitates), then creative-director + technical-director |
| Art vs audio tonal conflict | creative-director |
| Code architecture disagreement | technical-director |
| Cross-system code conflict | lead-programmer, then technical-director |
| Schedule conflict between departments | producer |
| Scope exceeds capacity | producer, then creative-director for cuts |
| Quality gate disagreement | qa-lead, then technical-director |

## Common Workflow Patterns

### Pattern 1: New Feature (Full Pipeline)

```
1. creative-director  -- Approves feature concept aligns with vision
2. game-designer      -- Creates design document with full spec
3. producer           -- Schedules work, identifies dependencies
4. lead-programmer    -- Designs code architecture, creates interface sketch
5. [specialist-programmer] -- Implements the feature
6. writer             -- Creates text content (if needed)
7. qa-tester          -- Writes test cases
8. qa-lead            -- Reviews and approves test coverage
9. lead-programmer    -- Code review
10. qa-tester         -- Executes tests
11. producer          -- Marks task complete
```

### Pattern 2: Bug Fix

```
1. qa-tester          -- Files bug report with /bug-report
2. qa-lead            -- Triages severity and priority
3. producer           -- Assigns to sprint (if not S1)
4. lead-programmer    -- Identifies root cause, assigns to programmer
5. [specialist-programmer] -- Fixes the bug
6. lead-programmer    -- Code review
7. qa-tester          -- Verifies fix and runs regression
8. qa-lead            -- Closes bug
```

### Pattern 3: Balance Adjustment

```
1. analytics-engineer -- Identifies imbalance from data (or player reports)
2. game-designer      -- Evaluates the issue against design intent
3. game-designer      -- Approves the new values
4. [data file update] -- Change configuration values
5. qa-tester          -- Regression test affected systems
6. analytics-engineer -- Monitor post-change metrics
```

### Pattern 4: Sprint Cycle

```
1. producer           -- Plans sprint with /sprint-plan new
2. [All agents]       -- Execute assigned tasks
3. producer           -- Daily status with /sprint-plan status
4. qa-lead            -- Continuous testing during sprint
5. lead-programmer    -- Continuous code review during sprint
6. producer           -- Sprint retrospective with post-sprint hook
7. producer           -- Plans next sprint incorporating learnings
```

### Pattern 5: Milestone Checkpoint

```
1. producer           -- Runs /milestone-review
2. creative-director  -- Reviews creative progress
3. technical-director -- Reviews technical health
4. qa-lead            -- Reviews quality metrics
5. producer           -- Facilitates go/no-go discussion
6. [All directors]    -- Agree on scope adjustments if needed
7. producer           -- Documents decisions and updates plans
```

### Pattern 6: Release Pipeline

```text
1. producer             -- Declares release candidate, confirms milestone criteria met
2. release-manager      -- Cuts release branch, generates release checklist
3. qa-lead              -- Runs full regression, signs off on quality
4. localization-lead    -- Verifies all strings translated, text fitting passes
5. devops-engineer      -- Builds release artifacts, runs deployment pipeline
6. release-manager      -- Generates /changelog, tags release, creates release notes
7. technical-director   -- Final sign-off on major releases
8. release-manager      -- Deploys and monitors for 48 hours
9. producer             -- Marks release complete
```

### Pattern 7: Concept Prototype (early — before GDDs)

```text
1. game-designer        -- Defines the hypothesis and success criteria
2. prototyper           -- Scaffolds concept prototype with /prototype
3. prototyper           -- Builds minimal implementation (1-3 days)
4. game-designer        -- Evaluates prototype against criteria
5. prototyper           -- Documents findings in REPORT.md
6. creative-director    -- PROCEED / PIVOT / KILL decision (full mode only)
7. game-designer        -- Informs GDD writing with prototype learnings if PROCEED
```

### Pattern 7b: Vertical Slice (pre-production — after GDDs and architecture)

```text
1. game-designer        -- Confirms slice scope against GDDs
2. prototyper           -- Builds production-quality end-to-end build with /vertical-slice
3. prototyper           -- Conducts internal playtest sessions (minimum 1)
4. prototyper           -- Documents findings in REPORT.md
5. creative-director    -- Go/no-go decision on proceeding to Production (full mode)
6. producer             -- Schedules Production epics/sprints if PROCEED
```

## Cross-Domain Communication Protocols

### Design Change Notification

When a design document changes, the game-designer must notify:
- lead-programmer (implementation impact)
- qa-lead (test plan update needed)
- producer (schedule impact assessment)
- Relevant specialist agents depending on the change

### Architecture Change Notification

When an ADR is created or modified, the technical-director must notify:
- lead-programmer (code changes needed)
- All affected specialist programmers
- qa-lead (testing strategy may change)
- producer (schedule impact)

### Asset Standard Change Notification

When the art bible or asset standards change, the art-director must notify:
- All content creators working with affected assets
- devops-engineer (if build pipeline is affected)

## Anti-Patterns to Avoid

1. **Bypassing the hierarchy**: A specialist agent should never make decisions
   that belong to their lead without consultation.
2. **Cross-domain implementation**: An agent should never modify files outside
   their designated area without explicit delegation from the relevant owner.
3. **Shadow decisions**: All decisions must be documented. Verbal agreements
   without written records lead to contradictions.
4. **Monolithic tasks**: Every task assigned to an agent should be completable
   in 1-3 days. If it is larger, it must be broken down first.
5. **Assumption-based implementation**: If a spec is ambiguous, the implementer
   must ask the specifier rather than guessing. Wrong guesses are more expensive
   than a question.
