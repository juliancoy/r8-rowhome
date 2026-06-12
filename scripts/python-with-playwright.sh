#!/bin/sh
# Runs the given Python script with the first local interpreter that has
# Playwright installed. Keeps npm scripts working regardless of which python3
# is first on PATH (Homebrew vs CommandLineTools).
set -e

for candidate in python3 /Library/Developer/CommandLineTools/usr/bin/python3 /usr/bin/python3; do
  if command -v "$candidate" > /dev/null 2>&1 && "$candidate" -c "import playwright" > /dev/null 2>&1; then
    exec "$candidate" "$@"
  fi
done

echo "No local python3 with Playwright found. Install it with:" >&2
echo "  python3 -m pip install playwright && python3 -m playwright install chromium" >&2
exit 1
