#!/bin/bash
# generate-sample-manifest.sh - Regenerate sample routine manifest from .mcyc files
# Scans examples/sample-routines/ for .mcyc files, extracts title + emoji,
# and writes manifest.json used by the Create New Routine dialog.
#
# Usage:
#   npm run samples                           # From web/ directory
#   ./scripts/generate-sample-manifest.sh     # Direct execution

set -euo pipefail

SAMPLES_DIR="examples/sample-routines"

if [ ! -d "$SAMPLES_DIR" ]; then
    echo "❌ $SAMPLES_DIR directory not found"
    echo "   Run from the web/ directory"
    exit 1
fi

python3 -c "
import json, os, glob, unicodedata

def is_emoji_char(c):
    return unicodedata.category(c) == 'So' or c in '\uFE0F\u200D' or ord(c) > 0x1F000

def extract_emoji_and_name(title):
    title = title.strip()
    # Try leading emoji
    i = 0
    while i < len(title) and is_emoji_char(title[i]):
        i += 1
    if i > 0:
        return title[:i].rstrip(), title[i:].strip()
    # Try trailing emoji
    j = len(title) - 1
    while j >= 0 and is_emoji_char(title[j]):
        j -= 1
    if j < len(title) - 1:
        return title[j+1:].lstrip(), title[:j+1].strip()
    return '\U0001F4CB', title

samples_dir = '$SAMPLES_DIR'
manifest = []
for f in sorted(glob.glob(os.path.join(samples_dir, '*.mcyc'))):
    with open(f) as fh:
        data = json.load(fh)
    title = data.get('title', os.path.basename(f).replace('.mcyc', '').replace('_', ' '))
    emoji, name = extract_emoji_and_name(title)
    manifest.append({'file': os.path.basename(f), 'name': name, 'emoji': emoji})

with open(os.path.join(samples_dir, 'manifest.json'), 'w') as fh:
    json.dump(manifest, fh, indent=2, ensure_ascii=False)
    fh.write('\n')

for s in manifest:
    print(f'  {s[\"emoji\"]} {s[\"name\"]}')
print(f'✅ Generated manifest.json ({len(manifest)} samples)')
"
