import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('evidence/workspace-upgrade',{recursive:true});
await build({stdin:{contents:`import * as engine from './assets/studio-engine';import * as compose from './desktop-src/compose-model';import * as draftLevel from './desktop-src/studio-draft-level';import {renderCompositionWav} from './desktop-src/compose-export';window.studioOracle={...engine,...compose,...draftLevel,renderCompositionWav};`,resolveDir:process.cwd()},bundle:true,format:'iife',platform:'browser',outfile:'evidence/workspace-upgrade/oracle.js'});
