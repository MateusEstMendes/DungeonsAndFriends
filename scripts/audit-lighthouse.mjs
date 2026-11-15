import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
mkdirSync('.local', {recursive:true});
const host=spawn(process.execPath,['--import','./apps/server/node_modules/tsx/dist/loader.mjs','apps/server/scripts/board-e2e-host.ts'],{stdio:'ignore'});
try {
  let ready=false;
  for(let i=0;i<150;i++){ try { ready=(await fetch('http://127.0.0.1:4179/health')).ok; }catch{} if(ready)break; await new Promise(r=>setTimeout(r,200)); }
  if(!ready)throw new Error('Audit host did not start. Ensure port 4179 is available.');
  const audit=spawn(process.execPath,['node_modules/lighthouse/cli/index.js','http://127.0.0.1:4179','--chrome-flags=--headless --no-sandbox','--output=json','--output-path=.local/lighthouse-phase6.json','--quiet'],{stdio:'inherit',env:{...process.env,CHROME_PATH:process.env.CHROME_PATH||chromium.executablePath()}});
  const [code]=await once(audit,'exit'); if(code!==0)throw new Error('Lighthouse failed');
  const report=JSON.parse(readFileSync('.local/lighthouse-phase6.json','utf8'));
  console.log(Object.fromEntries(Object.entries(report.categories).map(([key,value])=>[key,value.score])));
  if(report.categories.performance.score<0.9)process.exitCode=1;
} finally { host.kill('SIGTERM'); }
