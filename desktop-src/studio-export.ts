import engineSource from '../assets/studio-engine.ts?raw';
import {validateSoundTheme,type SoundTheme} from '../assets/studio-engine';
export function serializeTheme(theme:SoundTheme):string{return JSON.stringify(validateSoundTheme(theme),null,2)+'\n';}
export function parseTheme(json:string):SoundTheme {
 if(typeof json!=='string'||json.length>512_000)throw Error('Theme exceeds 512 KB');
 return validateSoundTheme(JSON.parse(json));
}
export function compileStudioRuntime(theme:SoundTheme):string {
 const valid=validateSoundTheme(theme),json=JSON.stringify(valid).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
 const source=engineSource.replace(/\r\n?/g,'\n');
 return source+'\n\n// Portable theme. Call sonic.enable() and sonic.setMuted(false) from a user gesture.\n'+
  `export const SOUND_THEME = validateSoundTheme(${json});\n`+
  'export const soundEngine = new SoundStudioEngine(SOUND_THEME);\n'+
  'export const sonic = {enable:()=>soundEngine.enable(), setMuted:(value:boolean)=>soundEngine.setMuted(value), stopAll:()=>soundEngine.stopAll(), dispose:()=>soundEngine.dispose(),\n'+
  Object.keys(valid.events).map(key=>`  ${key}:()=>soundEngine.trigger(${JSON.stringify(key)}),`).join('\n')+
  '\n};\nexport const useSonicUI = () => sonic;\n';
}
