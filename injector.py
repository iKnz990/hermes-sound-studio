"""Conservative TypeScript AST edit planning with hash-bound opt-in application."""
from __future__ import annotations
import difflib
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import uuid

EXCLUDES = {'.git', 'node_modules', '.next', 'dist', 'build', 'coverage', '.sonic-ui-backups'}
MAX_FILES = 20
MAX_SCAN = 100
MAX_BYTES = 256_000
ROOT = Path(__file__).resolve().parent


def _digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _checked(root: Path, relative: str) -> Path:
    if not isinstance(relative, str) or not relative or '\\' in relative or any(part in ('', '.', '..') for part in relative.split('/')) or Path(relative).is_absolute():
        raise ValueError('invalid relative path')
    path = root.joinpath(*relative.split('/'))

    for candidate in (path, *path.parents):
        if candidate == root.parent:
            break
        if candidate.is_symlink() or (hasattr(candidate, 'is_junction') and candidate.is_junction()):
            raise ValueError('symlink/junction path rejected')
    if not path.resolve().is_relative_to(root.resolve()):
        raise ValueError('path escapes project')
    return path


def _scan(root: Path, target: Path | None) -> list[str]:
    if target:
        if target.suffix.lower() not in ('.tsx', '.jsx'):
            raise ValueError('only .tsx/.jsx files supported; Vue/Svelte unsupported')
        rel = target.relative_to(root).as_posix()
        _checked(root, rel)
        return [rel]
    candidates = []
    for folder, dirs, files in os.walk(root, followlinks=False):
        dirs[:] = [d for d in dirs if d not in EXCLUDES and not (Path(folder) / d).is_symlink() and not (hasattr(Path(folder) / d, 'is_junction') and (Path(folder) / d).is_junction())]
        for name in sorted(files):
            if name.endswith(('.tsx', '.jsx')) and not name.endswith(('.test.tsx', '.spec.tsx')):
                rel = (Path(folder) / name).relative_to(root).as_posix()
                if not (Path(folder) / name).is_symlink():
                    candidates.append(rel)
                    if len(candidates) > MAX_SCAN:
                        raise ValueError('scan exceeds 100 JSX files; specify a file')
    return sorted(candidates)


def _transform(root: Path, relative: str, source: bytes, module: str) -> tuple[bytes, list[str]]:
    node = ROOT / 'dist' / 'injector.cjs'
    if not node.is_file():
        node = ROOT / 'injector-src' / 'injector.cjs'
    import_posix = os.path.relpath(root / module, (root / relative).parent).replace('\\', '/')
    import_posix = re.sub(r'\.tsx?$', '', import_posix)
    if not import_posix.startswith('.'):
        import_posix = './' + import_posix
    if not re.fullmatch(r'(?:\./|(?:\.\./)+)[A-Za-z0-9_./-]{1,150}', import_posix) or '..' in import_posix.replace('../', '').split('/'):
        raise ValueError('invalid generated import path')
    text = source.decode('utf-8')
    next_project = any((root / ('next.config.' + suffix)).exists() for suffix in ('js', 'mjs', 'ts', 'cjs'))
    if not next_project:
        package = root / 'package.json'
        if package.is_file() and package.stat().st_size < 100_000:
            try:
                manifest = json.loads(package.read_text(encoding='utf-8'))
                next_project = 'next' in manifest.get('dependencies', {}) or 'next' in manifest.get('devDependencies', {})
            except (ValueError, OSError, TypeError):
                pass
    request = json.dumps({'source': text, 'filePath': relative, 'importPath': import_posix, 'requireClient': next_project})
    try:
        proc = subprocess.run(['node', str(node)], input=request, capture_output=True, text=True, timeout=8, encoding='utf-8')
    except (subprocess.TimeoutExpired, OSError) as exc:
        raise ValueError(f'AST parser unavailable: {type(exc).__name__}') from exc
    if proc.returncode or len(proc.stdout) > MAX_BYTES * 3:
        raise ValueError('AST parser rejected input: ' + proc.stderr[:200])
    result = json.loads(proc.stdout)
    edits = result['edits']
    if len(edits) > 100 or not isinstance(result['skipped'], list):
        raise ValueError('invalid AST edit plan')
    # TypeScript offsets use UTF-16 code units. Refuse non-BMP sources rather than silently shifting edits.
    if any(ord(c) > 0xFFFF for c in text) and edits:
        raise ValueError('non-BMP JSX requires UTF-16 offset conversion; refused')
    last = len(text) + 1
    for edit in sorted(edits, key=lambda e: (e['start'], e['end']), reverse=True):
        start, end = edit['start'], edit['end']
        if type(start) is not int or type(end) is not int or not 0 <= start <= end <= len(text) or end > last or len(edit['text']) > 2000:
            raise ValueError('overlapping or invalid AST offsets')
        text = text[:start] + edit['text'] + text[end:]
        last = start
    return text.encode('utf-8'), result['skipped']


