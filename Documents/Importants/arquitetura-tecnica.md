# Arquitetura Técnica & Especificação de Engenharia — Dungeons & Friends

Este documento estabelece as decisões técnicas, a stack tecnológica, a organização de arquivos/pastas e o planejamento detalhado para a implementação do **Dungeons & Friends**.

---

## 1. Resumo da Stack Tecnológica (Versões Atuais & Estáveis)

| Camada / Função | Tecnologia Escolhida | Versão Recomendada | Justificativa Técnica |
| :--- | :--- | :--- | :--- |
| **Linguagem Base** | TypeScript | `^5.7.x` | Tipagem estrita de ponta a ponta compartilhando contratos de dados e regras matemáticas. |
| **Monorepo Manager** | pnpm Workspaces | `^10.x` / `^12.x` | Gerenciamento ultrarrápido com symlinks rígidos, separando `packages/` e `apps/`. |
| **Runtime do Servidor**| Node.js LTS | `v24` / `v26 LTS` | Amplo suporte ao ecossistema nativo de C++ (`better-sqlite3`) e WebSockets estáveis. |
| **Servidor Multiplayer**| Colyseus | `^0.18.12` | Schema 5.0 com sincronização diferencial automática (deltas), salas (código de 5 dígitos) e reconexão nativa por token. |
| **Túnel de Rede Solo** | Cloudflare Quick Tunnel | `cloudflared CLI` | Script de 1 comando (`pnpm start:host`) gerando URL HTTPS/WSS pública gratuita (`trycloudflare.com`) sem abrir portas. |
| **Banco de Dados Local**| SQLite + Drizzle ORM | `better-sqlite3` + `drizzle-orm` | Arquivo único `.db`, transações ACID síncronas com modo WAL, à prova de crash de sessão e tipagem segura no TypeScript. |
| **Motor Gráfico 2D** | PixiJS | `^8.22.0` | Renderização WebGPU / WebGL2 ultra veloz para grid hexagonal, névoa suave com shaders, arena POV e Character Creator modular. |
| **Interface de Usuário**| React + Vite | `React 19.3` + `Vite 8.3` | HUD overlay tátil, menus de combate responsivos, bottom sheets para mobile e integração com o canvas do PixiJS. |
| **Estilização** | Tailwind CSS | `^4.3.5` | Motor Oxide ultrarrápido, configuração CSS-first nativa (`@theme`) e estilos temáticos táteis medieval-fantasia. |
| **Animações & "Juice"**| GSAP | `^3.15.1` | Timelines precisas para transições de câmera entre câmaras, dados 2D rolando, números flutuantes e screen shake. |
| **Estado Global do Cliente** | Zustand | `^5.0.x` | Gerenciamento de estado de 1kb, sem boilerplate, acessível dentro e fora do React (direto no PixiJS e Colyseus sem re-render). |
| **Sistema de Áudio** | Howler.js | `^2.2.4` | Sprites de áudio (dezenas de SFX em 1 arquivo leve), fade suave entre exploração e batalha POV, canais (Master, SFX, BGM). |
| **Suporte Mobile & PWA**| vite-plugin-pwa | `^1.x` (Workbox) | Cache-First para spritesheets e sons (carregamento instantâneo), manifesto standalone e suporte a toque (pinch, pan). |

---
 
## 2. Estrutura Completa de Pastas e Arquivos (Monorepo pnpm)

