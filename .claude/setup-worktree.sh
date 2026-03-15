#!/usr/bin/env bash
# Setup script for Claude Code worktrees.
# Runs automatically via the UserPromptSubmit hook in .claude/settings.json.
# Copies .env and node_modules from the main worktree if they don't already exist.

# Find the root (main) worktree path
root=$(git worktree list | head -1 | awk '{print $1}')

# Copy .env from root if not already present
if [ ! -f .env ]; then
  cp "$root/.env" .env 2>/dev/null
fi

# Copy node_modules from root if not already present, then rebuild
if [ ! -d node_modules ]; then
  cp -a "$root/node_modules" . 2>/dev/null && npm run build
fi
