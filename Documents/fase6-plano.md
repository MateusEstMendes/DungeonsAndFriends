# Plano de Implementação — Fase 6 (`v1.0.0 - Release Candidate`): PWA Mobile, Sistema de Áudio, Crash Recovery e Validação Final

Este plano detalha a arquitetura de produção para a **Fase 6 (`v1.0.0`)** a partir da auditoria direta do código atual, das especificações de [Fase6.md](Fase6.md), [roadmap-mvp.md](roadmap-mvp.md) e [controle-mestre-monstros-ia.md](controle-mestre-monstros-ia.md), e das práticas recomendadas para **Vite 8 + Workbox**, **Howler.js (iOS Safari / Chrome Android)**, **SQLite WAL (`better-sqlite3`)**, **PixiJS v8** e **Playwright / Lighthouse**.

> **Pré-requisito de integração com a Fase 5:** A migração `0005_finalize_mvp_schema.sql`, os índices compostos (incluindo `inventories`), os checkpoints completos de economia/IA e os gatilhos sonoros de loja/magia dependem da conclusão da Fase 5 (`0004` + `tacticalAi.ts` + loja/baús).

---

## 1. Diagnóstico do Estado Atual (Pontos Críticos Encontrados no Repositório)

| Área | Situação Atual Observada | Impacto na Fase 6 |
| :--- | :--- | :--- |
| **Crash Recovery no `onCreate`** | Em [GameRoom.ts](file:///workspaces/DungeonsAndFriends/apps/server/src/rooms/GameRoom.ts#L61-L62), após `this.combat.restore()`, o servidor executa `for (const player of this.state.players.values()) this.combat.removePlayer(player.id);` enquanto todos estão `connected = false`. | **Crítico:** Encerra (`ENDED`) qualquer combate ativo restaurado antes dos jogadores reconectarem após um `kill -9`. |
| **Sessões SQLite** | Em [session.ts](file:///workspaces/DungeonsAndFriends/apps/server/src/db/session.ts) e [host.ts](file:///workspaces/DungeonsAndFriends/apps/server/src/host.ts), `ensureActiveSession` apenas reutiliza ou cria `ACTIVE`; não existe `CLOSED` nem `"Encerrar Sessão"`. | Impede distinguir uma reinicialização pós-crash de uma sessão encerrada normalmente pelo Mestre. |
| **PWA & Vite 8** | [apps/client/package.json](file:///workspaces/DungeonsAndFriends/apps/client/package.json) usa `vite: ^8.0.0`, sem `vite-plugin-pwa`, sem `manifest.json`, sem ícones e com `apps/client/dist` desatualizado. | Exige `vite-plugin-pwa >= 2.0.0` (primeira linha compatível com Vite 8) e reconstrução de `dist/`. |
| **Áudio** | Zero código/assets de áudio no repositório; `ffmpeg` não está instalado neste ambiente (`node` e `python3` estão disponíveis). | Exige pipeline reprodutível em Node/Python (ou binário embutido) para gerar `sfx-sprite.webm` + `.mp3` e BGMs sem depender de `ffmpeg` no sistema. |
| **Gestos Multi-Touch & CSS** | Em [BoardScene.ts](file:///workspaces/DungeonsAndFriends/apps/client/src/game/scenes/BoardScene.ts#L109-L146), o threshold é `6px` (vs `8px`), `pointerDown` sobrescreve `this.press` em novo toque, e `pointerCancel` não zera `pinchDistance`. Em [board.css](file:///workspaces/DungeonsAndFriends/apps/client/src/components/board.css) e [combat.css](file:///workspaces/DungeonsAndFriends/apps/client/src/components/combat/combat.css) há botões de `28px–36px`. | Risco de tap acidental ao soltar pinch, pull-to-refresh sem `overscroll-behavior: none` e alvos táteis menores que `44x44px` no celular. |
| **Playwright Config** | [playwright.config.ts](file:///workspaces/DungeonsAndFriends/playwright.config.ts#L6) tem `executablePath: process.env.CHROME_PATH \|\| "C:/Program Files/..."` hardcoded para Windows. | Quebra execução automática no Linux/CI caso `CHROME_PATH` não seja informado. |

---

## 2. Arquitetura e Detalhamento Técnico por Pilar

### Pilar 1 — Migração `0005_finalize_mvp_schema.sql`, SQLite WAL e `pnpm db:sanitize` (`apps/server`)

1. **Migração `0005_finalize_mvp_schema.sql` (`apps/server/src/db/schema.ts` + Drizzle snapshot)**:
   - Criar tabela `crash_recovery_checkpoints`:
     - `id TEXT PRIMARY KEY`
     - `room_id TEXT NOT NULL UNIQUE REFERENCES rooms(id)`
     - `session_id TEXT NOT NULL REFERENCES sessions(id)`
     - `serialized_room_state TEXT NOT NULL` (JSON com metadados da sala, `explorationMode`, `activeStageId`, participantes esperados no momento do snapshot, posições `(q, r)` e resumo de estados)
     - `combat_snapshot_json TEXT` (`NULL` fora de combate; quando em combate, guarda fila `turnOrder`, rodada, turno, `globalAiEnabled`, modos `isAutoMode`/`allowAutoFlee` por criatura e participantes ativos antes do crash)
     - `last_event_type TEXT NOT NULL`
     - `updated_at INTEGER NOT NULL`
   - Criar índices compostos de performance (após as tabelas da Fase 5 existirem em `0004`):
     - `idx_players_room_token ON players(room_id, session_token)`
     - `idx_cells_chamber_qr ON terrain_cells(chamber_id, q, r)`
     - `idx_inventories_char_slot ON inventories(character_id, slot)`
2. **Durabilidade do SQLite WAL (`apps/server/src/db/index.ts`)**:
   - Manter `journal_mode = WAL`, `busy_timeout = 5000`, `foreign_keys = ON`.
   - Configurar `PRAGMA synchronous = NORMAL` como padrão de alta vazão (seguro contra crash de processo/`kill -9` sem corromper o banco) com suporte a `DB_SYNCHRONOUS=FULL` via variável de ambiente para durabilidade máxima contra perda física de energia.
   - Executar verificação leve na inicialização e expor `checkpointWal(mode)` (`PASSIVE` / `TRUNCATE`).
3. **Utilitário `apps/server/src/scripts/sanitizeDb.ts` (`pnpm db:sanitize`)**:
   - Remove registros órfãos de sessões `CLOSED` expiradas, checkpoints antigos já encerrados, entradas de `editor_history` marcadas para descarte e tokens de reconexão expirados.
   - Executa `PRAGMA wal_checkpoint(TRUNCATE);` para consolidar o arquivo `-wal` no `dungeons.db`.
   - Executa `PRAGMA integrity_check;` e falha com código de saída `1` caso o retorno não seja `[{ integrity_check: 'ok' }]`.
   - Expor script `"db:sanitize": "pnpm --filter @df/server db:sanitize"` no `package.json` raiz.

---

### Pilar 2 — Crash Recovery Autoritativo & Reconexão Pós-Queda (`apps/server` + `apps/client`)

1. **Ciclo de Vida de Sessões (`apps/server/src/db/session.ts` & `services/crashRecoveryService.ts`)**:
   - **Encerramento Limpo vs. Crash**:
     - Adicionar comando exclusivo do Mestre: `MASTER_CLOSE_SESSION` (*"Encerrar Sessão"*). Ele encerra eventual combate ativo de forma limpa, grava `sessions.status = 'CLOSED'`, remove o checkpoint pendente em `crash_recovery_checkpoints`, executa `PRAGMA wal_checkpoint(TRUNCATE)` e desconecta/retorna a sala para estado pronto para nova aventura.
     - Se o processo sofrer `kill -9` / queda abrupta, `sessions.status` permanece `'ACTIVE'` e o último registro em `crash_recovery_checkpoints` fica preservado.
   - **`saveCheckpoint(room, eventType)`**:
     - Executado de forma transacional e síncrona (`better-sqlite3`) a cada evento crítico: movimento confirmado (`REQUEST_MOVE` / `MASTER_POSITION_PLAYER`), travessia de portal/câmara, início/ação/fim de combate, transação de loja/baú (`BUY_ITEM`, `SELL_ITEM`, `LOOT_CHEST_ITEM`), edição do Mestre (`MASTER_EDIT`, `MASTER_UNDO`, `MASTER_REDO`) e alternância de IA dos monstros.
     - Reaproveita o mesmo padrão ACID de rollback em memória usado em `CombatHandler`.
   - **`detectInterruptedSession(database, roomId)`**:
     - Executado no boot do host (`host.ts`) e consultado quando o Mestre se autentica (`MASTER_AUTH`).
     - Se houver sessão `'ACTIVE'` com registro em `crash_recovery_checkpoints` (e `last_event_type !== 'SESSION_INITIALIZED'` ou com dados jogados), marca a sala em estado `AWAITING_RECOVERY_DECISION` e envia ao Mestre `HAS_INTERRUPTED_SESSION` contendo resumo legível (`updatedAt`, câmara atual, `inCombat`, rodada e lista de heróis).
2. **Correção do Bug de Boot em `GameRoom.ts` & Políticas de Ausência (`controle-mestre-monstros-ia.md` §4.3)**:
   - Remover a chamada indiscriminada `this.combat.removePlayer(player.id)` no `onCreate` de [GameRoom.ts](file:///workspaces/DungeonsAndFriends/apps/server/src/rooms/GameRoom.ts#L62).
   - **Regra exata de restauração**:
     - Jogadores que estavam **presentes/ativos no checkpoint** permanecem na `turnOrder` do combate restaurado aguardando reconexão (sem removê-los automaticamente no boot).
     - Jogadores que **já haviam saído definitivamente antes do crash** (`absent: true` no checkpoint) **não** são reintroduzidos automaticamente; o retorno deles continua exigindo ação do Mestre (`MASTER_ADD_COMBAT_PLAYER`).
     - Enquanto `AWAITING_RECOVERY_DECISION` ou durante a janela inicial de reconexão pós-restore, `combatState.isPaused` inicia pausado (ou com aviso `"Aguardando reconexão pós-restauração"`) e a IA automática fica bloqueada até o Mestre confirmar a restauração/despausar, impedindo ações duplicadas ou punição injusta aos jogadores durante a reconexão.
   - **`restoreSessionFromCheckpoint(roomId)` / `discardInterruptedSession(roomId)`**:
     - `MASTER_RESTORE_SESSION`: restaura câmara, posições, HP/MP, inventário/ouro, combate ativo, `turnToken` (mantendo pacotes já consumidos inválidos), `globalAiEnabled` e `isAutoMode`/`allowAutoFlee` por criatura; libera os clientes para retomar do ponto exato.
     - `MASTER_DISCARD_SESSION`: fecha a sessão interrompida (`CLOSED`), limpa `crash_recovery_checkpoints` e eventual `combat_encounters` `ACTIVE`, move personagens para o spawn da câmara inicial (ou preserva fichas sem combate ativo) e abre uma nova sessão limpa.
3. **UX do Mestre & Reconexão Automática do Cliente (`apps/client`)**:
   - **Modal Prioritário do Mestre (`RecoveryModal.tsx`)**: Exibido assim que o Mestre autentica e recebe `HAS_INTERRUPTED_SESSION`:
     - Texto: *"Sessão anterior interrompida. Deseja restaurar de onde parou?"* + resumo do checkpoint.
     - Botões táteis (`>= 48px`): `[ Restaurar Sessão ]` e `[ Descartar e Criar Nova ]`.
   - **Auto-reconexão resiliente em [colyseusClient.ts](file:///workspaces/DungeonsAndFriends/apps/client/src/network/colyseusClient.ts)**:
     - Ao receber `onLeave` inesperado (`code > 1000`, ex.: `1006` quando o servidor cai por `kill -9`), entrar em retry com backoff exponencial + jitter (`1s, 2s, 4s, 8s, max 10s`), exibindo indicador não-bloqueante *"Servidor desconectado. Tentando reconectar..."* até restabelecer via `df_session_token` e `df_room_code`.

---

### Pilar 3 — Sistema de Áudio Imersivo com Howler.js (`apps/client/src/audio`)

1. **Dependências e Pipeline de Assets (`apps/client/public/audio/`)**:
   - Adicionar `howler` (`^2.2.4`) e `@types/howler` em `apps/client/package.json`.
   - **Gerador reprodutível de Audio Sprite (`scripts/build-audio-assets.mjs` ou `.py`)**:
     - Como `ffmpeg` não está pré-instalado no container, o script sintetiza/empacota os efeitos em PCM/WAV de alta qualidade e codifica via dependência dev (`ffmpeg-static` / `lamejs` / `opusscript` ou pipeline CLI dedicado) gerando:
       - `sfx-sprite.webm` (Opus, ~96–128kbps) + fallback `sfx-sprite.mp3` (128kbps, excelente decodificação por hardware no iOS Safari) + `sfx-sprite.json` com timestamps `[offsetMs, durationMs]` e **gap mínimo de `500ms` entre faixas** para evitar sangramento de buffer no iOS.
       - Clipes obrigatórios no sprite: `dice_roll`, `footstep_stone`, `footstep_grass`, `sword_slash`, `blunt_hit`, `bow_shoot`, `spell_fire`, `spell_ice`, `spell_heal`, `dodge_whoosh`, `portal_transition`, `coins_jingle`, `chest_open`, `master_thunder`, `master_door_slam`.
       - Faixas de BGM em loop contínuo: `bgm_exploration.webm` / `.mp3` e `bgm_combat_pov.webm` / `.mp3`.
2. **Store Persistente (`apps/client/src/store/useAudioStore.ts`)**:
   - Persistência em `localStorage` sob a chave `df_audio_prefs`:
     - `masterVolume` (`0..1`, default `0.8`)
     - `bgmVolume` (`0..1`, default `0.5`)
     - `sfxVolume` (`0..1`, default `0.9`)
     - `isMuted` (`boolean`, default `false`)
     - `audioUnlocked` (`boolean`, efêmero de sessão)
   - Controles independentes acessíveis na barra superior / gaveta de configurações (tanto para Jogador quanto para Mestre) com alvos `>= 44x44px`.
3. **Motor `apps/client/src/audio/soundManager.ts`**:
   - **WebAudio puro (`html5: false`)** no `Howl` do sprite SFX para disparo instantâneo sem latência e precisão de loop/sprite no iOS Safari.
   - **Desbloqueio Mobile (iOS Safari / Chrome Android)**:
     - `Howler.mobileAutoEnable = true`.
     - Listener único síncrono em `pointerdown` / `touchend` / `keydown` no `document` chamando `Howler.ctx?.resume()` e atualizando `audioUnlocked = true`.
     - Listener `visibilitychange`: sempre que `document.visibilityState === 'visible'`, se `Howler.ctx?.state === 'suspended' || (Howler.ctx?.state as string) === 'interrupted'`, aguarda `100ms` e executa `Howler.ctx.resume().catch(() => {})` (corrige o bug clássico do WebKit ao minimizar/bloquear o celular).
   - **Crossfade de BGM (`crossfadeBgm(targetTrack, durationMs = 1200)`)**:
     - Rastreia `activeBgmId` e cancela qualquer `stopTimeout` pendente se houver troca rápida entre cenas (evita silenciar a trilha nova!).
     - Executa `howl.fade(currentVol, 0, durationMs, oldId)` nativo no audio thread e inicia a nova faixa com volume `0` fazendo `howl.fade(0, effectiveBgmVolume, durationMs, newId)`.
   - **Integração com Eventos das Fases 3, 4 e 5**:
     - Troca `BoardScene <-> CombatPOVScene` (`combatState.active`): `crossfadeBgm('bgm_combat_pov' | 'bgm_exploration', 1200)`.
     - `REQUEST_MOVE` confirmado: `footstep_stone` ou `footstep_grass` conforme terreno da célula de destino.
     - Mudança de `currentChamberId`: `portal_transition`.
     - `COMBAT_EVENT`: mapeia `vfxType` / `outcome` para `sword_slash`, `blunt_hit`, `bow_shoot`, `spell_fire`, `spell_ice`, `spell_heal`, `dodge_whoosh`.
     - `DICE_RESULT`: `dice_roll`.
     - `BUY_ITEM` / `SELL_ITEM` / `LOOT_CHEST_ITEM`: `coins_jingle` e `chest_open`.
   - **SFX Narrativo do Mestre (`MASTER_NARRATIVE_SFX`)**:
     - Novo pacote validado por Zod em `packages/shared` e tratado em `GameRoom.ts`: exclusivo `MASTER`, com rate-limit anti-spam (ex. `400ms`), transmitindo para todos os clientes conectados da sala tocarem `master_thunder`, `master_door_slam`, etc. simultaneamente.

---

### Pilar 4 — PWA Standalone (Vite 8 + Workbox), Lighthouse e Ergonomia Mobile (`apps/client`)

1. **Configuração `vite-plugin-pwa >= 2.0.0` (`apps/client/vite.config.ts`)**:
   - Compatibilidade explícita com `vite: ^8.0.0` (Node `>= 24` já atendido pelo projeto).
   - Configurar `VitePWA({ registerType: 'prompt', ... })` com **Prompt de Atualização Seguro**:
     - Quando uma nova versão do Service Worker estiver pronta, exibir toast discreto; **nunca** recarregar a página automaticamente enquanto `combatState.active === true` (adiar `updateServiceWorker(true)` até o fim do combate ou clique manual).
   - **Estratégias Workbox**:
     - `cleanupOutdatedCaches: true` (versionamento limpo `df-assets-v1.0.0`).
     - `maximumFileSizeToCacheInBytes: 5 * 1024 * 1024` (evita erro de precache com bundles do PixiJS v8).
     - `navigateFallback: '/index.html'` + `navigateFallbackDenylist: [/^\/health/, /^\/api/, /^\/matchmake/, /^\/colyseus/]` (impede o SW de interceptar ou servir `index.html` nas rotas de API/handshake WebSocket do Colyseus).
     - `runtimeCaching`:
       - **Cache-First** (`CacheFirst` com `ExpirationPlugin` de `30 dias` e `maxEntries: 200`): `\/(enemies|audio|icons|items)\/.*\.(webp|png|svg|webm|mp3|json)` e fontes.
       - **Network-Only** (`NetworkOnly`): `/health`, `/api/*`, `/matchmake/*`, `/colyseus/*`.
2. **Manifest & Metadados iOS/Android (`apps/client/public/manifest.json`, `public/icons/`, `index.html`)**:
   - `manifest.json`: `name: "Dungeons & Friends"`, `short_name: "D&F"`, `start_url: "/"`, `display: "standalone"`, `orientation: "any"`, `theme_color: "#0f172a"`, `background_color: "#09090b"`.
   - Ícones gerados em `public/icons/`:
     - `icon-192.png` (`192x192`, `purpose: "any"`)
     - `icon-512.png` (`512x512`, `purpose: "any"`)
     - `icon-maskable-512.png` (`512x512`, `purpose: "maskable"`, emblema dentro da zona segura central de `80%`)
     - `apple-touch-icon.png` (`180x180`, fundo opaco `#0f172a`, exigido pelo iOS Safari).
   - Atualizar [index.html](file:///workspaces/DungeonsAndFriends/apps/client/index.html):
     - `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"/>`
     - `<meta name="theme-color" content="#0f172a"/>`
     - `<meta name="apple-mobile-web-app-capable" content="yes"/>`
     - `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>`
     - `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" sizes="180x180"/>`
3. **Code Splitting & Performance Lighthouse >= 90 (`vite.config.ts` & `App.tsx`)**:
   - Aplicar `React.lazy` + `Suspense` para `BoardScreen` e `CharacterCreatorScreen` no `App.tsx` (mantendo o bundle crítico do Lobby/Espera enxuto, sem carregar `pixi.js` na primeira pintura).
   - Configurar `build.rollupOptions.output.manualChunks` separando:
     - `pixi-vendor` (`pixi.js`)
     - `animation-vendor` (`gsap`)
     - `audio-vendor` (`howler`)
     - `network-vendor` (`@colyseus/sdk`)
   - Atualizar o build em `apps/client/dist` como parte de `pnpm build`.
4. **Refinamento Multitoque, Viewport Mobile e WebGL Context Recovery**:
   - **`BoardScene.ts`**:
     - Elevar `DRAG_THRESHOLD_PX` de `6` para **`8`** (`8px`).
     - Introduzir flag `pinchLockedUntilRelease` (`boolean`): ao detectar `this.pointers.size >= 2`, marcar `pinchLockedUntilRelease = true`, cancelar qualquer `press.entity` pendente e **impedir que `click()` dispare até todos os dedos serem levantados** (`this.pointers.size === 0`).
     - Limpar `pinchDistance = 0`, `pointers`, `press` e `pinchLockedUntilRelease = false` em `pointerCancel` e `visibilitychange`.
     - Garantir inércia suave pós-pan com clamp de velocidade e interrupção imediata ao próximo `pointerDown`.
   - **`PixiApp.ts`**:
     - Registrar listeners `webglcontextlost` (`event.preventDefault()`, `this.app.ticker.stop()`, callback/aviso de recuperação) e `webglcontextrestored` (`this.app.ticker.start()` e re-renderização segura) no `this.app.canvas`.
   - **CSS App-Shell & Alvos Táteis (`style.css`, `board.css`, `combat.css`)**:
     - Definir `height: 100dvh` (com fallback `100vh`) e `overscroll-behavior: none` em `html, body` para eliminar pull-to-refresh e efeito elástico no Safari/Chrome mobile.
     - Aplicar `env(safe-area-inset-top)` e `env(safe-area-inset-bottom)` nas barras fixas e gavetas inferiores (Bottom Sheets / `battle-dock`).
     - Corrigir todos os controles interativos abaixo de `44px` encontrados na auditoria (`.board-controls button` no `@media(max-width:850px)`, `.combat-submenu .submenu-close`, `.referee-bar button` e `.referee-bar summary`) para `min-width: 44px; min-height: 44px;`.

---

### Pilar 5 — Suíte E2E Completa, Lighthouse CI e Playtest Final ("Mesa Zero")

1. **Ajuste de `playwright.config.ts`**:
   - Remover o fallback hardcoded do Windows (`C:/Program Files/...`) usando `...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})` para executar nativamente no Chromium do Playwright no Linux/CI e continuar aceitando `CHROME_PATH` no Windows.
2. **Testes Automatizados da Fase 6**:
   - **Regressão de Migrações (`apps/server/tests/database.test.ts`)**: Aplicar sequencialmente `0000` -> `0005` com registros mockados em cada etapa (`rooms`, `players`, `characters`, `maps`, `combat_encounters`, `inventories`, `crash_recovery_checkpoints`), validando zero violações de FK e funcionamento de `pnpm db:sanitize` (`integrity_check === 'ok'`).
   - **Crash Recovery `kill -9` (`tests/e2e/crash-recovery.spec.ts`)**:
     - Sobe host em processo filho isolado apontando para banco WAL temporário.
     - Conecta Mestre + 2 jogadores (desktop + viewport mobile `390x844`), cria fichas, inicia combate, desfere ataque (alterando HP/MP) e alterna um monstro para IA automática.
     - Mata o servidor abruptamente com `SIGKILL` (`kill -9`).
     - Reinicia o servidor no mesmo banco SQLite WAL; Mestre faz login e recebe o modal *"Sessão anterior interrompida. Deseja restaurar de onde parou?"*.
     - Mestre clica em `[ Restaurar Sessão ]`; jogadores reconectam automaticamente e o teste confirma rodada, turno, HP, MP, Ouro e modo IA preservados sem duplicar ações.
   - **PWA, Áudio & Multi-Touch (`tests/e2e/pwa-audio-touch.spec.ts`)**:
     - Valida `manifest.json`, registro do Service Worker e entrega de assets via cache (`CacheFirst`).
     - Valida desbloqueio de áudio no primeiro toque, persistência de `df_audio_prefs` (`localStorage`), slider/mute e envio de `MASTER_NARRATIVE_SFX` recebido pelos jogadores.
     - Simula gesto de **pinch-to-zoom** com 2 ponteiros em `BoardScene` (via CDP/Playwright touchscreen) e garante que nenhum `REQUEST_MOVE` acidental é disparado.
   - **Auditoria Lighthouse Automatizada (`pnpm test:lighthouse`)**:
     - Script/teste com `lighthouse` / `@lhci/cli` ou `playwright-lighthouse` contra o build `dist` servido em `localhost`, verificando Performance `>= 90`, Accessibility `>= 90` e critérios completos de PWA (manifest, ícones `any` + `maskable`, `apple-touch-icon`, Service Worker e fallback offline/cache).
3. **Playtest Final — "Mesa Zero" (90 a 120 minutos)**:
   - Execução real com `pnpm db:sanitize && pnpm start:host` via Cloudflare Quick Tunnel: 1 Mestre no PC + 3–4 jogadores em celulares reais (Wi-Fi e 4G/5G), validando criação de personagens, 3 câmaras com névoa, 1 combate manual + 1 combate em modo IA/misto, comércio com NPC, áudio mobile/iOS/Android e simulação controlada de reconexão/crash.

---

## 3. Ordem Recomendada de Execução na Fase 6

1. **Etapa 1 — Banco & Sanitização**: `0005_finalize_mvp_schema.sql`, índices compostos, `PRAGMA` WAL em `db/index.ts`, `sanitizeDb.ts` (`pnpm db:sanitize`) e teste de regressão `0000 -> 0005`.
2. **Etapa 2 — Crash Recovery Autoritativo**: `crashRecoveryService.ts`, remoção do `removePlayer` no boot de `GameRoom.ts`, comando `MASTER_CLOSE_SESSION`, fluxo `HAS_INTERRUPTED_SESSION` + `RecoveryModal.tsx` e reconexão automática no `colyseusClient.ts`.
3. **Etapa 3 — Áudio Imersivo Howler.js**: Pipeline gerador de `sfx-sprite.webm`/`.mp3` + BGMs, `useAudioStore.ts`, `soundManager.ts` (iOS unlock + `visibilitychange` + crossfade) e `MASTER_NARRATIVE_SFX`.
4. **Etapa 4 — PWA Vite 8, Performance & Ergonomia Touch**: `vite-plugin-pwa >= 2.0.0`, `manifest.json`, ícones `192/512/maskable/apple-touch-icon`, lazy-loading + `manualChunks`, correções multitoque `8px`/pinch lock em `BoardScene.ts`, `webglcontextlost` em `PixiApp.ts`, `100dvh`/`overscroll-behavior`/`safe-area` e alvos `>= 44px`.
5. **Etapa 5 — E2E Completo, Lighthouse & Mesa Zero**: Ajuste do `playwright.config.ts`, suíte `crash-recovery.spec.ts` (`SIGKILL`), `pwa-audio-touch.spec.ts`, auditoria Lighthouse `>= 90` e checklist final da Mesa Zero.

---

## 4. Critérios de Conclusão (`v1.0.0`)

- [ ] `pnpm build` gera `apps/client/dist` com `manifest.json`, ícones (`any`, `maskable`, `180x180`), Service Worker Workbox (`CacheFirst` para assets/áudio e `NetworkOnly` para Colyseus/API) e chunks separados (`pixi-vendor`, `animation-vendor`, `audio-vendor`).
- [ ] `kill -9` durante combate ativo com IA/itens não corrompe o SQLite, dispara o modal de restauração ao Mestre no reinício e reconecta jogadores preservando turno, HP, MP, Ouro e modo manual/IA sem duplicar ações.
- [ ] Áudio funciona no primeiro toque no iOS Safari e Android Chrome, retoma após `visibilitychange`, faz crossfade suave entre exploração e combate POV, e propaga `MASTER_NARRATIVE_SFX` sincronizado.
- [ ] `BoardScene` separa *pinch-to-zoom* de *tap* (`8px` + lock multi-touch até soltar todos os dedos), todos os botões mobile respeitam `>= 44x44px` e `overscroll-behavior: none` bloqueia pull-to-refresh acidental.
- [ ] Regressão de migrações (`0000 -> 0005`), `pnpm db:sanitize`, suíte Playwright (incluindo `SIGKILL` crash recovery) e auditoria Lighthouse (Performance `>= 90`, PWA completo) passam integralmente antes do playtest **Mesa Zero**.
