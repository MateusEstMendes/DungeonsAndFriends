import { Graphics } from 'pixi.js';

/** Code-native illustrations keep the arena crisp at every viewport size. */
export function drawBiome(g: Graphics, biome: string, w: number, h: number) {
  const forest = biome === 'FOREST', tavern = biome === 'TAVERN', cave = biome === 'CAVE';
  const sky = forest ? 0x142e2c : tavern ? 0x35221e : cave ? 0x18202c : 0x191b28;
  g.clear().rect(0, 0, w, h).fill(sky);
  for (let band = 0; band < 20; band++) g.rect(0, band * h / 20, w, h / 20 + 1).fill({ color: 0x08080f, alpha: band / 38 });
  const horizon = h * .57;
  g.ellipse(w * .5, horizon, w * .45, h * .33).fill({ color: forest ? 0x638d6b : 0x7b654e, alpha: .09 });
  if (forest) {
    g.circle(w * .72, h * .18, 38).fill({ color: 0xe1e6c1, alpha: .6 });
    for (let layer = 0; layer < 3; layer++) for (let i = 0; i < 9; i++) {
      const x = (i + .4 * layer) * w / 8, trunk = 8 + layer * 7, height = h * (.45 + layer * .1);
      g.moveTo(x, horizon).lineTo(x - trunk, horizon - height).lineTo(x + trunk, horizon - height).lineTo(x + trunk * 1.7, horizon).fill([0x1b3a35,0x142e2a,0x10241f][layer]);
      for (let j = 0; j < 3; j++) g.ellipse(x + (j - 1) * 40, horizon - height + 35, 75, 65).fill([0x203d34,0x19352c,0x102b23][layer]);
    }
  } else if (cave) {
    for (let i = 0; i < 13; i++) {
      const x = i * w / 12, depth = 45 + (i * 37 % 130);
      g.poly([x - 50, 0, x + 50, 0, x + 14, depth]).fill(i % 2 ? 0x252d3c : 0x303749);
      if (i % 3 === 0) g.poly([x, horizon + 35, x + 16, horizon - 50, x + 35, horizon + 35]).fill(0x576d87).stroke({ color: 0x8ca4b2, width: 1 });
    }
    g.ellipse(w * .5, horizon - 40, w * .27, h * .3).fill(0x0e121c);
  } else {
    const stone = tavern ? 0x4c332a : 0x30303c;
    for (let y = 0; y < horizon; y += 48) for (let x = -80; x < w + 80; x += 100) {
      g.roundRect(x + (Math.round(y / 48) % 2 ? 50 : 0), y, 96, 44, 3).fill({ color: stone, alpha: .65 }).stroke({ color: 0x100e16, width: 2, alpha: .3 });
    }
    g.roundRect(w / 2 - 80, horizon - 210, 160, 240, 75).fill(0x0d0e17).stroke({ color: tavern ? 0x795339 : 0x4e4a59, width: 14 });
    if (tavern) {
      for (const x of [w * .12, w * .88]) {
        g.roundRect(x - 40, horizon - 90, 80, 110, 15).fill(0x5a3d2b).stroke({ color: 0x947456, width: 4 });
        g.rect(x - 43, horizon - 65, 86, 7).fill(0x25212a); g.rect(x - 43, horizon - 20, 86, 7).fill(0x25212a);
      }
      g.rect(0, 40, w, 18).fill(0x6b4934);
    }
    for (const x of [w * .2, w * .8]) {
      g.circle(x, horizon * .47, 65).fill({ color: 0xffa84c, alpha: .06 });
      g.circle(x, horizon * .47, 32).fill({ color: 0xffb952, alpha: .10 });
      g.rect(x - 4, horizon * .47, 8, 40).fill(0x635046);
      g.poly([x - 10,horizon * .47, x,horizon * .47 - 24, x + 9,horizon * .47]).fill(0xffbc65);
    }
  }
  g.poly([0,horizon, w,horizon, w,h, 0,h]).fill(forest ? 0x25382b : tavern ? 0x3b2b25 : 0x242532);
  for (let i = 0; i < 14; i++) {
    const x = w / 2 + (i - 7) * w / 6;
    g.moveTo(w / 2 + (x - w / 2) * .08, horizon).lineTo(x, h).stroke({ color: 0xa8977a, width: 1, alpha: .1 });
  }
  for (let i = 1; i < 8; i++) { const y = horizon + (h - horizon) * (i / 8) ** 2; g.moveTo(0,y).lineTo(w,y).stroke({ color: 0xa8977a, width: 1, alpha: .1 }); }
  g.ellipse(w / 2, h * .8, w * .46, h * .10).fill({ color: 0x000000, alpha: .2 });
}

