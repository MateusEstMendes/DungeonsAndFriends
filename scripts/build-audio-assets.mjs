// Original, deterministic procedural audio. No sampled or third-party music.
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
const rate = 44100, out = resolve('apps/client/public/audio');
mkdirSync(out, { recursive: true });
let seed = 12345;
const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; };
const tone = (f, t) => Math.sin(2 * Math.PI * f * t);
const clips = {
  dice_roll: [0.65, (t) => noise() * Math.exp(-9 * (t % 0.085)) * Math.exp(-3 * t)],
  footstep_stone: [0.22, t => (noise() * 0.5 + tone(100, t)) * Math.exp(-28 * t)],
  footstep_grass: [0.25, t => noise() * Math.exp(-17 * t) * 0.65],
  sword_slash: [0.35, t => noise() * Math.sin(Math.PI * t / 0.35) * Math.exp(-5 * t)],
  blunt_hit: [0.35, t => (tone(75 - t * 70, t) + noise() * 0.3) * Math.exp(-16 * t)],
  bow_shoot: [0.4, t => (tone(400 - t * 400, t) + noise() * 0.4) * Math.exp(-13 * t)],
  spell_fire: [0.7, t => (noise() * 0.6 + tone(90 + t * 180, t) * 0.4) * Math.sin(Math.PI * t / 0.7)],
  spell_ice: [0.8, t => (tone(1200, t) + tone(1800, t) * 0.5) * Math.exp(-5 * t)],
  spell_heal: [1, t => (tone(528, t) + tone(660, t) + tone(792, t)) / 3 * Math.sin(Math.PI * t)],
  dodge_whoosh: [0.3, t => noise() * Math.sin(Math.PI * t / 0.3) * 0.6],
  portal_transition: [1.2, t => (tone(180 + t * 250, t) + tone(270 + t * 375, t)) * Math.sin(Math.PI * t / 1.2) / 2],
  coins_jingle: [0.65, t => (tone(1800, t) + tone(2400, t) * 0.5) * Math.exp(-8 * (t % 0.14)) * Math.exp(-4 * t)],
  chest_open: [0.65, t => (tone(120 + 50 * t, t) * 0.5 + noise() * 0.3) * Math.exp(-5 * t)],
  master_thunder: [2.2, t => (noise() * 0.6 + tone(45, t) * 0.4) * Math.exp(-2.5 * t) * Math.min(1, t * 60)],
  master_door_slam: [1, t => (noise() * 0.4 + tone(65, t) * 0.6) * Math.exp(-8 * t)],
};
const folder = mkdtempSync(join(tmpdir(), 'df-audio-'));
function encode(name, samples) {
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 25000), 44 + i * 2));
  const source = join(folder, `${name}.wav`); writeFileSync(source, wav);
  for (const [extension, codec] of [['webm', 'libopus'], ['mp3', 'libmp3lame']]) {
    const result = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', source, '-c:a', codec, '-b:a', '128k', join(out, `${name}.${extension}`)], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.error?.message || result.stderr);
  }
}
try {
  const sprite = {}, samples = [];
  for (const [name, [duration, synth]] of Object.entries(clips)) {
    sprite[name] = [Math.round(samples.length / rate * 1000), Math.round(duration * 1000)];
    for (let i = 0; i < Math.round(duration * rate); i++) {
      const t = i / rate, fade = Math.min(1, t / 0.004, (duration - t) / 0.008);
      samples.push(synth(t) * fade * 0.7);
    }
    samples.push(...new Array(rate / 2).fill(0)); // 500ms silence for iOS sprite boundaries.
  }
  encode('sfx-sprite', samples); writeFileSync(join(out, 'sfx-sprite.json'), JSON.stringify(sprite, null, 2) + '\n');
  for (const combat of [false, true]) {
    const duration = 16, samples = new Float32Array(rate * duration), notes = combat ? [110, 130.8128, 164.8138, 146.8324] : [130.8128, 164.8138, 195.9977, 164.8138];
    for (let i = 0; i < samples.length; i++) {
      const t = i / rate, beat = combat ? 0.25 : 0.5, phase = t % beat;
      const f = notes[Math.floor(t / 4)] * (Math.floor(t / beat) % 2 ? 2 : 1);
      const pad = notes.reduce((sum, n) => sum + tone(Math.round(n * duration) / duration, t), 0) * 0.035;
      const pluck = tone(f, phase) * Math.exp(-phase * 12) * Math.min(1, phase * 400) * 0.12;
      const pulse = combat ? tone(55, phase) * Math.exp(-phase * 24) * 0.08 : 0;
      samples[i] = (pad + pluck + pulse) * Math.min(1, t / 0.01, (duration - t) / 0.01);
    }
    encode(combat ? 'bgm_combat_pov' : 'bgm_exploration', samples);
  }
  console.log('Generated original SFX sprite (15 clips, 500ms gaps) and two looping BGMs in WebM/MP3.');
} finally { rmSync(folder, { recursive: true, force: true }); }
