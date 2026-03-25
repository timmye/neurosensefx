#!/bin/bash
# Wrapper for prompt_engineer skill
cd "$(dirname "$0")/../.." || exit 1
PYTHONPATH=. python3 -m skills.prompt_engineer.optimize "$@"
