#!/bin/bash

COMMIT_MSG_FILE=$1
BRANCH=$(git rev-parse --abbrev-ref HEAD)
TICKET=$(echo "$BRANCH" | grep -oP 'WHISPR-\d+' || echo "")

if [ ! -z "$TICKET" ] && ! grep -q "$TICKET" "$COMMIT_MSG_FILE"; then
  echo "" >> "$COMMIT_MSG_FILE"
  echo "$TICKET" >> "$COMMIT_MSG_FILE"
fi

