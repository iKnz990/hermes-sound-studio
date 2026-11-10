import {readFile,writeFile} from 'node:fs/promises';
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){if(!['--repo','--sha','--maintainer'].includes(args[i])||!args[i+1])throw Error('Use --repo HTTPS_REPOSITORY --sha FULL_COMMIT --maintainer GITHUB_HANDLE');options[args[i].slice(2)]=args[i+1];}
const {repo,sha,maintainer}=options;
if(!/^https:\/\/(github\.com|gitlab\.com)\/[\w.-]+\/[\w.-]+\/?$/.test(repo??'')||/REPLACE|OWNER|PLACEHOLDER/i.test(repo))throw Error('A real public GitHub/GitLab repository URL is required.');
if(!/^[a-f0-9]{40}$/i.test(sha??''))throw Error('Pin the exact full 40-character public commit SHA.');
if(!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(maintainer??'')||/REPLACE|HANDLE/i.test(maintainer))throw Error('A real maintainer handle is required.');
const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const q=value=>JSON.stringify(value),normalized=repo.replace(/\/$/,'').replace(/\.git$/,'');
let yaml=`name: hermes-sonic-ui\ntitle: Hermes Sound Studio\nrepo: ${q(normalized)}\nsha: ${sha.toLowerCase()}\ndescription: Design procedural sounds, assign them to Hermes Desktop interactions, compose layered loops, and export WAV, JSON or TypeScript. Local synthesis; optional configured-model drafts.\nmaintainer: ${q(maintainer)}\ntier: community\ncategory: desktop\nversion: ${q(pkg.version)}\nrequires_hermes: ">=0.23.0"\nreadme: true\nplatforms: []\n`;
if(normalized.startsWith('https://github.com/')){const raw=normalized.replace('https://github.com/','https://raw.githubusercontent.com/')+'/'+sha.toLowerCase();yaml+=`image: ${q(raw+'/docs/images/banner.png')}\nscreenshots:\n  - ${q(raw+'/docs/images/sound-design.png')}\n  - ${q(raw+'/docs/images/compose.png')}\n  - ${q(raw+'/docs/images/fine-tune.png')}\n`;}
yaml+=`known_issues:\n  - Windows and Chromium are the tested desktop environment; other operating systems have not been verified.\n  - The separate native draft tool requires the native bridge and a configured default-profile model.\ncapabilities:\n  provides_tools:\n    - synthesize_ui_soundscape\n    - audit_ui_silence\n    - inject_sonic_hooks\n    - sonic_create_patch\n  provides_hooks: []\n  provides_middleware: []\n  requires_env: []\n`;
await writeFile(new URL('../submission/hermes-sonic-ui.yaml',import.meta.url),yaml);
console.log('Wrote submission/hermes-sonic-ui.yaml. Confirm the repository is public and validate the exact pinned commit before opening the catalog PR.');

