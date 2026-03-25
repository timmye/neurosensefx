#!/bin/bash
# Wrapper for planner executor
cd "$(dirname "$0")/../.." || exit 1
PYTHONPATH=. python3 -m skills.planner.executor "$@"