def plan_injection(project_root: str | Path, target: str | Path | None = None, *, module: str = 'src/sonic-ui.ts', max_files: int = MAX_FILES) -> dict:
    root = Path(project_root).absolute()
    if not root.is_dir() or root.is_symlink() or (hasattr(root, 'is_junction') and root.is_junction()):
        raise ValueError('project_root must be an existing absolute real directory')
    if not Path(project_root).is_absolute():
        raise ValueError('project_root must be absolute (gateway cwd is not used)')
    if type(max_files) is not int or not 1 <= max_files <= MAX_FILES:
        raise ValueError('max_files must be 1..20')
    if not isinstance(module, str) or not re.fullmatch(r'[A-Za-z0-9_/-]{1,120}\.tsx?', module) or '..' in module.split('/') or module.startswith('/'):
        raise ValueError('module must be a simple project-relative TS path')
    module_path = _checked(root, module)
    if module_path.exists() and (not module_path.is_file() or module_path.stat().st_size > 512_000):
        raise ValueError('generated TypeScript module must be a real file <=512KB')
    module_sha256 = _digest(module_path.read_bytes()) if module_path.is_file() else None
    selected = Path(target).absolute() if target is not None else None
    if selected and (not Path(target).is_absolute() or not selected.is_relative_to(root)):
        raise ValueError('target must be an absolute contained path')
    entries, skipped = [], []
    for relative in _scan(root, selected):
        path = _checked(root, relative)
        if not path.is_file():
            raise ValueError('target is not a file')
        if path.stat().st_size > MAX_BYTES:
            skipped.append({'path': relative, 'reason': 'oversize'})
            continue
        before = path.read_bytes()
        after, reasons = _transform(root, relative, before, module)
        skipped.extend({'path': relative, 'reason': reason} for reason in reasons)
        if after != before:
            if len(after) > MAX_BYTES:
                raise ValueError('transformed file too large')
            if len(entries) >= max_files:
                raise ValueError('would change more than max_files')
            diff = ''.join(difflib.unified_diff(before.decode('utf-8').splitlines(True), after.decode('utf-8').splitlines(True), fromfile=relative, tofile=relative))
            entries.append({'path': relative, 'sha256': _digest(before), 'output_sha256': _digest(after), 'diff': diff})
    receipt = {'root': str(root), 'target': selected.relative_to(root).as_posix() if selected else None,
               'module': module, 'module_sha256': module_sha256,
               'max_files': max_files, 'files': entries, 'skipped': skipped}
    receipt['plan_sha256'] = _digest(json.dumps(receipt, sort_keys=True, ensure_ascii=True).encode())
    return receipt


def apply_injection(project_root: str | Path, plan: dict) -> dict:
    """Replan and compare complete receipt before writes; backups retained under root."""
    if not isinstance(plan, dict) or not isinstance(plan.get('files'), list) or not plan['files']:
        raise ValueError('explicit nonempty hash-bound plan required')
    root = Path(project_root).absolute()
    if not Path(project_root).is_absolute() or plan.get('root') != str(root):
        raise ValueError('root mismatch')
    if not isinstance(plan.get('module_sha256'), str):
        raise ValueError('generate the TypeScript module and make a fresh plan before apply')
    if len(plan['files']) > MAX_FILES or len({f['path'] for f in plan['files']}) != len(plan['files']):
        raise ValueError('invalid file plan')
    target = _checked(root, plan['target']) if plan.get('target') is not None else None
    full = plan_injection(root, target, module=plan['module'], max_files=plan['max_files'])
    if full != plan:
        raise ValueError('source or plan changed since dry-run; no files written')
    prepared = []
    for entry in plan['files']:
        path = _checked(root, entry['path'])
        before = path.read_bytes()
        if _digest(before) != entry['sha256']:
            raise ValueError('input changed before write')
        after, _ = _transform(root, entry['path'], before, plan['module'])
        if _digest(after) != entry['output_sha256']:
            raise ValueError('output changed before write')
        prepared.append((path, before, after))
    backups = root / '.sonic-ui-backups'
    if backups.exists() and (not backups.is_dir() or backups.is_symlink() or (hasattr(backups, 'is_junction') and backups.is_junction())):
        raise ValueError('unsafe backup directory')
    backups.mkdir(exist_ok=True)
    written = []
    try:
        for path, before, after in prepared:
            module_path = _checked(root, plan['module'])
            if not module_path.is_file() or _digest(module_path.read_bytes()) != plan['module_sha256']:
                raise ValueError('generated module changed during apply')
            path = _checked(root, path.relative_to(root).as_posix())
            if path.read_bytes() != before:
                raise ValueError('source changed during apply')
            backup = backups / f'{uuid.uuid4().hex}.bak'
            with backup.open('xb') as f:
                f.write(before)
                f.flush()
                os.fsync(f.fileno())
            temporary = None
            try:
                with tempfile.NamedTemporaryFile(mode='wb', dir=path.parent, prefix='.sonic-', suffix='.tmp', delete=False) as f:
                    temporary = Path(f.name)
                    f.write(after)
                    f.flush()
                    os.fsync(f.fileno())
                os.chmod(temporary, path.stat().st_mode)
                if path.read_bytes() != before:
                    raise ValueError('source changed before replace')
                os.replace(temporary, path)
                written.append((path, before, after))
            finally:
                if temporary is not None:
                    temporary.unlink(missing_ok=True)
        return {'ok': True, 'files': [{'path': p.relative_to(root).as_posix(), 'sha256': _digest(after)} for p, _, after in written], 'backups': str(backups)}
    except Exception:
        for path, before, after in reversed(written):
            if path.read_bytes() == after:
                with tempfile.NamedTemporaryFile(mode='wb', dir=path.parent, prefix='.sonic-rollback-', delete=False) as f:
                    temp = Path(f.name)
                    f.write(before)
                    f.flush()
                    os.fsync(f.fileno())
                os.replace(temp, path)
        raise
