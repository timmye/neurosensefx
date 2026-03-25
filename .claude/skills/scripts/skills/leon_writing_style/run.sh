#!/usr/bin/env bash
# Wrapper for leon_writing_style skill
cd "$(dirname "$0")/../.." || exit 1
PYTHONPATH=. python3 -m skills.leon_writing_style.writing_style "$@"
