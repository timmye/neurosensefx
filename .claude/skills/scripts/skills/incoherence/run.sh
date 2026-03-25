#!/bin/bash
# Wrapper for incoherence skill
cd "$(dirname "$0")/../.." || exit 1
PYTHONPATH=. python3 -m skills.incoherence.incoherence "$@"
