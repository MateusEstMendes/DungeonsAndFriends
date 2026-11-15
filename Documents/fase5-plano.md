# Plano de Implementação — Fase 5 (`v0.5.0`): Economia, Itens, NPCs, Grimório, Perspectiva do Mestre e IA Tática

Este plano consolida todas as decisões arquiteturais alinhadas durante a revisão de [Fase5.md](Fase5.md), [especificacao-telas.md](especificacao-telas.md) e [controle-mestre-monstros-ia.md](controle-mestre-monstros-ia.md).

---

## 1. Decisões Arquiteturais Consolidadas

1. **Etapa 0 como pré-requisito dentro da Fase 5**: Os ajustes pendentes de perspectiva do Mestre vs. Heróis e a identificação clara de atacante/alvo e impacto visual por perspectiva (seções 4.1 e 4.4 de [controle-mestre-monstros-ia.md](controle-mestre-monstros-ia.md)) entram no início da Fase 5 antes da IA Tática.
2. **Combate JRPG por Turnos (sem `rangeHex` nem movimento em grid no combate)**:
   - Como o combate segue o formato JRPG/Pokémon frontal por turnos, **armas e magias ignoram `rangeHex`** durante a batalha.
   - `IGNEOUS_BLAST` (*Explosão Ígnea*) atua como **ataque em área JRPG** na Arena POV (atingindo todos os inimigos vivos do lado oposto — ou alvo principal + adjacentes da fila conforme o encontro — e aplicando VFX de área).
   - **Limpeza de Código**: Remover funções, campos, parâmetros e stubs não utilizados (ex.: `rangeHex` em itens/magias e na validação de combate, stubs hardcoded da Fase 4 como `potions: 2` e listas fixas de ataques em `CombatOverlay.tsx` e `combat.ts`), preservando `findHexPath` e `computeHexFOV` exclusivamente na exploração do tabuleiro e culling autoritativo de névoa.
3. **Defesa (CA) e `damageDice` Reais no Combate**:
   - Conectar `defense` (`10 + mod_DES` + bônus de armadura/escudo/raça) em `resolveAttack` (`packages/shared/src/combat/damage.ts`): se `attackRoll < defender.defense` (e não for acerto crítico natural), o ataque erra (`MISSED_DEFENSE`, 0 de dano).
   - Armas equipadas passam a rolar dados reais (`damageDice`, ex.: `1d8`, `2d6`) somados aos modificadores e buffs (`THE_JUICE` `1.20x` físico, `MAGIC_BOOK` `+bônus` mágico).
4. **IA Tática por Turnos (`tacticalAi.ts`)**:
   - Sem movimentação no grid durante o combate: `MELEE` foca alvos e executa ataques físicos; `RANGED`/Mago alterna entre ataques mágicos/à distância e cura/buff conforme HP/MP. Nunca foge sem `allowAutoFlee === true`.
   - Monstros começam em **Manual** por padrão; a chave global de IA altera todos os monstros (e define o padrão para novos monstros adicionados), com override individual por criatura.
   - Se o Mestre desconectar, os turnos de monstros (manuais e IA) pausam aguardando reconexão. Se um monstro em IA não possuir ação válida, executa `ACTIVE_DODGE` ou passa o turno com registro no Log. A IA aguarda a janela de animação (`~1.2s`) entre ações.
5. **Economia, Baús, `NPC_MERCHANT` e Ícones**:
   - `NPC_MERCHANT` posicionável pelo Mestre no `BoardEditor.tsx` (salvo em `placed_objects`), criando automaticamente registro editável em `npc_shops`; `CHEST` cria registro editável em `chests` com loot padrão.
   - Substituir `potions: 2` e ataques fixos da Fase 4 por inventário, equipamentos (`mainHand`, `offHand`, `armor`) e grimório reais no SQLite, mantendo habilidades de assinatura dos arquétipos (`WARRIOR`, `BARBARIAN`, `ROGUE`). Fichas novas e migradas recebem kit inicial por arquétipo + `50G` (e 2 magias iniciais para Mago e Clérigo).
   - Ícones SVG/Canvas leves inspirados nos exemplos de `DesignEX/WeaponEx`, `DesignEX/ArmorEx` e `DesignEX/MagicImageEx` (sem embutir os `.jpg` brutos no bundle).
   - Atalhos `[🎒 Ficha/Mochila]`, `[🎲 Dados]` (`ROLL_DICE` `d4..d100`), `[📜 Log]` (`CombatLogDrawer`) e Chat Efêmero (`7s`, sem persistência em SQLite) integrados na HUD do Tabuleiro e no Combate para Jogadores e Mestre.

