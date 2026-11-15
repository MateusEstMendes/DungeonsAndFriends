import type { RaceId } from '@df/shared';
import type { LayerId } from './catalog';
import { headTransform } from './raceAppearance';

// All pieces use one registration and one ink palette. Filled details never
// cross their owning silhouette; the same eye aperture clips iris and pupil.
const INK = '#171410';
const path = (d: string, fill = 'url(#shade)', stroke = 'none', width = 2.2) =>
  `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
const mirror = (s: string) => s + `<g transform="translate(512 0) scale(-1 1)">${s}</g>`;
const outline = (d: string, width = 2.2) => path(d, 'none', INK, width);
const detail = (d: string) => path(d, 'none', INK, 1.25);
const clipped = (id: string, shape: string, content: string) =>
  `<defs><clipPath id="${id}">${shape}</clipPath></defs><g clip-path="url(#${id})">${content}</g>`;

export function eyeAperture(option: string): string {
  return option === 'gentle'
    ? 'M181 218 C192 204 218 204 232 220 C219 234 194 235 181 218 Z'
    : 'M181 204 C198 201 219 202 235 214 C222 223 203 225 192 220 Z';
}

export function pieceArt(layer: LayerId, option: string, race: RaceId): [string, string] {
  let shade = '', ink = '';
  const broad = race === 'DWARF';
  if (option === 'none') return ['', ''];

  if (layer === '00_back_hair') {
    const d = option === 'short'
      ? 'M156 213 Q139 165 153 123 Q174 65 256 65 Q338 65 359 123 Q373 165 356 213 L348 267 L329 283 L327 180 H185 L183 283 L164 267 Z'
      : 'M156 211 Q138 163 153 120 Q176 62 256 62 Q336 62 359 120 Q374 163 356 211 L365 420 Q341 431 321 417 L310 390 H202 L191 417 Q171 431 147 420 Z';
    shade = path(d);
    ink = outline(d);
    if (option === 'long') ink += mirror(detail('M164 266 Q160 340 160 403 M181 295 L176 410'));
    if (option === 'braids') {
      const braid = 'M163 243 Q144 258 153 278 Q141 295 153 311 Q141 328 154 345 Q143 362 158 378 L165 391 L174 378 Q188 361 176 345 Q188 328 176 311 Q188 294 176 278 Q185 258 171 244 Z';
      shade += mirror(path(braid));
      ink += mirror(outline(braid) + detail('M155 271 L175 286 L153 303 L175 319 L154 337 L175 353 L157 372')
        + path('M157 379 H175 V388 H157 Z', '#B49A61', INK, 1.2));
    }

  }

  if (layer === '10_body_base') {
    const neck = 'M199 297 L198 359 Q195 380 175 391 L217 423 L256 464 L295 423 L337 391 Q317 380 314 359 L313 297 Z';
    // Human proportions with a defined jaw and a gently tapered chin for orcs.
    const face = race === 'ORC'
      ? option === 'soft'
        ? 'M160 171 C153 118 194 78 256 78 C318 78 359 118 352 171 L339 261 Q336 283 321 298 L280 337 Q269 345 256 345 Q243 345 232 337 L191 298 Q176 283 173 261 Z'
        : 'M160 171 C153 120 198 77 256 77 C314 77 359 120 352 171 L338 263 Q335 285 319 301 L283 334 Q272 344 256 344 Q240 344 229 334 L193 301 Q177 285 174 263 Z'
      : broad
      ? option === 'soft'
        ? 'M151 153 C150 99 185 77 256 77 C327 77 362 99 361 153 L346 277 Q335 310 285 339 Q256 356 227 339 Q177 310 166 277 Z'
        : 'M149 153 C150 97 187 77 256 77 C325 77 362 97 363 153 L350 276 Q343 304 289 340 Q278 347 256 347 Q234 347 223 340 Q169 304 162 276 Z'
      : option === 'soft'
        ? 'M160 171 C153 118 194 78 256 78 C318 78 359 118 352 171 L337 268 C331 295 295 322 270 337 Q256 344 242 337 C217 322 181 295 175 268 Z'
        : 'M160 171 C153 120 198 77 256 77 C314 77 359 120 352 171 L339 266 Q335 285 320 298 L278 332 Q269 340 256 340 Q243 340 234 332 L192 298 Q177 285 173 266 Z';
    const faceShape = (fill = 'url(#shade)', stroke = 'none') => `<path d="${face}" fill="${fill}" stroke="${stroke}" stroke-width="2.2" stroke-linejoin="round" transform="${headTransform(race)}"/>`;
    shade = path(neck) + faceShape();
    // Hide the neck stroke inside the face, joining the jaw at its actual edge.
    const neckContour = 'M199 297 L198 359 Q195 380 175 391 M313 297 L314 359 Q317 380 337 391';
    ink = `<defs><mask id="neck-contour"><rect width="512" height="512" fill="white"/>${faceShape('black')}</mask></defs><g mask="url(#neck-contour)">${outline(neckContour)}</g>`
      + faceShape('none', INK) + `<g transform="${headTransform(race)}">${detail('M248 257 Q250 261 253 259 M261 259 Q264 261 266 257')}${race === 'ORC'
        ? mirror(detail(option === 'soft' ? 'M184 245 Q194 252 204 252' : 'M182 241 L195 249 L207 250'))
          + detail('M251 229 L248 250')
        : ''}</g>`;

    // One continuous shirt opening, two fitted collar panels, no crossing lapels.
    const shirt = 'M181 386 Q145 406 99 423 Q58 443 35 512 H477 Q454 443 413 423 Q367 406 331 386 L304 408 L270 424 L256 461 L242 424 L208 408 Z';
    const collar = 'M185 368 Q174 373 176 387 Q182 407 242 424 L256 461 L246 417 Q210 405 193 391 Q186 382 185 368 Z';
    ink += path(shirt, '#B5A48E', INK)
      + mirror(path(collar, '#655046', INK));

  }

  if (layer === '30_ears') {
    // The attachment edge sits inside the face silhouette and has no outline.
    // This avoids a second jaw contour where the two pieces meet.
    const pointed = race === 'ELF' || race === 'DEMON' || race === 'ORC' || race === 'HALF_DRAGON';
    const earTip = race === 'ELF' ? '108 184' : race === 'ORC' ? '127 204' : '119 195';
    const d = race === 'HALF_SHARK'
      ? 'M170 218 Q149 203 118 199 Q137 213 131 229 Q148 229 152 249 L173 256 Z'
      : pointed ? `M170 217 Q145 204 ${earTip} Q139 230 173 254 Z`
        : 'M167 215 C142 198 137 217 147 237 Q155 251 173 254 Z';
    const contour = race === 'HALF_SHARK'
      ? 'M170 218 Q149 203 118 199 Q137 213 131 229 Q148 229 152 249 L169 254'
      : pointed ? `M170 217 Q145 204 ${earTip} Q139 230 169 252`
        : 'M167 215 C142 198 137 217 147 237 Q155 251 169 253';
    shade = mirror(path(d) + clipped('ear', path(d), path(pointed ? 'M163 222 L134 211 Q145 231 164 242 Z' : 'M160 220 Q145 212 151 230 L163 243 Z', '#BDBDBD')));
    ink = mirror(outline(contour) + detail(pointed ? 'M134 211 Q150 217 161 230' : 'M150 225 Q148 214 160 219'));
    if (race === 'ORC') {
      const interior = 'M143 212 Q152 215 164 223 L166 239 Q153 229 143 212 Z';
      shade = mirror(path(d));
      ink = mirror(path(interior, INK).replace('/>', ' opacity="0.12"/>')
        + outline(contour) + detail('M145 215 Q155 219 161 230'));
    }
  }

  if (layer === '20_skin_details') {
    if (race === 'HALF_DRAGON') {
      for (const [x,y] of [[177,235],[185,248],[177,260],[194,262]]) {
        const scale = `M${x} ${y} q6 -5 12 0 l-2 7 l-4 4 l-5 -4 Z`;
        shade += mirror(path(scale)); ink += mirror(outline(scale, 1));
      }

    }
    // Gills follow the sides of the neck and end above the collar.
    if (race === 'HALF_SHARK') ink = mirror(path('M202 343 Q212 352 224 354 Q211 351 202 348 Z M201 355 Q212 364 225 365 Q211 362 201 360 Z', '#5C6678'));
    if (race === 'DEMON') {
      const mark='M178 239 Q187 251 196 254 L185 257 Z';
      shade=mirror(path(mark));
    }

  }

  if (layer === '40_eyes_iris') {
    // clipPath requires direct geometry children: a mirrored <g> is ignored
    // by SVG rasterizers, which would silently clip away the right iris.
    const aperture = path(eyeAperture(option), '#FFFFFF')
      + `<path d="${eyeAperture(option)}" fill="white" transform="translate(512 0) scale(-1 1)"/>`;
    const eyeY = option === 'gentle' ? 220 : 212;
    const iris = mirror(`<ellipse cx="209" cy="${eyeY}" rx="9.5" ry="11.5" fill="url(#shade)"/>`);
    shade = clipped('eye-aperture', aperture, iris);
    // White sclera behind the iris, then all dark details clipped to the SAME
    // aperture. Unlike an ellipse-only knockout, nothing can escape the eyelid.
    const irisHole = mirror(`<ellipse cx="209" cy="${eyeY}" rx="9.5" ry="11.5" fill="black"/>`);
    ink = `<defs><mask id="sclera"><rect width="512" height="512" fill="white"/>${irisHole}</mask></defs><g mask="url(#sclera)">${aperture}</g>`;
    const slit = ['VAMPIRE', 'DEMON', 'HALF_DRAGON', 'HALF_SHARK'].includes(race);
    const pupil = slit
      ? path('M209 201 Q214 212 209 223 Q204 212 209 201 Z', '#242025')
      : '<ellipse cx="209" cy="212" rx="3" ry="5" fill="#242025"/>';
    ink += clipped('pupil-aperture', aperture, mirror(`<g transform="translate(0 ${eyeY - 212})">${pupil}<circle cx="207" cy="208" r="2.4" fill="#FFFDF5"/></g>`));
    ink += mirror(outline(eyeAperture(option), 1.5)
      + path(option === 'gentle' ? 'M181 218 C192 204 218 204 232 220' : 'M181 204 C198 201 219 202 235 214', 'none', INK, 2.8)
      + path('M181 190 C186 179 212 182 239 197 Q212 187 188 193 Q180 195 181 190 Z', INK));
  }

  if (layer === '50_mouth_fangs') {
    const mouth = option === 'smile' ? 'M233 289 Q256 299 279 289' : 'M231 283 Q240 279 252 280 M260 280 Q272 279 281 283';
    ink = path('M247 294 Q256 298 265 294', 'none', INK, 1.5) + path(mouth, 'none', INK, 1.8);
    if (race === 'ORC') {
      const lip = option === 'smile' ? 'M235 287 Q256 298 277 287' : 'M235 285 Q256 289 277 285';
      const tusk = option === 'smile'
        ? 'M233 288 Q231 281 236 276 Q235 283 240 290 Z'
        : 'M233 286 Q231 279 236 274 Q235 281 240 287 Z';
      ink = path(lip, 'none', INK, 1.8) + mirror(path(tusk, '#F6EACC', INK, 1.2));
    }
    if (race === 'VAMPIRE') ink += mirror(path('M237 282 L240 292 L244 282 Z', '#FAF0DA', INK, 1.1));
    if (race === 'HALF_SHARK') {
      ink = path('M234 289 Q256 285 278 289 L274 294 Q256 298 238 294 Z', '#654C4B');
      for (let x = 237; x < 274; x += 8) ink += path(`M${x} 289 l3.5 5 l3.5 -5 Z`, '#FAF0DA', INK, .65);
    }
  }

  if (layer === '60_facial_hair') {
    // A single beard silhouette with an actual mouth opening. Internal strands
    // use lighter weight and do not repeatedly outline overlapping braid links.
    const beard = option === 'braided'
      ? 'M169 270 Q181 289 205 282 Q230 273 256 281 Q282 273 307 282 Q331 289 343 270 L338 316 Q331 343 310 359 L310 403 Q304 424 294 411 L290 370 Q272 383 256 391 Q240 383 222 370 L218 403 Q210 424 202 411 L202 359 Q181 343 174 316 Z'
      : 'M169 270 Q181 289 205 282 Q230 273 256 281 Q282 273 307 282 Q331 289 343 270 L338 316 Q322 358 256 391 Q190 358 174 316 Z';
    const opening = 'M226 277 Q256 270 286 277 L278 304 Q256 313 234 304 Z';
    const beardShape = path(`${beard} ${opening}`);
    shade = `<g fill-rule="evenodd">${beardShape}</g>`;
    ink = outline(beard) + outline(opening, 1.3) + mirror(detail('M182 302 Q193 327 219 345 M203 312 Q217 341 238 359')) + detail('M256 324 L256 375');
    if (option === 'braided') {
      ink += mirror(detail('M205 355 Q223 365 205 378 Q222 390 207 404')
        + path('M202 407 L221 407 L220 415 L204 415 Z', '#BAA06C', INK, 1.2));
    }
  }

  if (layer === '70_front_hair') {
    const rugged = race === 'ORC' || race === 'HALF_SHARK' || race === 'HALF_DRAGON';
    const elegant = race === 'ELF' || race === 'VAMPIRE';
    const cap = 'M157 212 Q143 176 151 139 Q157 75 226 65 Q305 48 344 93 Q371 123 356 212';
    const hairline = option === 'short'
      ? rugged
        ? 'L341 172 L324 153 L309 164 L294 143 L277 156 L258 137 L239 151 L220 140 L202 157 L183 153 L171 212 Z'
        : 'L340 170 Q316 146 293 139 L274 151 L256 134 L237 149 L217 139 Q190 151 172 185 L171 212 Z'
      : option === 'fringe'
        ? 'L341 172 L322 143 L307 183 L288 160 L268 191 L245 159 L224 184 L205 151 L182 181 L171 212 Z'
        : elegant
          ? 'L341 180 Q326 142 294 119 Q271 144 246 151 Q212 162 174 180 L171 212 Z'
          : 'L341 183 Q323 154 305 125 Q286 123 267 147 Q241 172 207 179 L227 147 Q195 164 174 180 L171 212 Z';
    const d = cap + hairline;
    shade = path(d);
    const strands = option === 'short'
      ? 'M173 151 Q187 108 228 94 M290 88 Q327 101 340 143'
      : option === 'fringe'
        ? 'M179 153 Q192 107 221 89 M241 91 L245 143 M286 91 Q309 110 315 134'
        : 'M174 148 Q208 99 271 88 M186 157 Q236 139 279 103 M298 90 Q330 113 341 151';
    ink = outline(d) + clipped('hair-strands', path(d), detail(strands));

  }

  if (layer === '80_horns' && (race === 'DEMON' || race === 'HALF_DRAGON')) {
    const d = race === 'HALF_DRAGON' && option==='curved'
      ? 'M168 127 Q145 112 141 91 L139 45 Q149 75 165 83 Q184 91 189 111 Z'
      : option === 'crown'
      ? 'M167 122 Q140 108 139 84 L136 31 L158 70 L190 109 Z'
      : 'M165 123 Q132 106 138 82 Q142 65 155 46 Q166 30 163 16 Q191 46 182 73 Q174 91 191 109 Z';
    shade = mirror(path(d) + clipped('horn', path(d), path('M136 78 Q161 92 180 87 L191 109 L165 123 Z', '#B5B5B5')));
    ink = mirror(outline(d) + clipped('horn-ridges', path(d), detail('M141 74 Q155 77 178 89 M140 93 Q153 94 178 106')));
  }
  if(layer!=='10_body_base' && !(layer==='20_skin_details' && race==='HALF_SHARK')) {
    const fit=(content:string)=>`<g transform="${headTransform(race)}">${content}</g>`;
    return [fit(shade),fit(ink)];
  }
  return [shade, ink];
}

export function svgDocument(content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs><linearGradient id="shade" x1=".15" y1="0" x2=".85" y2="1"><stop stop-color="#FFFFFF"/><stop offset=".58" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient></defs>${content}</svg>`;
}
