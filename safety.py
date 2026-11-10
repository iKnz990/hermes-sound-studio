"""Native write policy shared by the approval hook and file-writing handlers."""
from __future__ import annotations

import importlib
import os
from pathlib import Path


def _optional_host_module(name: str):
    try:
        return importlib.import_module(name)
    except ModuleNotFoundError as exc:
        # Standalone compiler/tests do not install Hermes. A broken host dependency
        # must not silently disable its policy when running inside Hermes.
        if exc.name not in (name, name.split('.')[0]):
            raise ValueError('Hermes file policy could not be loaded') from exc
        return None


def _protected_roots() -> list[Path]:
    roots = [Path(__file__).resolve().parent, Path.home() / '.hermes']
    if os.environ.get('LOCALAPPDATA'):
        roots.append(Path(os.environ['LOCALAPPDATA']) / 'hermes')
    for name in ('HERMES_HOME', 'HERMES_INSTALL_ROOT'):
        if os.environ.get(name):
            roots.append(Path(os.environ[name]).expanduser())
    host = _optional_host_module('hermes_constants')
    if host is not None:
        for name in ('get_hermes_home', 'get_default_hermes_root'):
            getter = getattr(host, name, None)
            if not callable(getter):
                raise ValueError('Hermes home policy is unavailable')
            roots.append(Path(getter()))
        # Protect the executing checkout as well as an explicit install override.
        roots.append(Path(host.__file__).resolve().parent)
    return roots


def external_write_path(value: str | Path) -> Path:
    """Reject host-denied paths and every path within Hermes home/install trees."""
    if not isinstance(value, (str, Path)):
        raise ValueError('file path must be an absolute local path')
    raw = str(value)
    if any(ord(char) < 32 for char in raw):
        raise ValueError('control characters are not allowed in file paths')
    # Refuse network/device namespaces before resolve can touch a remote share.
    if raw.startswith(('\\\\', '//', '\\??\\')):
        raise ValueError('network/device paths are not supported')
    path = Path(raw)
    if not path.is_absolute():
        raise ValueError('file path must be absolute')
    policy = _optional_host_module('agent.file_safety')
    if policy is None and _optional_host_module('hermes_constants') is not None:
        raise ValueError('Hermes write denylist is unavailable')
    if policy is not None:
        guard = getattr(policy, 'get_write_denied_error', None)
        if not callable(guard):
            raise ValueError('Hermes write denylist is unavailable')
        denial = guard(raw)
        if denial:
            raise ValueError(denial)
    lexical = path.absolute()
    resolved = path.resolve()
    for root in _protected_roots():
        if lexical.is_relative_to(root.absolute()) or resolved.is_relative_to(root.resolve()):
            raise ValueError('paths inside Hermes home or install are not allowed')
    return lexical