---

## 2. Etapas de Implementação

### Etapa 0 — Separação de Perspectiva do Mestre, Alvos e Feedback Visual de Dano
> Resolve os pontos 4.1 e 4.4 de [controle-mestre-monstros-ia.md](controle-mestre-monstros-ia.md) antes de adicionar novos submenus de itens/magias e IA automática.

- **Estado e Identificação de Participantes (`apps/server` & `packages/shared`)**:
  - Garantir numeração/etiqueta única para monstros iguais no snapshot `COMBAT_ROSTER` (ex.: `Goblin 1`, `Goblin 2`) mantendo o nome de catálogo para lookup.
  - Enriquecer `COMBAT_EVENT` com `actorName`, `actorKind`, `targetName`, `targetKind` e lista de alvos atingidos (para suportar AoE).
- **Perspectiva do Mestre vs. Herói (`CombatOverlay.tsx`, `MasterRefereeBar.tsx`, `CombatPOVScene.ts`)**:
  - Na tela do Mestre: separar **participante ativo na iniciativa** (`activeParticipantId`), **monstro selecionado para comando/inspeção** (`selectedMonsterId`) e **alvo da ação** (`targetId`). Trocar o monstro selecionado revalida/limpa o alvo e fecha submenus abertos.
  - No turno de um herói, a tela do Mestre exibe estado de observação/arbitragem (*"Observando turno de [Herói]"*), sem renderizar comandos de ação do herói.
  - No turno de um monstro manual, destacar *"Controlando: [Criatura]"*, exibir exclusivamente os ataques/habilidades da criatura e listar os heróis como alvos (ou aliados monstros para cura/proteção).
  - Na visão dos jogadores e do Mestre: exibir indicação clara de atacante e alvo (*"Goblin 2 ataca Ael"*), destacar o card do aliado atingido e disparar efeito visual de impacto na visão/retrato do próprio jogador quando ele sofrer dano (diferenciando visualmente `HIT`, `CRITICAL`, `MISSED_DEFENSE`, `DODGED_*`, `DR` absorvido e `HEALED`, respeitando `prefers-reduced-motion` em `motion.ts`).

---

### Etapa 1 — Catálogos, Regras de Equipamentos/Magias e Limpeza de Código (`packages/shared`)

- **Limpeza de Código (`packages/shared`, `apps/server`, `apps/client`)**:
  - Auditar e remover quaisquer campos/funções não utilizados relacionados a `rangeHex` em itens/magias e stubs provisórios da Fase 4 após migrar para os novos módulos.
