#!/bin/bash

if [ $# -lt 2 ]; then
  echo "Usage: ./scripts/create-branch.sh <ticket-number> <description>"
  echo "Example: ./scripts/create-branch.sh 123 add new feature"
  exit 1
fi

TICKET_NUMBER=$1
shift
DESCRIPTION=$(echo "$@" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')

BRANCH_NAME="WHISPR-${TICKET_NUMBER}-${DESCRIPTION}"

git checkout -b "$BRANCH_NAME"
echo "✅ Created branch: $BRANCH_NAME"