```text
dungeons-and-friends/
├── package.json                   # Scripts globais do monorepo (build, dev, start:host)
├── pnpm-workspace.yaml            # Configuração das workspaces (apps/*, packages/*)
├── tsconfig.base.json             # Configuração TypeScript compartilhada (strict: true)
├── .gitignore
├── README.md
│
├── packages/
│   └── shared/                    # Código compartilhado entre apps/client e apps/server
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts           # Ponto de exportação unificado
│           ├── hex/               # Matemática e Grid Hexagonal (Pointy-Topped)
│           │   ├── coordinates.ts # Coordenadas Axiais (q, r) e Cúbicas (x, y, z)
│           │   ├── distance.ts    # Cálculo de distância em cubo e anéis de alcance
│           │   ├── pathfinding.ts # Algoritmo A* Hexagonal com pesos de terreno
│           │   └── fov.ts         # Linha de Visada (Bresenham / Shadowcasting 4 tiles)
│           ├── rules/             # Regras do Jogo e Fórmulas de RPG
│           │   ├── stats.ts       # Atributos, modificadores, HP, MP, Defesa, Esquiva
│           │   ├── pointBuy.ts    # Validador de Point Buy (27 pontos, limites 8-15)
│           │   ├── races.ts       # Dados das 8 raças e passivas oficiais
│           │   ├── classes.ts     # Arquétipos e habilidades ativas
│           │   ├── items.ts       # Catálogo de armas (1 mão, 2 mãos), escudos e poções
│           │   └── spells.ts      # Catálogo de feitiços (Dardo, Explosão, Cura, Raio)
│           ├── combat/            # Mecânicas de Combate e Resolução
│           │   ├── damage.ts      # Fórmulas de dano, DR, crítico e mitigação
│           │   └── actions.ts     # Ações: Atacar, Defender, Itens, Fugir
│           └── schema/            # Schemas e Tipos de Sincronização Colyseus / Zod
│               ├── PlayerSchema.ts
│               ├── MonsterSchema.ts
│               ├── ChamberSchema.ts
│               ├── RoomState.ts
│               └── packets.ts     # DTOs de mensagens e comandos do Mestre
│
├── apps/
│   ├── server/                    # Servidor Autoritativo Node.js + Colyseus
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── drizzle.config.ts      # Configuração de migrações Drizzle
│   │   └── src/
│   │       ├── index.ts           # Entrypoint do servidor Colyseus
│   │       ├── tunnel.ts          # Script orquestrador do Cloudflare Quick Tunnel
│   │       ├── db/                # Persistência Local SQLite
│   │       │   ├── index.ts       # Conexão better-sqlite3 + Drizzle (WAL mode)
│   │       │   ├── schema.ts      # Tabelas: salas, jogadores, fases, estado de sessão
│   │       │   └── migrations/    # Arquivos de migração SQL
│   │       ├── rooms/             # Salas Colyseus
│   │       │   ├── GameRoom.ts    # Lógica principal da sala de jogo (código 5 dígitos)
│   │       │   ├── handlers/      # Controladores de mensagens
│   │       │   │   ├── auth.ts    # Entrada, fila de aprovação e reconexão por token
│   │       │   │   ├── movement.ts# Movimento autoritativo (cooldown 30s / FCFS)
│   │       │   │   ├── combat.ts  # Máquina de estados de combate POV
│   │       │   │   ├── master.ts  # Comandos de edição, spawn, revelar ocultos
│   │       │   │   └── shop.ts    # Transações de compra e venda em NPCs
│   │       │   └── ai/            # IA dos Monstros no Servidor
│   │       │       └── tacticalAi.ts # IA de proximidade (corpo a corpo vs longo alcance)
│   │       └── services/
│   │           ├── diceService.ts # Sorteador determinístico d4..d100
│   │           └── fovService.ts  # Culling e filtragem de entidades por câmara
│   │
│   └── client/                    # Frontend React 19 + PixiJS v8 + PWA
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts         # Configuração Vite com PWA e Tailwind v4
│       ├── index.html
│       ├── public/
│       │   ├── manifest.json      # Manifesto PWA Standalone
│       │   ├── icons/             # Ícones do App (192px, 512px, maskable)
│       │   ├── audio/             # Spritesheets de áudio (.webm / .mp3)
│       │   └── assets/            # Sprites modulares do Character Creator e Terrenos
│       └── src/
│           ├── main.tsx           # Entrypoint React
│           ├── App.tsx            # Roteador de telas (Login, Espera, Criador, Tabuleiro)
│           ├── store/             # Estado Global Zustand
│           │   ├── useGameStore.ts # Estado da sessão, sala e conexão Colyseus
│           │   ├── useUIStore.ts   # Modais abertos, gavetas ativas, preferências
│           │   └── useAudioStore.ts# Volumes (Master, SFX, BGM) e gatilhos de áudio
│           ├── network/           # Cliente Colyseus
│           │   └── colyseusClient.ts # Conexão, listeners de state e reconexão
│           ├── audio/             # Gerenciador Howler.js
│           │   └── soundManager.ts # Playbacks de SFX, crossfade BGM exploração/combate
│           ├── components/        # Componentes de Interface do Usuário (HUD / React)
│           │   ├── common/        # Botões táteis, gavetas (Bottom Sheets), modais
│           │   ├── lobby/         # Tela inicial (código de sala, fila de espera)
│           │   ├── character/     # Criador de Personagem (Point Buy + Modular Preview)
│           │   ├── hud/           # Barra de vida/mana, atalhos, chat efêmero (7s)
│           │   ├── combat/        # Arena POV Overlay (botões Atacar/Defender/Itens/Fugir)
│           │   ├── master/        # Sidebar de fases, paleta de edição, barra de árbitro
│           │   └── dice/          # Bandeja animada de dados 2D
│           └── game/              # Motor Gráfico PixiJS v8
│               ├── PixiApp.ts     # Inicialização da Application (WebGPU/WebGL)
│               ├── scenes/
│               │   ├── BoardScene.ts   # Renderização do tabuleiro hexagonal e câmaras
│               │   └── CombatPOVScene.ts # Renderização frontal dos monstros e fundo
│               ├── layers/
│               │   ├── TerrainLayer.ts # Células hexagonais de chão e água
│               │   ├── WallLayer.ts    # Paredes e obstáculos conectáveis
│               │   ├── ObjectLayer.ts  # Mesas, cadeiras, baús e decorações
│               │   ├── EntityLayer.ts  # Tokens de jogadores, monstros e NPCs
│               │   └── FogOfWarLayer.ts# RenderTexture com máscara de iluminação suave
│               ├── vfx/
│               │   ├── combatEffects.ts# Cortes de lâmina, tremores, fogo e gelo
│               │   ├── floatingText.ts # Dano vermelho, crítico dourado, 'Esquivou!'
│               │   └── diceAnimation.ts# Rolagem 2D sincronizada pousando no número
│               └── characterCreator/
│                   ├── ModularRenderer.ts # Composição de camadas de sprite com tinting
│                   └── TokenExporter.ts   # Extração do Retrato HD e Token Circular
```

