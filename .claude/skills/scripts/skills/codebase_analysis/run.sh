#!/bin/bash
# Wrapper for codebase_analysis skill
cd "$(dirname "$0")/../.." || exit 1
PYTHONPATH=. python3 -m skills.codebase_analysis.analyze "$@"
