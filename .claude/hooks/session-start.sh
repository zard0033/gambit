#!/bin/bash
# Claude Code SessionStart hook: Load project context at session start
# Outputs context information that Claude sees when a session begins
#
# Input schema (SessionStart): No stdin input

echo "=== Claude Code Game Studios — Session Context ==="

# Current branch
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ -n "$BRANCH" ]; then
    echo "Branch: $BRANCH"

    # Divergence from the remote. This is the FIRST thing reported on purpose: on 2026-08-05 a
    # session read a 7-day-old active.md, worked a full day, and found afterwards it had been
    # redoing work that was already 10 commits ahead on origin. "Recent commits" below looked
    # perfectly normal — being behind is invisible without asking for it explicitly.
    git fetch --quiet origin "$BRANCH" 2>/dev/null
    COUNTS=$(git rev-list --left-right --count "origin/$BRANCH...HEAD" 2>/dev/null)
    if [ -n "$COUNTS" ]; then
        BEHIND=$(echo "$COUNTS" | cut -f1)
        AHEAD=$(echo "$COUNTS" | cut -f2)
        if [ "$BEHIND" -gt 0 ]; then
            echo ""
            echo "🔴 落後 origin/$BRANCH $BEHIND 個 commit（本地領先 $AHEAD）"
            echo "   動工前先 git pull --rebase，並重讀 active.md——它可能是過期快照。"
            echo "   遠端新 commit："
            git log --oneline "HEAD..origin/$BRANCH" 2>/dev/null | head -10 | while read -r line; do
                echo "     $line"
            done
        elif [ "$AHEAD" -gt 0 ]; then
            echo "本地領先 origin/$BRANCH $AHEAD 個 commit（未 push）"
        fi
    fi

    # Recent commits
    echo ""
    echo "Recent commits:"
    git log --oneline -5 2>/dev/null | while read -r line; do
        echo "  $line"
    done
fi

# Current sprint (find most recent sprint file)
LATEST_SPRINT=$(ls -t production/sprints/sprint-*.md 2>/dev/null | head -1)
if [ -n "$LATEST_SPRINT" ]; then
    echo ""
    echo "Active sprint: $(basename "$LATEST_SPRINT" .md)"
fi

# Current milestone
LATEST_MILESTONE=$(ls -t production/milestones/*.md 2>/dev/null | head -1)
if [ -n "$LATEST_MILESTONE" ]; then
    echo "Active milestone: $(basename "$LATEST_MILESTONE" .md)"
fi

# Open bug count
BUG_COUNT=0
for dir in tests/playtest production; do
    if [ -d "$dir" ]; then
        count=$(find "$dir" -name "BUG-*.md" 2>/dev/null | wc -l)
        BUG_COUNT=$((BUG_COUNT + count))
    fi
done
if [ "$BUG_COUNT" -gt 0 ]; then
    echo "Open bugs: $BUG_COUNT"
fi

# Code health quick check
if [ -d "src" ]; then
    TODO_COUNT=$(grep -r "TODO" src/ 2>/dev/null | wc -l)
    FIXME_COUNT=$(grep -r "FIXME" src/ 2>/dev/null | wc -l)
    if [ "$TODO_COUNT" -gt 0 ] || [ "$FIXME_COUNT" -gt 0 ]; then
        echo ""
        echo "Code health: ${TODO_COUNT} TODOs, ${FIXME_COUNT} FIXMEs in src/"
    fi
fi

# --- Active session state recovery ---
STATE_FILE="production/session-state/active.md"
if [ -f "$STATE_FILE" ]; then
    echo ""
    echo "=== ACTIVE SESSION STATE DETECTED ==="
    echo "A previous session left state at: $STATE_FILE"
    echo "Read this file to recover context and continue where you left off."
    echo ""
    echo "Quick summary (last 20 lines):"
    tail -20 "$STATE_FILE" 2>/dev/null
    TOTAL_LINES=$(wc -l < "$STATE_FILE" 2>/dev/null)
    if [ "$TOTAL_LINES" -gt 20 ]; then
        echo "  ... ($TOTAL_LINES total lines — read the full file to continue)"
    fi
    echo "=== END SESSION STATE PREVIEW ==="
fi

echo "==================================="
exit 0
