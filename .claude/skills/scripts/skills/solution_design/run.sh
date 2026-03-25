#!/bin/bash
# Wrapper for solution_design skill
cd "$(dirname "$0")/../.." || exit 1
PYTHONPATH=. python3 -m skills.solution_design.design "$@"
