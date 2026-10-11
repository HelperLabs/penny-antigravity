import {writeFileSync} from 'node:fs';
import {MEMORY_GUIDANCE} from '../src/memory_guidance.mjs';
if (/["'\\$`\r\n]/.test(MEMORY_GUIDANCE)) throw new Error('Unsafe static hook text');
const command=`node -e "process.stdin.resume();process.stdout.write(JSON.stringify({injectSteps:[{ephemeralMessage:'${MEMORY_GUIDANCE}'}]}))"`;
writeFileSync('hooks.json',JSON.stringify({penny:{PreInvocation:[{type:'command',command,timeout:5}]}},null,2)+'\n');
