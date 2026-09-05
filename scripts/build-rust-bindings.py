#!/usr/bin/env python3
"""Build the same dependency-free Rust core for native Python and JS wasm."""
from pathlib import Path
import os
import shutil
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
subprocess.run(["cargo", "build", "--offline", "--release"], cwd=root, check=True)
subprocess.run(["cargo", "build", "--offline", "--release", "--target", "wasm32-unknown-unknown"], cwd=root, check=True)
target = Path(os.environ.get("CARGO_TARGET_DIR", root / "target"))
if not target.is_absolute():
    target = root / target
native_name = "libacausal.dylib" if sys.platform == "darwin" else "acausal.dll" if sys.platform == "win32" else "libacausal.so"
native = root / "bindings" / "python" / "acausal" / "_native"
native.mkdir(parents=True, exist_ok=True)
javascript = root / "bindings" / "javascript"
javascript.mkdir(parents=True, exist_ok=True)
shutil.copyfile(target / "release" / native_name, native / native_name)
shutil.copyfile(target / "wasm32-unknown-unknown" / "release" / "acausal.wasm", javascript / "acausal.wasm")
print(f"Built native library and wasm: {native / native_name}, {javascript / 'acausal.wasm'}")