- **Criar `packages/shared/src/rules/items.ts`**:
  - Catálogo canônico tipado (`ITEM_CATALOG`) cobrindo:
    - **Armas 2 Mãos (`TWO_HANDED`)**: Espada Grande (`2d6` `SLASHING`), Machado de Batalha (`1d12` `SLASHING`), Lança Longa (`1d10` `THRUST`). Forçam `offHand = null`.
    - **Armas 1 Mão (`ONE_HANDED`)**: Espada Curta (`1d6` `SLASHING`), Adaga (`1d4` `THRUST`), Maça (`1d6` `BLUNT`). Permitem Escudo ou *Dual Wielding* em `offHand`.
    - **Longo Alcance (`RANGED`)**: Arco Curto (`1d6` `THRUST`), Besta (`1d8` `THRUST`) — sem checagem de distância no combate JRPG.
    - **Escudos (`SHIELD`, slot `OFF_HAND`)**: Escudo de Madeira (`+2 Defesa`), Escudo de Aço (`+3 Defesa`, `+1 DR`).
    - **Focos Mágicos (`MAGIC_FOCUS`)**: Cajado Arcano (`TWO_HANDED`), Varinha (`ONE_HANDED`), Foco Divino (`ONE_HANDED`) — requisito obrigatório para canalizar magias do grimório.
    - **Armaduras (`ARMOR`)**:
      - `LIGHT` (Couro Batido): `+2 Defesa`, mantém `mod_DES` integral, `+5% Esquiva` (respeitando teto de 20%).
      - `MEDIUM` (Cota de Malha): `+4 Defesa`, limita `mod_DES` na Defesa a `max(+2)`.
      - `HEAVY` (Armadura de Placas): `+7 Defesa`, `+2 DR`, `-2 DES` (aplicado ao `finalDex` recalculando `dexMod`, `speed` e `dodgeChance`) e `-10% Esquiva`.
    - **Consumíveis (`CONSUMABLE`)**: Poção de Vida (`+25 HP`), Poção de Mana (`+20 MP`), Antídoto (remove `POISON`), Livro Mágico (`+4` dano mágico por 2 rodadas), `'O Suco'` (`1.20x` dano físico por 2 rodadas), Pergaminhos de Feitiço (`SPELL_SCROLL_*`) e Itens Narrativos (`KEY`, `ROPE`, `TORCH`).
  - Funções puras:
    - `equipItemValidator(currentEquipment, newItem)` -> `{ updatedEquipment, unequippedToBag }` (garante regra rígida `1H` vs `2H` e troca de slot).
    - `calculateSellPrice(basePriceGold)` -> `Math.floor(basePriceGold * 0.50)`.
    - `recalculateCharacterStats(baseCharacter, equippedItems)` -> recalcula `finalDex`, `defense`, `dodgeChance` (`<= 20%`), `speed` e `flatDr` sobre os valores base da Fase 2 (`stats.ts`).
    - `getStarterKit(archetypeId)` -> retorna itens iniciais + `50G` + magias iniciais (ex.: Guerreiro: Espada Curta + Escudo de Madeira + Armadura Leve; Bárbaro: Machado de Batalha; Ladino: 2x Adaga + Armadura Leve; Mago: Cajado Arcano + 2 magias; Clérigo: Maça + Foco Divino + 2 magias; todos com `2x Poção de Vida` e `50G`).
- **Criar `packages/shared/src/rules/spells.ts`**:
  - Catálogo canônico (`SPELL_CATALOG`) com as 4 magias essenciais (sem `rangeHex`):
    1. `ARCANE_DART` (*Dardo Arcano*): `4 MP`, alvo único, dano `1d6 + mod_INT` (`ARCANE`).
    2. `IGNEOUS_BLAST` (*Explosão Ígnea*): `10 MP`, **área JRPG** (atinge todos os inimigos vivos do lado oposto na Arena POV), dano `2d6 + mod_INT` (`FIRE`).
    3. `HEALING_LIGHT` (*Luz Curativa*): `6 MP`, aliado único (ou próprio), cura `2d6 + max(0, mod_SAB)` HP.
    4. `FREEZING_RAY` (*Raio Congelante*): `8 MP`, alvo único, dano `1d8 + mod_INT` (`ICE`) + aplica debuff `SLOW` (`-1 Speed` / penalidade na próxima rodada).
  - Validador `canCastSpell(characterEquipment, currentMp, spell)` verificando presença de `MAGIC_FOCUS` em `mainHand` ou `offHand` e `mp >= spell.mpCost`.
