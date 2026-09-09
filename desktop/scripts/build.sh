#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
exec python3 desktop/scripts/release.py build "$@"
