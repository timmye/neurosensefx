#!/bin/bash
# Wrapper for refactor skill
cd "$(dirname "$0")/../.." || exit 1
PYTHONPATH=. python3 -m skills.refactor.refactor "$@"