---

## 3. Planejamento Detalhado por Subsistema

### 3.1 Servidor Solo & Automação Cloudflare Quick Tunnel
- **Objetivo**: Permitir que o desenvolvedor/Mestre suba todo o ambiente de multiplayer com um único comando sem abrir portas de modem nem pagar hospedagem externa durante os testes.
- **Implementação (`apps/server/src/tunnel.ts`)**:
  - Script executado via `pnpm start:host`.
  - Inicia o servidor Colyseus na porta local `2567`.
  - Executa em subprocesso o comando `cloudflared tunnel --url http://localhost:2567`.
  - Escuta a saída padrão (stdout) via regex para capturar a URL pública temporária `https://[subdominio].trycloudflare.com`.
  - Imprime a URL de conexão com destaque e renderiza um **QR Code ASCII no terminal**, permitindo que o Mestre aponte a câmera do celular para entrar na sala instantaneamente.
  - O Colyseus implementa heartbeat de ping/pong a cada 20 segundos para impedir que o Cloudflare encerre a conexão WebSocket por inatividade (timeout padrão de 100s do Cloudflare).

### 3.2 Rede, Sincronização e Reconexão (Colyseus v0.18)
- **Sala (`GameRoom`)**:
  - Cada partida é identificada por um **Código de Sala de 5 caracteres** (ex: `K8X2M`).
  - O estado do jogo é definido pelo `RoomState` (Schema 5.0) contendo coleções sincronizadas: `players`, `monsters`, `chambers`, `combatState`.
- **Fila de Espera e Entrada Segura**:
  - Quando um jogador se conecta com nome e código da sala, seu status inicial no schema é `PENDING_APPROVAL`.
  - O Mestre recebe notificação com botões `[Aprovar]` ou `[Recusar]`.
  - Ao ser aprovado, o servidor gera um `sessionToken` persistido no SQLite e no `localStorage` do jogador.
- **Reconexão Transparente**:
  - Se a rede do celular oscilar (ex: troca de Wi-Fi para 4G), o cliente envia `client.reconnect(roomId, sessionToken)`.
  - O servidor reconhece o token, preserva a posição exata do jogador no hexágono anterior e reenvia o estado da câmara sem duplicar o personagem.

### 3.3 Persistência Local e Recuperação de Sessão (SQLite + Drizzle)
- **Configuração**:
  - Driver `better-sqlite3` rodando em modo síncrono ultra veloz com `PRAGMA journal_mode = WAL;`.
  - Banco em arquivo único local `dungeons.db`.
