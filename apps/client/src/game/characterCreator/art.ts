import type { RaceId } from '@df/shared';
import type { LayerId } from './catalog';

// All pieces use one registration and one ink palette. Filled details never
// cross their owning silhouette; the same eye aperture clips iris and pupil.
const INK = '#302523';
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
    : 'M181 213 C198 209 219 213 232 222 C217 234 194 233 181 213 Z';
}

export function pieceArt(layer: LayerId, option: string, race: RaceId): [string, string] {
  let shade = '', ink = '';
  const broad = race === 'ORC' || race === 'DWARF';
  if (option === 'none') return ['', ''];

  if (layer === '00_back_hair') {
    const d = option === 'long'
      ? 'M143 209 C116 139 128 74 213 54 C306 28 380 86 373 211 C368 289 381 367 389 445 Q366 439 347 447 L327 421 Q256 442 185 421 L165 447 Q145 439 123 445 C137 361 144 284 143 209 Z'
      : 'M144 212 C113 141 131 70 213 54 C304 29 384 82 370 217 Q361 267 380 295 Q364 294 353 285 Q355 317 365 331 Q343 329 328 313 L184 313 Q165 330 146 330 Q160 312 159 288 Q146 298 132 296 Q151 264 144 212 Z';
    shade = path(d); ink = outline(d);
    if (option === 'long') ink += mirror(detail('M153 278 Q148 354 145 408 M171 304 Q165 365 169 420'));
    if (option === 'braids') {
      const braid = 'M153 271 C139 299 142 334 151 353 C139 374 143 396 154 414 Q163 421 172 411 C183 389 181 370 171 353 C182 330 183 300 170 277 Z';
      shade += mirror(path(braid)); ink += mirror(outline(braid) + detail('M151 294 Q176 308 153 326 Q175 341 154 358 Q175 375 155 393') + path('M149 409 L174 409 L174 417 L150 417 Z', '#B39A6E', INK, 1.25));
    }
  }

  if (layer === '10_body_base') {
    const neck = 'M199 297 L198 359 Q195 380 175 391 L217 423 L256 464 L295 423 L337 391 Q317 380 314 359 L313 297 Z';
    const face = broad
      ? option === 'soft'
        ? 'M151 153 C150 99 185 77 256 77 C327 77 362 99 361 153 L346 277 Q335 310 285 339 Q256 356 227 339 Q177 310 166 277 Z'
        : 'M149 153 C150 97 187 77 256 77 C325 77 362 97 363 153 L350 276 Q343 304 289 340 Q278 347 256 347 Q234 347 223 340 Q169 304 162 276 Z'
      : option === 'soft'
        ? 'M160 153 C159 103 189 78 256 78 C323 78 353 103 352 153 L337 272 C327 303 286 329 267 340 Q256 346 245 340 C226 329 185 303 175 272 Z'
        : 'M157 153 C156 101 189 78 256 78 C323 78 356 101 355 153 L339 274 Q321 304 279 337 Q256 353 233 337 Q191 304 173 274 Z';
    const neckShadow = 'M196 310 Q223 344 256 348 Q289 344 316 310 L309 349 Q285 376 256 381 Q227 369 202 345 Z';
    shade = path(neck) + clipped('neck', path(neck), path(neckShadow, '#B9B9B9'))
      + path(face)
      + clipped('face', path(face), path('M335 167 Q348 225 323 277 Q312 298 283 323 Q328 306 339 274 L355 153 Z', '#D0D0D0')
        + path('M256 229 Q261 245 267 255 Q266 262 259 264 L256 262 Z', '#C0C0C0'));
    ink = outline('M199 327 L198 359 Q196 378 180 388 M313 327 L314 359 Q316 378 332 388')
      + outline(face) + detail('M248 264 Q251 266 253 265 M261 265 Q264 265 266 263');

    // One continuous shirt opening, two fitted collar panels, no crossing lapels.
    const shirt = 'M181 386 Q145 406 99 423 Q58 443 35 512 H477 Q454 443 413 423 Q367 406 331 386 L304 408 L270 424 L256 461 L242 424 L208 408 Z';
    const collar = 'M185 368 Q174 373 176 387 Q182 407 242 424 L256 461 L246 417 Q210 405 193 391 Q186 382 185 368 Z';
    ink += path(shirt, '#B7A590', INK)
      + path('M100 433 Q105 473 91 512 H111 Q122 474 100 433 Z M412 433 Q407 473 421 512 H401 Q390 474 412 433 Z', '#9B8978')
      + mirror(path(collar, '#58453E', INK))
      + mirror(path('M185 373 Q183 391 198 398 Q215 409 242 417', 'none', '#A1886D', 1.3))
      + detail('M256 463 L256 512 M132 456 Q124 481 126 501 M380 456 Q388 481 386 501');
  }

  if (layer === '30_ears') {
    // The attachment edge sits inside the face silhouette and has no outline.
    // This avoids a second jaw contour where the two pieces meet.
    const pointed = race === 'ELF' || race === 'DEMON';
    const d = race === 'HALF_SHARK'
      ? 'M170 218 Q149 203 118 199 Q137 213 131 229 Q148 229 152 249 L173 256 Z'
      : pointed ? 'M170 217 Q145 204 114 198 Q139 230 173 254 Z'
        : 'M167 215 C142 198 137 217 147 237 Q155 251 173 254 Z';
    const contour = race === 'HALF_SHARK'
      ? 'M170 218 Q149 203 118 199 Q137 213 131 229 Q148 229 152 249 L169 254'
      : pointed ? 'M170 217 Q145 204 114 198 Q139 230 169 252'
        : 'M167 215 C142 198 137 217 147 237 Q155 251 169 253';
    shade = mirror(path(d) + clipped('ear', path(d), path(pointed ? 'M163 222 L134 211 Q145 231 164 242 Z' : 'M160 220 Q145 212 151 230 L163 243 Z', '#BDBDBD')));
    ink = mirror(outline(contour) + detail(pointed ? 'M134 211 Q150 217 161 230' : 'M150 225 Q148 214 160 219'));
  }

  if (layer === '20_skin_details') {
    if (race === 'HALF_DRAGON') {
      for (let i = 0; i < 3; i++) {
        const x = 177 + i * 2, y = 211 + i * 14;
        const scale = `M${x} ${y} q9 -5 13 1 l-4 10 q-7 0 -10 -3 Z`;
        shade += mirror(path(scale)); ink += mirror(path(scale, 'none', '#4E5961', .9));
      }
    }
    // Gills follow the sides of the neck and end above the collar.
    if (race === 'HALF_SHARK') ink = mirror(path('M202 343 Q212 352 224 354 Q211 351 202 348 Z M201 355 Q212 364 225 365 Q211 362 201 360 Z', '#5C6678'));
    if (race === 'ORC') {
      const scar = 'M325 246 L310 265 L312 259 L299 276 L307 261 L305 265 Z';
      shade = path(scar, '#B9B9B9'); ink = path('M325 246 L311 264 L299 276', 'none', '#8A7061', 1.1);
    }
  }

  if (layer === '40_eyes_iris') {
    // clipPath requires direct geometry children: a mirrored <g> is ignored
    // by SVG rasterizers, which would silently clip away the right iris.
    const aperture = path(eyeAperture(option), '#FFFFFF')
      + `<path d="${eyeAperture(option)}" fill="white" transform="translate(512 0) scale(-1 1)"/>`;
    const iris = mirror('<ellipse cx="208" cy="220" rx="10.5" ry="13" fill="url(#shade)"/>');
    shade = clipped('eye-aperture', aperture, iris);
    // White sclera behind the iris, then all dark details clipped to the SAME
    // aperture. Unlike an ellipse-only knockout, nothing can escape the eyelid.
    const irisHole = mirror('<ellipse cx="208" cy="220" rx="10.5" ry="13" fill="black"/>');
    ink = `<defs><mask id="sclera"><rect width="512" height="512" fill="white"/>${irisHole}</mask></defs><g mask="url(#sclera)">${aperture}</g>`;
    const slit = ['VAMPIRE', 'DEMON', 'HALF_DRAGON', 'HALF_SHARK'].includes(race);
    const pupil = slit
      ? path('M208 208 Q214 219 208 232 Q202 219 208 208 Z', '#242025')
      : '<ellipse cx="208" cy="220" rx="4.5" ry="8.5" fill="#242025"/>';
    ink += clipped('pupil-aperture', aperture, mirror(pupil + '<circle cx="205" cy="215" r="2.4" fill="#FFFDF5"/>'));
    ink += mirror(outline(eyeAperture(option), 1.5)
      + path(option === 'gentle' ? 'M181 218 C192 204 218 204 232 220' : 'M181 213 C198 209 219 213 232 222', 'none', INK, 2.8)
      + path('M181 198 Q202 187 230 203 Q207 194 182 202 Z', INK));
  }

  if (layer === '50_mouth_fangs') {
    const mouth = option === 'smile' ? 'M233 289 Q256 299 279 289' : 'M234 290 Q256 287 278 290';
    ink = path('M246 301 Q256 304 266 301', 'none', '#A18173', 1.5) + path(mouth, 'none', '#62453E', 1.8);
    if (race === 'ORC') ink += mirror(path('M232 290 L235 280 Q237 280 240 290 Z', '#F6EACC', INK, 1.2));
    if (race === 'VAMPIRE') ink += mirror(path('M237 290 L240 298 L243 290 Z', '#FAF0DA', INK, 1.1));
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
    const opening = 'M229 290 Q256 285 283 290 L276 309 Q256 316 236 309 Z';
    const beardShape = path(`${beard} ${opening}`);
    shade = `<g fill-rule="evenodd">${beardShape}</g>`;
    ink = outline(beard) + detail(opening) + mirror(detail('M182 302 Q193 327 219 345 M203 312 Q217 341 238 359')) + detail('M256 324 L256 375');
    if (option === 'braided') {
      ink += mirror(detail('M205 355 Q223 365 205 378 Q222 390 207 404')
        + path('M202 407 L221 407 L220 415 L204 415 Z', '#BAA06C', INK, 1.2));
    }
  }

  if (layer === '70_front_hair') {
    const d = option === 'short'
      ? 'M143 211 Q124 176 135 137 L131 115 L157 91 L184 68 L202 76 L236 46 L258 63 L293 51 L317 76 Q365 83 375 139 Q382 181 362 211 L345 166 Q329 147 311 128 L280 139 L256 112 L230 141 L191 132 Q171 158 168 201 L171 220 Z'
      : option === 'fringe'
        ? 'M143 217 Q121 174 134 126 Q158 56 230 53 Q333 35 370 123 Q383 171 360 219 L342 180 L316 128 L304 183 L278 151 L259 192 L226 142 L195 184 L178 165 L171 220 Z'
        : 'M143 219 Q121 184 131 148 Q128 126 122 122 Q150 114 164 89 Q213 36 260 55 Q319 35 351 86 Q380 111 374 145 Q374 159 391 164 Q366 174 341 158 L349 206 Q322 187 315 128 Q302 112 286 123 Q263 143 277 188 Q242 164 240 124 Q216 162 179 179 L171 219 L158 204 Z';
    const shadows = 'M141 173 Q153 118 215 84 Q183 126 178 170 L171 219 L151 205 Z M241 91 Q235 143 277 188 Q253 146 270 122 Q259 102 241 91 Z M310 88 Q325 136 376 153 L391 164 Q357 178 332 148 Q315 119 310 88 Z';
    const highlights = 'M145 130 Q176 88 229 68 Q197 92 176 124 Z M281 66 Q325 57 351 113 Q322 85 281 66 Z';
    shade = path(d) + clipped('hair', path(d), path(shadows, '#BDBDBD') + path(highlights, '#FFFFFF'));
    ink = outline(d) + clipped('hair-strands', path(d), mirror(detail('M159 165 Q165 118 208 88')));
  }

  if (layer === '80_horns' && (race === 'DEMON' || race === 'HALF_DRAGON')) {
    const d = option === 'crown'
      ? 'M167 122 Q140 108 139 84 L136 31 L158 70 L190 109 Z'
      : 'M165 123 Q132 106 138 82 Q142 65 155 46 Q166 30 163 16 Q191 46 182 73 Q174 91 191 109 Z';
    shade = mirror(path(d) + clipped('horn', path(d), path('M136 78 Q161 92 180 87 L191 109 L165 123 Z', '#B5B5B5')));
    ink = mirror(outline(d) + clipped('horn-ridges', path(d), detail('M141 74 Q155 77 178 89 M140 93 Q153 94 178 106')));
  }
  return [shade, ink];
}

export function svgDocument(content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs><linearGradient id="shade" x1=".15" y1="0" x2=".85" y2="1"><stop stop-color="#FFFFFF"/><stop offset=".58" stop-color="#F0F0F0"/><stop offset="1" stop-color="#CDCDCD"/></linearGradient></defs>${content}</svg>`;
}
