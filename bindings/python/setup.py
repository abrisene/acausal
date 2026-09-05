"""Build the Python package with a platform tag for its bundled native ABI.

The package contains Python code plus a platform-specific ctypes library. The
normal setuptools heuristic sees no compiled extension and would therefore
publish a misleading ``py3-none-any`` wheel. This command derives the wheel
platform from the bundled library and validates the library before packaging.
"""

from __future__ import annotations

import platform
import re
import shutil
import subprocess
import sys
from pathlib import Path

from setuptools import setup
from wheel.bdist_wheel import bdist_wheel as _bdist_wheel


ROOT = Path(__file__).resolve().parent
NATIVE = ROOT / "acausal" / "_native"


def _tool_output(command: list[str], label: str) -> str:
    executable = shutil.which(command[0])
    if executable is None:
        raise RuntimeError(f"cannot validate bundled acausal binary: {label} is unavailable")
    result = subprocess.run(
        [executable, *command[1:]],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()
        raise RuntimeError(f"cannot validate bundled acausal binary with {label}: {detail}")
    return result.stdout


def _native_path() -> Path:
    if sys.platform == "darwin":
        names = ("libacausal.dylib", "acausal.dylib")
    elif sys.platform.startswith("linux"):
        names = ("libacausal.so", "acausal.so")
    elif sys.platform == "win32":
        names = ("acausal.dll", "libacausal.dll")
    else:
        raise RuntimeError(f"unsupported host platform for the bundled acausal ABI: {sys.platform}")
    for name in names:
        path = NATIVE / name
        if path.is_file():
            return path
    expected = ", ".join(str(NATIVE / name) for name in names)
    raise RuntimeError(f"bundled acausal native library is missing; expected one of: {expected}")


def _macos_platform(path: Path) -> str:
    machine = platform.machine().lower()
    arch = {"arm64": "arm64", "aarch64": "arm64", "x86_64": "x86_64", "amd64": "x86_64"}.get(machine)
    if arch is None:
        raise RuntimeError(f"unsupported macOS architecture for acausal binary: {machine}")
    description = _tool_output(["file", str(path)], "file")
    if arch not in description.lower():
        raise RuntimeError(
            f"bundled acausal binary architecture does not match Python ({arch}): {description.strip()}"
        )
    load_commands = _tool_output(["otool", "-l", str(path)], "otool")
    match = re.search(r"\bminos\s+(\d+)\.(\d+)", load_commands)
    if match is None:
        match = re.search(r"version\s+(\d+)\.(\d+)", load_commands)
    if match is None:
        raise RuntimeError(f"cannot find the bundled acausal binary minimum macOS version: {path}")
    major, minor = int(match.group(1)), int(match.group(2))
    if (major, minor) < (11, 0):
        raise RuntimeError(f"bundled acausal binary requires unsupported macOS {major}.{minor}; minimum is 11.0")
    return f"macosx-{major}.{minor}-{arch}"


def _other_platform(path: Path) -> str:
    machine = platform.machine().lower()
    if sys.platform.startswith("linux"):
        arch = {"x86_64": "x86_64", "amd64": "x86_64", "aarch64": "aarch64", "arm64": "aarch64"}.get(machine)
        if arch is None:
            raise RuntimeError(f"unsupported Linux architecture for acausal binary: {machine}")
        description = _tool_output(["file", str(path)], "file").lower()
        tokens = {"x86_64": ("x86-64", "x86_64"), "aarch64": ("aarch64", "arm64")}[arch]
        if not any(token in description for token in tokens):
            raise RuntimeError(f"bundled acausal binary architecture does not match Python ({arch}): {description.strip()}")
        return f"linux-{arch}"
    machine_tag = {"amd64": "amd64", "x86_64": "amd64", "arm64": "arm64"}.get(machine)
    if machine_tag is None:
        raise RuntimeError(f"unsupported Windows architecture for acausal binary: {machine}")
    return f"win-{machine_tag}"


def native_platform_tag() -> str:
    path = _native_path()
    return _macos_platform(path) if sys.platform == "darwin" else _other_platform(path)


class PlatformWheel(_bdist_wheel):
    """Emit a platform wheel while retaining the stable Python 3 ABI tag."""

    def finalize_options(self) -> None:
        super().finalize_options()
        self.root_is_pure = False
        self.plat_name = native_platform_tag()

    def get_tag(self) -> tuple[str, str, str]:
        # ctypes loads the native library at runtime; no CPython ABI is used.
        return ("py3", "none", self.plat_name.lower().replace("-", "_").replace(".", "_"))


setup(cmdclass={"bdist_wheel": PlatformWheel})
