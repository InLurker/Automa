#!/usr/bin/env bash
set -euo pipefail

TARGET_NAME="InLurker"
TARGET_EMAIL="82582556+inlurker@users.noreply.github.com"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required but not found in PATH" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  cat <<'EOF' >&2
Working tree has uncommitted changes.
Commit, stash, or clean the repository before rewriting history.
EOF
  exit 1
fi

cat <<EOF
Rewriting entire git history so every commit uses:
  Author/Committer: ${TARGET_NAME} <${TARGET_EMAIL}>

This operation is destructive and will rewrite all branches and tags.
Consider backing up the repository and coordinating with collaborators.
EOF

read -r -p "Continue? (type 'rewrite' to proceed): " confirm
if [[ "$confirm" != "rewrite" ]]; then
  echo "Aborted."
  exit 1
fi

git filter-branch \
  --env-filter "\
    export GIT_AUTHOR_NAME='${TARGET_NAME}'; \
    export GIT_AUTHOR_EMAIL='${TARGET_EMAIL}'; \
    export GIT_COMMITTER_NAME='${TARGET_NAME}'; \
    export GIT_COMMITTER_EMAIL='${TARGET_EMAIL}';\
  " \
  --tag-name-filter cat -- --branches --tags

cat <<'EOF'
Rewrite complete.
Force-push updated branches and tags to share the rewritten history:
  git push --force-with-lease --all
  git push --force --tags
EOF
