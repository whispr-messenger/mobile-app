#!/bin/bash

BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [[ "$BRANCH" == "main" ]] || [[ "$BRANCH" == "master" ]] || [[ "$BRANCH" == "develop" ]]; then
  exit 0
fi

if [[ ! "$BRANCH" =~ ^WHISPR-[0-9]+-[a-z0-9-]+$ ]]; then
  echo "❌ Branch name '$BRANCH' does not follow the convention!"
  echo ""
  echo "✅ Expected format: WHISPR-<number>-<description-kebab-case>"
  echo ""
  echo "Examples:"
  echo "  - WHISPR-123-add-user-authentication"
  echo "  - WHISPR-456-fix-payment-gateway"
  echo "  - WHISPR-789-update-api-documentation"
  echo ""
  exit 1
fi

echo "✅ Branch name is valid: $BRANCH"
exit 0