- **Tratamento de Crash Recovery**:
  - A cada alteração de mapa ou movimento de token, o estado consolidado é gravado.
  - Ao iniciar uma sessão, a tabela `sessions` armazena a flag `status = 'ACTIVE'`.
  - Se o servidor fechar inesperadamente sem o Mestre clicar em "Encerrar Sessão", na próxima inicialização o sistema detecta `status = 'ACTIVE'` e exibe o alerta: *"Sessão anterior interrompida. Deseja restaurar de onde parou?"*.

### 3.4 Sistema de Mapa Hexagonal e Câmaras Contíguas
- **Geometria Hexagonal**:
  - Hexágonos **Pointy-Topped (`⬢`)** em coordenadas cúbicas `(x, y, z)` onde `x + y + z = 0`, convertidas internamente para axiais `(q, r)` para armazenamento.
  - Conversão de coordenadas em tela (pixels) para hexágono e vice-versa implementada no `packages/shared/src/hex/coordinates.ts`.
- **Câmaras Contíguas (Estilo Zelda)**:
  - O mapa completo é subdividido em estruturas lógicas chamadas `Chamber`.
  - Cada câmara possui suas dimensões e coordenadas de portais/passagens de saída.
  - **Transição de Câmera Deslizante**: Quando um jogador pisa no hexágono de passagem que liga à câmara vizinha, o GSAP interpola a posição da câmera do PixiJS com easing cúbico suave (`ease: "power2.inOut"`, duração de 0.6s) enquadrando a nova sala.
  - **Macro View do Mestre**: O Mestre tem um botão de alternância entre "Visão Focada" e "Visão Macro Panorâmica", que ajusta o zoom do PixiJS para ver todo o complexo de masmorras simultaneamente.

### 3.5 Névoa de Guerra (FOV / LOS) e Culling de Dados
- **Algoritmo Autoritativo no Servidor**:
  - O servidor calcula a visibilidade de cada jogador aplicando algoritmo de linha de visada em raio de até **4 hexágonos**.
  - Paredes e obstáculos intransponíveis bloqueiam o raio de visão.
  - **Culling Rígido de Dados**: O servidor NUNCA envia aos clientes monstros, armadilhas ou baús que estejam fora do raio de visão ativa (4 hexágonos) ou em outras câmaras. Isso impede que jogadores usem ferramentas de inspeção do navegador para trapacear.
- **Renderização Visual no PixiJS**:
  - O `FogOfWarLayer` utiliza uma `RenderTexture` com blend mode multiplicado.
  - Hexágonos nunca vistos permanecem 100% pretos (`UNEXPLORED`).
  - Hexágonos sob a visão ativa dos jogadores (4 tiles) recebem iluminação clara com bordas suaves via gradiente circular.
  - Hexágonos já explorados, quando os jogadores se afastam, continuam visíveis em tom sombreado/acinzentado (50% de opacidade/tint) permitindo navegação, mas sem exibir monstros ou tokens ocultos (`EXPLORED_INACTIVE`).
  - Ao trocar de câmara, a memória da câmara anterior apaga e volta a ser escuridão total.

### 3.6 Character Creator 2D Modular
- **Anatomia Base e Camadas**:
  - Todas as 8 raças compartilham a base anatômica humana/humanoide (estilo anime/fantasia estilizada).
  - Cada peça modular (cabelos, olhos, chifres, presas, orelhas, barbas, cicatrizes) é composta por 2 assets:
    1. Camada de Sombreamento (Escala de cinza neutra).
    2. Camada de Contorno / Lineart (Preto translúcido / traço nítido).
- **Color Tinting Dinâmico**:
  - No PixiJS, a camada de sombreamento recebe a cor RGB selecionada pelo jogador (ex: pele pálida para Vampiro, avermelhada para Demônio, cabelos coloridos) via propriedade `sprite.tint`. A lineart é renderizada por cima.
- **Exportação com 1 Clique**:
  - Ao finalizar a ficha, o PixiJS renderiza e extrai dois arquivos WebP compactados usando `app.renderer.extract.canvas`:
    1. **Retrato HD (512x512px)**: Exibido na ficha e nos cards de combate POV.
    2. **Token Circular (128x128px)**: Token redondo transparente com borda temática para visualização no tabuleiro hexagonal.

