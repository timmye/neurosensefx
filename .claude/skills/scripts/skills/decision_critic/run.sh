#!/bin/bash
# Wrapper for decision_critic skill
cd "$(dirname "$0")/../.." || exit 1
PYTHONPATH=. python3 -m skills.decision_critic.decision_critic "$@"
