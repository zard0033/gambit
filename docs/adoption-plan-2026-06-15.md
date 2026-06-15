# Adoption Plan

> **Generated**: 2026-06-15
> **Project phase**: Production
> **Engine**: Web App (TypeScript + Vue 3 + Vite + Tailwind)
> **Template version**: v1.0+

Work through these steps in order. Check off each item as you complete it.
Re-run `/adopt` anytime to check remaining gaps.

---

## Step 1: Fix Blocking Gaps ✅ DONE

### 1a. systems-index.md — parenthetical & bold status values

**Problem**: 15 rows had status values with parenthetical annotations (e.g. `Approved (round 2, 2026-05-27)`) and/or bold markup (`**Approved**`). Template skills use exact string matching against valid status values — any extra text causes silent match failures in `/gate-check`, `/create-stories`, and `/architecture-review`.

**Fix**: Stripped all parentheticals and bold from the Status column. Clean values preserved: `Approved`, `Designed`, `In Design`, `Not Started`.

**Time**: 5 min
- [x] systems-index.md status values cleaned

---

## Step 2: Fix High-Priority Gaps ✅ DONE

### 2a. coordination-rules.md — stale Opus model ID

**Problem**: Model tier table referenced `claude-opus-4-6`, which is no longer current. Should be `claude-opus-4-8` (Opus 4.8). This affects skills that pass `model: opus` to subagents — they may fail or degrade silently.

**Fix**: Updated to `claude-opus-4-8`.

**Time**: 2 min
- [x] coordination-rules.md Opus model ID updated

---

## Step 3: Bootstrap Infrastructure ✅ ALREADY COMPLETE

All infrastructure files already exist and are in good shape:

- [x] `production/stage.txt` — set to `Production`
- [x] `docs/architecture/tr-registry.yaml` — exists
- [x] `docs/architecture/control-manifest.md` — exists
- [x] `production/sprint-status.yaml` — exists
- [x] `production/review-mode.txt` — set to `lean`

**Only gap**: `docs/engine-reference/` directory is absent. For this project, "engine" is the browser/TypeScript/Vue platform — there is no versioned engine SDK to snapshot. This directory is not applicable and can be safely omitted.

---

## Step 4: Medium-Priority Gaps

### 4a. 60 stories missing TR-IDs

**Problem**: 60 of 71 story files contain no `TR-[system]-[NNN]` reference. Without TR-IDs, the template cannot detect staleness when a GDD or ADR changes — stories silently stay in-sync with an old design version.

**Fix**: Regenerate stories after significant GDD changes using `/create-stories`. For existing in-progress stories, add TR-IDs manually by cross-referencing `docs/architecture/tr-registry.yaml`.

**Time**: 1 session
- [ ] TR-IDs added to stories (or noted as deferred for in-progress stories)

### 4b. 21 stories missing ADR references

**Problem**: 21 stories have no `ADR-NNNN` reference in their body. This means `/story-readiness` cannot verify architectural compliance before implementation begins.

**Fix**: For each affected story, check which ADRs govern the implementation area and add an "ADR References" line. Focus on stories that are `In Progress` or `Ready`.

**Time**: 30 min
- [ ] ADR references added to in-progress stories

---

## Step 5: Optional Improvements

### 5a. 70 stories missing `Manifest Version:` stamp

**Problem**: Manifest version stamps let `/story-readiness` detect when stories were written against an older control manifest. 70 of 71 stories lack this field.

**Impact**: LOW — checks auto-pass when the field is absent. No functional breakage.

**Fix**: Add `Manifest Version: [current]` to story headers when regenerating stories in future sprints. Do not retroactively edit stories already in progress.

- [ ] New stories going forward include `Manifest Version:` stamp

### 5b. story-001-tr-registry-update.md — missing acceptance criteria

**Problem**: This one story has no `- [ ]` checkbox list. The story cannot be verified as done by `/story-done`.

**Fix**: Open the story and add an `## Acceptance Criteria` section with at least one checkbox.

**Time**: 5 min
- [ ] Acceptance criteria added to `story-001-tr-registry-update.md`

---

## What to Expect from Existing Stories

Existing stories continue to work with all template skills. New format checks (TR-ID validation, manifest version staleness) auto-pass when the fields are absent — so nothing breaks. They won't benefit from staleness tracking until regenerated. Do not regenerate stories that are in progress or done.

---

## Re-run

Run `/adopt` again after completing Steps 4–5 to verify all gaps are resolved. The new run will reflect the current state of the project.
