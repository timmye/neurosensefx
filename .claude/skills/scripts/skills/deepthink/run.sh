#!/bin/bash
# Wrapper for deepthink skill
cd "$(dirname "$0")/../.." || exit 1
PYTHONPATH=. python3 -m skills.deepthink.think "$@"