- **Atualizar Combate Compartilhado (`packages/shared/src/combat/damage.ts` & `actions.ts`)**:
  - Adicionar `defense: number` em `CombatantStats`.
  - Em `resolveAttack`:
    1. Se `naturalRoll < criticalFrom` e `attackRoll < defender.defense`, retornar `{ outcome: 'MISSED_DEFENSE', finalDamage: 0, ... }`.
    2. Avaliar `ACTIVE_DODGE` e `passiveDodge` (teto 20%).
    3. Aplicar multiplicador físico (`1.20x` para `'O Suco'`) e bônus mágico (`Livro Mágico`), críticos (`2x`), raciais e `flatDR` + escudo.
  - Atualizar `CombatAction` e `validateAction` para suportar `SPELL` (e arma equipada `hand: 'MAIN' | 'OFF'`).
- **Atualizar Contratos Zod e Schemas (`constants.ts`, `packets.ts`, `boardPackets.ts`, `RoomState.ts`, `MonsterSchema.ts`)**:
  - Atualizar `PROTOCOL_VERSION` para `"0.5.0"`.
  - Adicionar `NPC_MERCHANT` em `MasterEditSchema`.
  - Criar schemas Zod para: `EQUIP_ITEM`, `UNEQUIP_ITEM`, `USE_SCROLL`, `OPEN_CHEST`, `LOOT_CHEST_ITEM`, `OPEN_SHOP`, `BUY_ITEM`, `SELL_ITEM`, `MASTER_EDIT_SHOP`, `MASTER_EDIT_CHEST`, `MASTER_GRANT_ITEM`, `MASTER_SET_MONSTER_AI`, `MASTER_SET_GLOBAL_AI`, `CHAT_MESSAGE`, `ROLL_DICE`.
  - Adicionar campos de controle em `CombatStateSchema` (`globalAiEnabled: boolean`) e `MonsterSchema` / snapshot de combate (`isAutoMode`, `allowAutoFlee`).

---

### Etapa 2 — Migração `0004_add_items_economy_spells.sql` e Seeds (`apps/server/src/db`)

- **Atualizar `apps/server/src/db/schema.ts` e gerar `0004_add_items_economy_spells.sql` + snapshot Drizzle**:
  - `characters`: adicionar `gold INTEGER NOT NULL DEFAULT 50` (aditivo, preservando fichas `v0.2.0`-`v0.4.0`).
  - `items_catalog`: metadados canônicos dos itens (`id`, `name`, `category`, `handedness`, `slot`, `basePriceGold`, `damageDice`, `damageType`, `defenseBonus`, `drBonus`, `dexPenalty`, `dodgeMod`, `maxDexBonus`, `effectJson`).
  - `spells_catalog`: metadados das 4 magias iniciais (`id`, `name`, `mpCost`, `targetMode`, `damageDice`, `element`, `effectJson`).
  - `inventories`: `id`, `characterId` (FK `characters.id`), `itemId` (FK `items_catalog.id`), `slot` (`MAIN_HAND` | `OFF_HAND` | `ARMOR` | `BAG`), `quantity` (`>= 1`).
  - `character_grimoire`: `id`, `characterId`, `spellId`, unique `(characterId, spellId)`.
  - `npc_shops`: `objectId` (PK referenciando o NPC em `placed_objects.id`), `npcName`, `dialogue`, `inventoryJson` (lista de `{ itemId, stock }`).
  - `chests`: `objectId` (PK referenciando o baú em `placed_objects.id`), `gold`, `itemsJson` (lista de `{ itemId, quantity }`).
  - `combat_participants`: persistir flags `isAutoMode` e `allowAutoFlee` no `statsJson` para sobreviver à restauração e reconexão do Mestre.
- **Seed Idempotente & Migração de Fichas Existentes**:
  - Popular `items_catalog` e `spells_catalog` via `INSERT OR IGNORE`.
  - Conceder kit inicial + `50G` (e 2 magias iniciais para Mago/Clérigo) para fichas que ainda não possuem entradas em `inventories`.
  - **Integridade de Undo/Redo (`boardRepository.ts`)**: Garantir que `writeBoard` não apague em cascata os registros de `chests` e `npc_shops` ao regravar `placed_objects` durante `UNDO`/`REDO`.

