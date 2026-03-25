#!/bin/bash
# Wrapper for arxiv_to_md skill
cd "$(dirname "$0")/../.." || exit 1
PYTHONPATH=. python3 -m skills.arxiv_to_md.main "$@"