/** Frontal monster plates are rasterized once into Pixi sprites by the scene. */
export function monsterArt(name: string): Graphics {
  const g = new Graphics(), goblin = /goblin/i.test(name), cultist = /cult|arcano/i.test(name);
  g.ellipse(0, 104, 60, 12).fill({ color: 0x000000, alpha: .3 });
  if (goblin) {
    g.poly([-30,20, -40,95, -18,100, -5,40, 9,40, 21,100, 43,95, 30,20]).fill(0x4d6244).stroke({ color: 0x1b2920, width: 3 });
    g.poly([-25,-34, -42,33, -23,55, 30,54, 44,28, 23,-34]).fill(0x6a4632).stroke({ color: 0x30271f, width: 3 });
    g.poly([-31,-65,-75,-83,-44,-30, 0,-40, 44,-30, 75,-83, 31,-65]).fill(0x79935b).stroke({ color: 0x34462e, width: 3 });
    g.ellipse(0,-61,35,39).fill(0x8ca367).stroke({ color: 0x34462e, width: 3 });
    g.poly([-26,-72,-6,-65,-24,-59]).fill(0xe4c467); g.poly([26,-72,6,-65,24,-59]).fill(0xe4c467);
    g.moveTo(-15,-38).lineTo(15,-38).stroke({ color: 0x243125, width: 3 });
    g.poly([-13,-40,-9,-29,-5,-40]).fill(0xf3dfb7);
    g.poly([40,-15,48,-10,67,58,59,61]).fill(0x9b7750); g.poly([50,-15,65,-65,72,-17]).fill(0xc2c8c5).stroke({ color: 0x656b6c, width: 2 });
  } else if (cultist) {
    g.poly([-23,-40,-57,97,57,97,23,-40]).fill(0x473455).stroke({ color: 0x92709b, width: 3 });
    g.poly([0,-108,-41,-41,0,-20,41,-41]).fill(0x685076).stroke({ color: 0xa184ad, width: 3 });
    g.poly([0,-83,-22,-43,22,-43]).fill(0x171524);
    g.circle(-7,-52,3).fill(0xd1a3ff); g.circle(7,-52,3).fill(0xd1a3ff);
    g.poly([-5,-18,-16,93,4,93,11,-18]).fill(0x9f7d4a);
    g.moveTo(48,95).lineTo(48,-70).stroke({ color: 0x9b7850, width: 7 });
    g.poly([48,-100,34,-79,48,-59,62,-79]).fill(0xb499e9).stroke({ color: 0xe7ceff, width: 2 });
  } else {
    g.poly([-27,25,-36,100,-15,100,-3,40,5,40,20,100,39,100,27,25]).fill(0x8f8779).stroke({ color: 0x3a3540, width: 4 });
    g.poly([-30,-37,-43,32,0,52,43,32,30,-37]).fill(0x555761).stroke({ color: 0x9a9393, width: 4 });
    for (let i = 0; i < 4; i++) g.moveTo(-23,-20 + i * 13).lineTo(23,-20 + i * 13).stroke({ color: 0xb6ad96, width: 5 });
    g.ellipse(0,-69,29,34).fill(0xd3c5a5).stroke({ color: 0x6f645e, width: 3 });
    g.ellipse(-11,-71,8,10).fill(0x242330); g.ellipse(11,-71,8,10).fill(0x242330);
    g.poly([0,-65,-5,-55,5,-55]).fill(0x44404a);
    g.roundRect(-14,-47,28,10,2).fill(0x8f8171);
    for (let i = -1; i <= 1; i++) g.moveTo(i * 7,-48).lineTo(i * 7,-37).stroke({ color: 0x5c5352, width: 2 });
    g.poly([47,45,48,-70,59,-92,66,-70,58,45]).fill(0x9da6ae).stroke({ color: 0xe5dfc5, width: 2 });
    g.moveTo(38,32).lineTo(72,32).stroke({ color: 0xb28e50, width: 6 });
    g.ellipse(-48,5,26,42).fill(0x5d4840).stroke({ color: 0xa99471, width: 4 });
    g.circle(-48,5,7).fill(0xb39b72);
  }
  return g;
}