---

### Etapa 3 — Handlers Transacionais de Inventário, Baús, Lojas, Chat e Dados (`apps/server/src/rooms`)

- **Criar `apps/server/src/rooms/handlers/shop.ts`**:
  - **Inventário & Equipamento**:
    - `equipItem` / `unequipItem`: `db.transaction` síncrona do `better-sqlite3`, executando `equipItemValidator`, atualizando `inventories`, recalculando `defense`, `dodgeChance`, `speed`, `flatDr` e `finalDex` em `characters` e sincronizando `PlayerSchema` + snapshot privado do jogador (`INVENTORY_SYNC`).
    - `useScroll`: valida se o item é `SPELL_SCROLL_*` na mochila, verifica se já está no grimório, decrementa o pergaminho e insere em `character_grimoire` na mesma transação.
  - **Baús Compartilhados (`OPEN_CHEST`, `LOOT_CHEST_ITEM`)**:
    - Validação autoritativa de câmara, não estar oculto (`!isHiddenByMaster`) e adjacência hexagonal (`hexDistance(player, chest) <= 1`), bloqueado durante combate.
    - `LOOT_CHEST_ITEM` usa `db.transaction` síncrona: lê a linha do baú, valida quantidade disponível (`> 0`), remove do `chests.itemsJson` (ou transfere `gold`) e adiciona ao `inventories` / `characters.gold` na mesma transação ACID — eliminando *item duping* sob cliques simultâneos.
  - **Lojas de NPC (`OPEN_SHOP`, `BUY_ITEM`, `SELL_ITEM`)**:
    - Validação de adjacência `hexDistance(player, npc) <= 1`.
    - `BUY_ITEM`: `db.transaction` valida saldo inteiro `character.gold >= item.basePriceGold`, debita ouro, decrementa estoque se finito e insere/incrementa na `BAG`.
    - `SELL_ITEM`: bloqueia venda de itens em `MAIN_HAND`, `OFF_HAND` ou `ARMOR` (apenas `BAG`), calcula `calculateSellPrice(basePriceGold)` (50% inteiro), remove da mochila e credita ouro.
  - **Ferramentas do Mestre**:
    - `MASTER_EDIT_SHOP` (editar nome, diálogo e catálogo da loja do NPC), `MASTER_EDIT_CHEST` (editar ouro/itens do baú), `MASTER_GRANT_ITEM` (entregar item ou ouro diretamente a um jogador).
- **Criar `apps/server/src/rooms/handlers/chatAndLog.ts`**:
  - `CHAT_MESSAGE`: valida texto (`1..200` chars, sanitizado), transmite para os jogadores da mesma câmara + Mestre com `expiresAt = Date.now() + 7000`, **sem gravação no SQLite**.
  - `ROLL_DICE`: recebe `{ faces }` (`4|6|8|10|12|20|100`), sorteia via `diceService.roll(faces)` no servidor, transmite `DICE_RESULT` e `LOG_ENTRY` para a câmara e para o Mestre.

---

### Etapa 4 — Combate Dinâmico com Itens/Magias e IA Tática (`apps/server/src/rooms`)

