#!/bin/bash
# Wrapper for planner skill
cd "$(dirname "$0")/../.." || exit 1
PYTHONPATH=. python3 -m skills.planner.planner "$@"
