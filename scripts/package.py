"""Allowlisted source/runtime archives; no installed-Hermes writes or network actions."""
from pathlib import Path
import argparse,hashlib,json,zipfile
ROOT=Path(__file__).resolve().parents[1]
RUNTIME=['__init__.py','compiler.py','injector.py','safety.py','synth_schema.py','studio_backend.py','studio_registration.py','plugin.yaml','README.md','INSTALL.md','CHANGELOG.md','LICENSE','THIRD_PARTY_NOTICES.md','desktop','dist','assets','dashboard','licenses','skills','docs','examples']
SOURCE=RUNTIME+['desktop-src','injector-src','tests','scripts','.github','package.json','package-lock.json','requirements-dev.txt','.gitignore']
EXCLUDE={'node_modules','__pycache__','.git','evidence','proof','delivery','.pytest_cache'}
RETIRED={'desktop-src/telemetry.ts','desktop-src/legacy-style.ts'}
def sha(data):return hashlib.sha256(data).hexdigest()
def members(roots):
    files=[]
    for name in roots:
        item=ROOT/name
        if not item.exists():raise RuntimeError(f'Missing distribution item: {name}')
        candidates=item.rglob('*') if item.is_dir() else [item]
        for path in candidates:
            relative=path.relative_to(ROOT)
            if relative.as_posix() in RETIRED:continue
            if any(part in EXCLUDE for part in relative.parts) or path.suffix in {'.pyc','.pyo'}:continue
            if path.is_symlink() or getattr(path,'is_junction',lambda:False)():raise RuntimeError(f'Linked source refused: {relative}')
            if path.is_file():
                data=path.read_bytes()
                if data.startswith((b'MZ',b'\x7fELF',b'\x00asm',b'\xfe\xed\xfa\xcf',b'\xcf\xfa\xed\xfe')):raise RuntimeError(f'Executable binary refused: {relative}')
                files.append((relative.as_posix(),data))
    return sorted(files)
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--out',default='delivery');args=parser.parse_args()
    out=Path(args.out).resolve();out.mkdir(parents=True,exist_ok=True)
    version=json.loads((ROOT/'package.json').read_text())['version'];archives=[]
    for kind,roots in [('runtime',RUNTIME),('source',SOURCE)]:
        files=members(roots);manifest={'package':'hermes-sonic-ui','version':version,'kind':kind,'files':[{'path':name,'bytes':len(data),'sha256':sha(data)} for name,data in files]}
        filename=out/f'hermes-sound-studio-{version}-{kind}.zip'
        with zipfile.ZipFile(filename,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
            for name,data in files:
                info=zipfile.ZipInfo('hermes-sonic-ui/'+name,(2026,11,9,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16;archive.writestr(info,data)
            archive.writestr('hermes-sonic-ui/MANIFEST.json',json.dumps(manifest,indent=2)+'\n')
        with zipfile.ZipFile(filename) as archive:
            assert archive.testzip() is None
            for name,data in files:assert archive.read('hermes-sonic-ui/'+name)==data
        archives.append({'file':filename.name,'bytes':filename.stat().st_size,'sha256':sha(filename.read_bytes()),'files':len(files)+1})
    (out/'checksums.json').write_text(json.dumps({'version':version,'archives':archives},indent=2)+'\n',encoding='utf-8')
    print(json.dumps(archives,indent=2))
if __name__=='__main__':main()