- **Atualizar `apps/server/src/rooms/handlers/combat.ts`**:
  - Montar participantes jogadores a partir de `characters` + `inventories` + `character_grimoire` (armas em `mainHand`/`offHand`, armadura, escudo, foco mágico, consumíveis reais e magias aprendidas).
  - **Ataques Físicos & Habilidades**: rolam o `damageDice` da arma selecionada (`mainHand`, `offHand`, ou `1d4` `UNARMED` se desarmado) + modificador + buffs (`THE_JUICE` `1.20x`, Fúria Berserk, assinatura do arquétipo).
  - **Magias do Grimório**: validam `canCastSpell` (foco mágico equipado + MP suficiente), descontam `spell.mpCost`, somam bônus de `MAGIC_BOOK` quando ativo, e executam:
    - `ARCANE_DART` / `FREEZING_RAY` (aplica buff/debuff `SLOW -1 Speed` por 1 rodada).
    - `IGNEOUS_BLAST` (itera todos os oponentes vivos na Arena POV, aplicando `resolveAttack` / dano em área e retornando lista de resultados no `COMBAT_EVENT`).
    - `HEALING_LIGHT` (cura aliado).
  - **Consumíveis em Combate (`ITEM`)**: decrementam diretamente a tabela `inventories` dentro da transação ACID do turno (se falhar, rollback total):
    - `HEALTH_POTION`, `MANA_POTION`, `ANTIDOTE` (remove `POISON`), `THE_JUICE` (buff físico `1.20x` por 2 rodadas), `MAGIC_BOOK` (buff mágico `+4` por 2 rodadas).
  - **Veneno (`POISON`)**: monstros como `GIANT_SPIDER` podem aplicar `POISON` por 2 rodadas no acerto; no início do turno do participante envenenado, sofre tick de dano exibido no Log e removível com Antídoto.
- **Criar `apps/server/src/rooms/ai/tacticalAi.ts`**:
  - Função pura de decisão `decideMonsterAction(context)` executada no servidor:
    - **Perfil `MELEE`** (Goblin, Esqueleto Guerreiro, Orc, Zumbi, Lobo, Aranha, Golem, Slime): seleciona herói vivo prioritário e desfere ataque físico (ou `ACTIVE_DODGE` se não houver ação válida).
    - **Perfil `RANGED` / Conjurador** (Cultista Arcano, Dragão Jovem): avalia MP e status; usa ataque mágico/à distância quando há MP suficiente, ou ataque básico/suporte quando sem MP, respeitando ações extras (`calculateTotalActions`).
    - **Regra Rígida de Fuga**: nunca retorna `FLEE` a menos que `monster.allowAutoFlee === true`.
  - **Integração no `tick()` de `CombatHandler`**:
    - Dispara apenas quando: `combatState.active === true`, `!isPaused`, `!isProcessingAction`, `now() >= unlockAt` (`~1.2s`), o Mestre está conectado (`master.connected === true`), o participante ativo é `MONSTER` e `actor.isAutoMode === true`.
    - Valida tudo novamente antes de aplicar; se o Mestre alternar o monstro para Manual antes do tick confirmar, nenhuma ação automática é disparada.
    - Comandos `MASTER_SET_MONSTER_AI` e `MASTER_SET_GLOBAL_AI` atualizam e persistem o modo de controle.

---

### Etapa 5 — Interfaces de Loja, Ficha/Mochila/Grimório, Ícones SVG, Chat 7s e Log (`apps/client`)

- **Biblioteca de Ícones SVG (`apps/client/src/components/icons/ItemIcons.tsx`)**:
  - Ícones vetoriais nítidos e estilizados inspirados nas pastas `DesignEX/WeaponEx`, `DesignEX/ArmorEx` e `DesignEX/MagicImageEx` para cada categoria de arma, escudo, foco, armadura, poção, pergaminho e magia.
- **Gaveta Unificada `CharacterSheetDrawer.tsx` (`apps/client/src/components/hud/CharacterSheetDrawer.tsx`)**:
  - Bottom Sheet no mobile / Drawer lateral no desktop com 3 abas:
    1. `Ficha`: Retrato HD, atributos, passiva racial, habilidade de arquétipo, `Defesa`, `Esquiva`, `DR` e `Velocidade` recalculados em tempo real + ouro (`💰 G`).
    2. `Equipamentos & Mochila`: 3 slots rígidos (`Mão Principal`, `Mão Secundária`, `Armadura`) com feedback visual quando arma 2H bloqueia `Mão Secundária`, grade da mochila com contadores (`x2`) e botões de equipar/desequipar/usar.
    3. `Grimório`: Lista de feitiços aprendidos (`MP`, descrição, indicação se exige Foco Mágico equipado) e botão rápido para ler Pergaminhos da mochila.
