"""Print the OpenAPI schema (stable key order) for packages/api-client generation."""

import json
import sys

from services.gateway.app import app

if __name__ == "__main__":
    sys.stdout.write(json.dumps(app.openapi(), indent=2, sort_keys=True, ensure_ascii=False) + "\n")
