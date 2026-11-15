import { it, expect } from 'vitest';
import { fork } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { openDatabase } from '../src/db/index.js';
import { characters } from '../src/db/schema.js';
import { detectInterruptedSession } from '../src/services/crashRecoveryService.js';
import { CombatHandler } from '../src/rooms/handlers/combat.js';
import { RoomState } from '@df/shared';
it('survives a real SIGKILL with committed combat budget and character resources intact', async () => {
  const dir=mkdtempSync(join(tmpdir(),'df-crash-')), path=join(dir,'game.db');
  const child=fork(resolve('apps/server/tests/fixtures/crash-worker.ts'),[path],{ execArgv:['--import',resolve('apps/server/node_modules/tsx/dist/loader.mjs')], stdio:['ignore','ignore','pipe','ipc'] });
  let errors=''; child.stderr?.on('data', data=> errors+=data);
  try {
    const before:any=await new Promise((accept,reject)=> { const timer=setTimeout(()=>reject(new Error('Crash fixture timed out: '+errors)),15000); child.once('message',m=>{clearTimeout(timer);accept(m);}); child.once('error',e=>{clearTimeout(timer);reject(e);}); child.once('exit',()=>{clearTimeout(timer);reject(new Error(errors));}); });
    const exited=once(child,'exit'); child.kill('SIGKILL'); await exited;
    const db=openDatabase(path);
    try {
      expect(detectInterruptedSession(db,before.roomId)).toMatchObject({inCombat:true});
      expect(db.db.select().from(characters).all()).toEqual(before.characters);
      const state=new RoomState(), combat=new CombatHandler(state,db,before.roomId,()=>{},()=>{}); combat.restore();
      expect(state.combatState.toJSON()).toMatchObject({ turnToken:before.combat.turnToken, actionIndex:1, remainingActions:1, turnOrder:before.combat.turnOrder });
      expect(combat.snapshot().participants.filter(p=>p.kind==='PLAYER')).toHaveLength(2);
      const resources=(list:any[])=>Object.fromEntries(list.map(p=>[p.id,{hp:p.hp,mp:p.mp}]));
      expect(resources(combat.snapshot().participants)).toEqual(resources(before.participants));
      expect(before.participants.some((p:any)=>p.kind==='PLAYER' && p.mp<p.maxMp)).toBe(true);
      expect(before.participants.some((p:any)=>p.kind==='MONSTER' && p.hp<p.maxHp)).toBe(true);
      expect(db.sqlite.pragma('integrity_check')).toEqual([{integrity_check:'ok'}]);
    } finally { db.close(); }
  } finally { child.kill('SIGKILL'); rmSync(dir,{recursive:true,force:true}); }
},20000);