### 3.7 Arena de Combate POV (Perspectiva Frontal JRPG + VFX)
- **Transição de Cena**:
  - Ao iniciar o combate (seja por proximidade de 1-2 hexágonos confirmada pelo Mestre ou acionamento manual), o cliente transita suavemente para a `CombatPOVScene`.
  - O cenário de fundo é carregado de acordo com o bioma atual (ex: fundo de caverna rochosa, floresta úmida, taverna rústica).
- **Disposição POV & Animações**:
  - **Monstros**: Renderizados no centro da tela em visão frontal, com animação sutil de respiração (*idle breathing*) via GSAP. Retícula de mira ao clicar para atacar.
  - **Status do Jogador**: No canto inferior, card temático com HP, MP e retrato HD.
  - **Cards de Aliados**: Alinhados lateralmente para seleção de cura/buffs.
  - **Botões Tácteis no React**: `[⚔️ Atacar]`, `[🛡️ Defender]`, `[🎒 Itens]`, `[🏃 Fugir]` com submenus para armas, feitiços e poções.
- **VFX e Feedback Tátil ("Juice")**:
  - Efeitos específicos por golpe (Corte de lâmina, Tremor de impacto, Chamas, Gelo, Luz).
  - Números flutuantes de dano (vermelho para dano comum, dourado ampliado com *screen shake* para acertos críticos, azul para *"Esquivou!"*, ícone de escudo para DR).
  - Barra de Árbitro do Mestre no topo com controles soberanos (pausar combate, forçar fuga 100%, ligar IA dos monstros ou assumir o turno manual).

### 3.8 Monstros, IA Tática Hexagonal (A*) e NPCs Mercadores
- **Navegação A* no `packages/shared`**:
  - Algoritmo A* adaptado para coordenadas cúbicas com distância Manhattan em cubo `(abs(dx) + abs(dy) + abs(dz)) / 2`.
  - Valida células transitáveis (ignora paredes e água profunda) e respeita a regra FCFS de não-sobreposição.
- **Modo Automático da IA**:
  - Monstros corpo a corpo localizam o jogador mais próximo, avançam até o alcance de adjacência e desferem o golpe físico. Se não alcançarem, movem o máximo possível até a distância de proximidade.
  - Monstros de longo alcance/magos mantêm distância ideal de 3-4 hexágonos com linha de tiro desobstruída. Se um jogador colar neles, tentam recuar antes de disparar.
- **Lojas de NPCs**:
  - Adjacência com NPC abre o modal com abas **Comprar** (catálogo configurado pelo Mestre) e **Vender** (50% do valor de mercado).

### 3.9 Sistema de Áudio (Howler.js + Audio Sprites)
- **Otimização para Dispositivos Móveis**:
  - Efeitos sonoros empacotados em um **Sprite de Áudio único** (`sfx.webm` / `sfx.mp3`), contendo marcadores de tempo para rolagens de dados, passos, cortes de espada, magias e esquivas. Isso elimina dezenas de requisições HTTP e garante reprodução instantânea sem delay no celular.
- **Transição Musical Dinâmica (BGM)**:
  - Howler.js gerencia o crossfade suave entre a música de exploração da masmorra e a música tensa de combate POV ao iniciar o encontro.
- **Canais Independentes**:
  - `MasterVolume`, `MusicVolume`, `SfxVolume` controlados pelo usuário.
  - SFX Narrativo do Mestre: O Mestre pode enviar um evento de áudio (ex: estrondo de porta se abrindo, relâmpago) sincronizado em tempo real para todos os jogadores.

### 3.10 PWA, Desempenho e Responsividade Mobile
- **Service Worker com Workbox (`vite-plugin-pwa`)**:
  - Estratégia **Cache-First** para texturas de terreno, spritesheets do character creator, áudio e fontes.
  - Estratégia **Network-First** para APIs de autenticação e WebSockets do Colyseus.
- **Adaptação Tátil**:
  - Painéis do Mestre e fichas de personagens recolhem em botões flutuantes (FAB) e abrem como **Gavetas Inferiores (Bottom Sheets)** deslizantes no celular, preservando o tabuleiro limpo para interação.
  - Suporte a gestos touch (arrastar para pan, pinça para zoom).
  - Alvos de clique de no mínimo 44x44px em todos os botões e hexágonos.
