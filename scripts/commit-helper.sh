#!/bin/bash

echo "🎨 Git Commit Helper - Whispr Project"
echo "======================================"
echo ""

echo "Select commit type:"
echo "1) ✨ feat     - New feature"
echo "2) 🐛 fix      - Bug fix"
echo "3) 📝 docs     - Documentation"
echo "4) 🎨 style    - Code style"
echo "5) ♻️  refactor - Refactoring"
echo "6) ⚡️ perf     - Performance"
echo "7) ✅ test     - Tests"
echo "8) 🔧 chore    - Configuration"

read -p "Choose (1-8): " choice

case $choice in
  1) EMOJI="✨"; TYPE="feat";;
  2) EMOJI="🐛"; TYPE="fix";;
  3) EMOJI="📝"; TYPE="docs";;
  4) EMOJI="🎨"; TYPE="style";;
  5) EMOJI="♻️"; TYPE="refactor";;
  6) EMOJI="⚡️"; TYPE="perf";;
  7) EMOJI="✅"; TYPE="test";;
  8) EMOJI="🔧"; TYPE="chore";;
  *) echo "Invalid choice"; exit 1;;
esac

read -p "Scope (mobile, auth, ui, etc.): " SCOPE
read -p "Short description: " DESCRIPTION

BRANCH=$(git rev-parse --abbrev-ref HEAD)
TICKET=$(echo "$BRANCH" | grep -oP 'WHISPR-\d+' || echo "")

MESSAGE="$EMOJI $TYPE($SCOPE): $DESCRIPTION"

if [ ! -z "$TICKET" ]; then
  MESSAGE="$MESSAGE

$TICKET"
fi

echo ""
echo "Commit message:"
echo "$MESSAGE"
echo ""
read -p "Proceed with commit? (y/n): " confirm

if [ "$confirm" = "y" ]; then
  git commit -m "$MESSAGE"
  echo "✅ Commit created successfully!"
else
  echo "❌ Commit cancelled"
fi

