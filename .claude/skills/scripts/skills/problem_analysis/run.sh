#!/bin/bash
# Wrapper for problem_analysis skill
cd "$(dirname "$0")/../.." || exit 1
PYTHONPATH=. python3 -m skills.problem_analysis.analyze "$@"
