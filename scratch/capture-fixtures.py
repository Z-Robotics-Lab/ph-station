#!/usr/bin/env python3
"""Regenerate scratch/fixtures.json from a live physical-harness checkout.

Runs the same board CLI face the dsh-ph-board bridge spawns
(`python -m board.storecli <fn> <name> --runs <runs>`) and bundles the
verbatim payloads the scratch page serves as mock fetch results.

    python3 scratch/capture-fixtures.py /path/to/physical-harness

Trims for fixture size: sessions/stores keep a named subset, rounds keep the
newest ROUNDS_KEEP entries. Everything else is verbatim.
"""
import json
import subprocess
import sys
from pathlib import Path

SESSIONS_KEEP = ['session-main', 'grasp-cube-g1', 'clear-build-g1']
STORES_KEEP = ['grasp-cube-g1', 'place-g2', 'stack-g1', 'clear-build-g1']
ROUNDS_KEEP = 12

def main() -> None:
    repo = Path(sys.argv[1] if len(sys.argv) > 1 else '../physical-harness').resolve()

    def board(fn: str, name: str | None = None):
        args = [sys.executable, '-m', 'board.storecli', fn]
        if name is not None:
            args.append(name)
        args += ['--runs', 'runs']
        # parse_constant: board floats can be NaN/Infinity — invalid JSON; fold to null.
        return json.loads(subprocess.run(args, cwd=repo, check=True, capture_output=True).stdout,
                          parse_constant=lambda _c: None)

    out = {
        'sessions': [s for s in board('sessions') if s.get('name') in SESSIONS_KEEP],
        'session': {n: board('session', n) for n in SESSIONS_KEEP},
        'sessionProgress': {'session-main': board('session_progress', 'session-main')},
        'runtimeStatus': {'session-main': board('runtime_status', 'session-main')},
        'runtimeEvents': {'session-main': board('runtime_events', 'session-main')},
        'vault': board('vault'),
        'stores': [s for s in board('list_stores') if s.get('name') in STORES_KEEP],
        'store': {n: board('store', n) for n in STORES_KEEP},
        'heldout': {n: board('heldout', n) for n in STORES_KEEP},
        'cards': board('cards'),
        'rounds': board('rounds')[:ROUNDS_KEEP],
        'ledger': board('ledger'),
    }
    dest = Path(__file__).parent / 'fixtures.json'
    dest.write_text(json.dumps(out, ensure_ascii=False) + '\n')
    print(f'{dest}: {dest.stat().st_size} bytes')

if __name__ == '__main__':
    main()
