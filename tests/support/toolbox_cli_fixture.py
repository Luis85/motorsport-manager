"""Run the actual CLI against a child-process transport fixture on every supported OS."""

import os
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
import toolbox
from test_toolbox_client import project_fixture

if __name__ == "__main__":
    with patch.object(toolbox, "ToolProject", project_fixture(os.environ["TOOLBOX_FIXTURE_MODE"])):
        raise SystemExit(toolbox.main())
