# skills package - workflow orchestration framework and skill implementations

import sys
from pathlib import Path

# Add scripts directory to Python path for module discovery
# This ensures skills can import from skills.lib.* when invoked as modules
_scripts_dir = Path(__file__).resolve().parent
if str(_scripts_dir) not in sys.path:
    sys.path.insert(0, str(_scripts_dir))