- **Modais de Loja e Baú (`ShopModal.tsx` & `ChestModal.tsx`)**:
  - `ShopModal.tsx`: Cabeçalho com retrato do NPC, diálogo do Mestre e saldo `💰 G`; Aba `[🛒 Comprar]`; Aba `[💰 Vender (+50%)]` com ícone de cadeado nos itens equipados; Modo `[✏️ Editar Loja]` exclusivo do Mestre.
  - `ChestModal.tsx`: Lista itens e ouro do baú com coleta individual/total, mais editor do baú para o Mestre.
  - Botão flutuante contextual na `PlayerHUD` quando `hexDistance <= 1` de um `CHEST` ou `NPC_MERCHANT` visível (`[💬 Comerciar]` / `[🧰 Abrir Baú]`).
  - Atualizar `BoardEditor.tsx` e `ObjectLayer.ts` para colocar/renderizar `NPC_MERCHANT`.
- **Chat Efêmero, Bandeja de Dados e Log (`EphemeralChatBubble.tsx`, `DiceTrayModal.tsx`, `CombatLogDrawer.tsx`)**:
  - `PlayerHUD.tsx` + barra do Mestre ganham os botões táteis (`>= 44x44px`): `[🎒 Ficha]`, `[🎲 Dados]`, `[📜 Log]` e campo/botão rápido de chat (`Enter` / toque).
  - Balões de fala renderizados sobre o token no `BoardScene.ts` (e toast discreto em combate) desaparecendo após **7 segundos** (`fade-out`).
  - `CombatLogDrawer.tsx` substitui o `<details>` provisório, exibindo rolagens livres de dados e histórico detalhado de combate.
- **Atualização de `CombatOverlay.tsx` e `MasterRefereeBar.tsx`**:
  - Submenus `[⚔️ Atacar]`, `[🛡️ Defender]` e `[🎒 Itens]` alimentados dinamicamente pelo equipamento real, grimório e mochila do participante ativo (inclusive dos monstros sob comando manual do Mestre).
  - `MasterRefereeBar.tsx` recebe interruptor global `[🤖 IA Global]` e alternador individual `[Manual / IA]` + `[Permitir Fuga]` na lista de monstros.

---

### Etapa 6 — Verificação, Testes Automatizados e Build

1. **Testes Unitários (`packages/shared`)**:
   - Regras de slots (`1H` vs `2H` desequipando escudo), cálculo de venda `50%`, recálculo de atributos com Armadura Pesada (`-2 DES`, `-10% Esquiva`, teto `20%`), validação de foco mágico e custo de MP das 4 magias, `resolveAttack` com `defense` (`MISSED_DEFENSE`) e multiplicador `1.20x` de `'O Suco'`.
2. **Testes de Integração e Concorrência (`apps/server`)**:
   - Regressão de migrações SQL sequenciais (`0000` -> `0004`) preservando fichas `v0.4.0` e creditando `50G` + kits iniciais.
   - Concorrência anti-duping em baú compartilhado: 2 clientes disparando `LOOT_CHEST_ITEM` simultaneamente para o mesmo item — apenas 1 recebe e o baú fica vazio no SQLite.
   - Compra/venda em NPC com saldo exato e bloqueio de venda de item equipado.
   - IA Tática (`tacticalAi.ts`): turnos automáticos `MELEE` e `RANGED`, modo misto (1 chefe manual + 2 monstros em IA), pausa na desconexão do Mestre, proibição de fuga sem `allowAutoFlee` e cancelamento seguro ao retomar controle manual.
   - Chat efêmero (não persiste no SQLite) e rolagens `ROLL_DICE`.
3. **Testes E2E (`tests/e2e/` com Playwright)**:
   - Atualizar suíte de combate existente para os novos kits iniciais + fluxo completo de Etapa 0 (perspectiva do Mestre, dano no jogador), compra/venda em NPC, baú, equipamento `2H` desequipando escudo, aprendizado de pergaminho + magia AoE e combate contra IA automática.
   - Rodar `pnpm build` e toda a suíte Vitest + Playwright em seguida.
