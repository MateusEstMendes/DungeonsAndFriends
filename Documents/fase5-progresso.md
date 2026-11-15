# Fase 5 — Progresso de implementação

## Incremento 1: Etapa 0 — perspectiva e feedback de combate

Implementado conforme `fase5-plano.md`, mantendo o combate JRPG:

- Participante ativo, monstro selecionado para inspeção/comando e alvo da ação são estados independentes. Trocar a criatura limpa o alvo e fecha o submenu.
- O Mestre observa turnos dos heróis sem receber seus comandos; o painel de inspeção permanece do lado dos monstros. Comandar exige selecionar a criatura do turno.
- Monstros repetidos recebem numeração no encontro, preservando `catalogName` para imagens e consulta. A identidade do Mestre é explicitamente excluída da iniciativa e da inclusão de participantes.
- Ataques dos monstros usam seu tipo de catálogo, com validação também no servidor. Cura/proteção possuem seleção de aliados separada da inspeção.
- Contrato compartilhado `CombatEvent` contém nomes e tipos de atacante/alvo e resultados por alvo, preparado para a futura área JRPG.
- Texto e histórico identificam quem agiu e quem recebeu a ação. Cards de heróis destacam o participante ativo e o resultado recebido; dano no próprio personagem produz impacto na sua visão, sem desenhar o golpe sobre outro monstro.
- Texto diferencia dano, crítico, esquiva ativa/passiva, absorção, cura e erro por Defesa. A resolução de Defesa será adicionada na Etapa 1; este incremento prepara apenas sua apresentação.
- Redução de movimento mantém valores e destaques, removendo a animação do impacto pessoal.

## Validação

- `pnpm build`: passou (aviso de bundle acima de 500 kB).
- `pnpm test`: 19 arquivos e 108 testes passaram, incluindo permissões, identidade dos monstros e renderização por papel/perspectiva.
- `tests/e2e/combat-perspective.spec.ts`: passou em Chromium (Mestre observa herói, comanda Goblin com ataque de catálogo e recebe o mesmo evento que o jogador).
- O E2E anterior de combate validou a entrada na arena e a observação do Mestre, mas falhou na retomada da arena após `reload` do jogador. A regressão completa de reconexão permanece pendente.

## Incremento 2: Etapa 1 — catálogos, regras e contratos

- `rules/items.ts`: catálogo de 28 itens (armas, escudos, focos, armaduras, consumíveis, quatro pergaminhos e itens narrativos), venda inteira a 50%, troca de slots e kits iniciais por arquétipo com 50G e duas poções. Mago inicia com Dardo Arcano/Raio Congelante; Clérigo com Luz Curativa/Dardo Arcano. Os demais preços são valores iniciais de balanceamento; a Adaga custa 40G.
- Armas de duas mãos, arcos, bestas e Cajado Arcano bloqueiam a mão secundária. Equipar um item secundário devolve a arma/foco de duas mãos à mochila. Duas adagas iguais continuam sendo duas cópias independentes.
- O recálculo usa atributos originais, raça e escolha de Adaptabilidade; aplica a penalidade de DES antes de derivar Defesa, velocidade e esquiva. Armadura média limita apenas a contribuição positiva de DES na Defesa; bônus raciais e DR do escudo são preservados. Armadura aplica sua esquiva sobre o valor da Fase 2, mantendo o limite de 0..20%.
- `rules/spells.ts`: quatro magias sem `rangeHex`, incluindo área `ALL_ENEMIES`, cura por SAB e SLOW de uma rodada; validador de foco e MP.
- `combat/dice.ts`: rolagem pura de dados de dano com aleatoriedade injetada e notação limitada. `resolveAttack` aceita Defesa, multiplicador físico e bônus mágico; erros por Defesa causam zero dano antes de rolar esquivas, críticos naturais passam pela checagem de Defesa, permanecendo sujeitos às esquivas.
- O servidor utiliza a Defesa persistida da ficha e `10 + mod_DES` para monstros. Encontros antigos recebem Defesa e flags manuais ao restaurar o JSON, preservando os demais recursos.
- `CombatAction` e validação de orçamento contemplam `SPELL` e mão `MAIN`/`OFF`. A execução de magias do grimório será integrada na Etapa 4.
- `schema/economyPackets.ts`: contratos estritos de inventário, comércio, baús, edição/concessão do Mestre, IA, chat e dados; quantidades/ouro inteiros, IDs canônicos e rejeição de preços enviados pelo cliente. Estoque `null` significa infinito; zero significa esgotado.
- Protocolo alterado para `0.5.0`, também usado nos rótulos do cliente. Schemas preparados para `NPC_MERCHANT`, `globalAiEnabled`, `isAutoMode` e `allowAutoFlee`, inicialmente desativados. Comandos novos ainda dependem dos handlers.
- Auditoria não encontrou `rangeHex` no código de regras/combate. A remoção das listas de ataque fixas e de `potions: 2` fica vinculada à substituição por inventário persistido na Etapa 4, conforme a dependência do plano.
- Build do shared passa a excluir testes; Vitest ignora `dist`, evitando execução duplicada de arquivos compilados.

### Validação do incremento 2

- `pnpm build`: passou; permanece o aviso de bundle acima de 500 kB.
- `pnpm test`: 22 arquivos e 136 testes de origem passaram, sem duplicar arquivos de `dist`.
- Verificação direcionada das regras e combate: 6 arquivos, 66 testes passaram, incluindo restauração de JSON legado sem Defesa.
- `tests/e2e/combat-perspective.spec.ts`: passou em Chromium com o protocolo 0.5.0 e resultados de ataque condicionados à Defesa.
- `git diff --check`: passou.

## Incremento 3: Etapa 2 — persistência e seeds

- Migração `0004_add_items_economy_spells.sql` e snapshot Drizzle gerados. O SQL de upgrade foi ajustado para operações aditivas: não recria `characters` ou `placed_objects`, não desativa FKs e preserva as referências de fichas e encontros.
- Criadas `items_catalog`, `spells_catalog`, `inventories`, `character_grimoire`, `npc_shops` e `chests`. Os 28 itens e quatro feitiços são inseridos pelo próprio SQL com `INSERT OR IGNORE`; o seed de inicialização repara IDs ausentes sem sobrescrever valores ajustados.
- `characters.gold` tem valor padrão 50 e restrição de inteiro não negativo. Inventário restringe quantidades positivas, uma cópia por slot equipado e uma pilha por item na mochila. Grimório impede duplicatas por personagem/feitiço.
- `starterKitGranted` é um marcador persistido, transacionado junto dos itens e feitiços. Fichas antigas sem inventário recebem o kit; fichas novas recebem-no dentro da transação de criação. Uma mochila esvaziada nunca provoca nova entrega, e o seed não redefine ouro gasto/ganho.
- `humanBonusAttribute` preserva a escolha de Adaptabilidade nas fichas novas e recupera escolhas legadas quando os seis atributos permitem identificação inequívoca. `baseFinalDex` guarda a DES racial original, inclusive ajustes legados, permitindo recálculo de equipamento sem acumular penalidades. Casos legados com atributos personalizados ambíguos mantêm o bônus como desconhecido (`null`) e preservam a DES original.
- Kits com armadura/escudo recalculam os atributos derivados. Armas e focos, que não modificam esses atributos, preservam valores ajustados existentes.
- Baús existentes/novos recebem por padrão 10G e uma Poção de Vida. Mercadores novos recebem estoque inicial finito de Adaga, poções e Escudo de Madeira. O Mestre poderá editar esses valores nos próximos handlers.
- Objetos removidos usam `placed_objects.isArchived`; o tabuleiro e os clientes recebem apenas os ativos. `writeBoard` atualiza identidades em vez de apagar todos os objetos/câmaras. Dados atuais de loot e estoque sobrevivem a edições, remoção, Undo/Redo e reinício, sem restaurar itens já coletados. Arquivos de histórico anteriores continuam compatíveis. Exclusão de câmaras não é uma operação suportada pelo editor.
- `globalAiEnabled` passa a ser persistido no encontro; flags individuais permanecem em `statsJson`, com defaults manuais na migração de monstros legados. O executor automático continua reservado à Etapa 4.

### Validação do incremento 3

- `pnpm build`: passou; permanece o aviso de bundle acima de 500 kB.
- `pnpm test`: 23 arquivos e 148 testes passaram, incluindo migrações sequenciais, criação de ficha com kit, rollback de entrega, integridade de FKs, recuperação dos seis bônus humanos e Undo/Redo após reinício.
- `tests/e2e/combat-perspective.spec.ts`: passou em Chromium com a inicialização da economia.
- O SQL da migração também foi executado isoladamente em teste, confirmando os 28 itens e quatro feitiços sem depender do seed em TypeScript.
- `git diff --check`: passou. Validação em bancos temporários/em memória; o banco de uso normal receberá migração e seed automaticamente na próxima inicialização do servidor.

## Incremento 4: Etapa 3 — handlers transacionais, chat e dados

- `rooms/handlers/shop.ts` integra `REQUEST_INVENTORY`, equipamento/desequipamento, leitura de pergaminhos, abertura/coleta de baús, abertura/compra/venda em lojas e edição/concessão pelo Mestre.
- Mutações usam transações síncronas `better-sqlite3` em modo `IMMEDIATE`. Saldo, propriedade dos itens, estoque/loot e quantidades são relidos dentro da transação. Falhas de gravação revertem todas as mudanças; estado público e mensagens de confirmação são atualizados após o commit.
- As interações de jogadores validam identidade conectada, aprovação persistida, propriedade da ficha, presença, HP positivo, câmara, adjacência, paredes, ocultação e `isArchived = false`. A autorização é revalidada em cada operação, independentemente de ter aberto a loja/baú antes.
- Compra utiliza o preço persistido no catálogo; venda aceita apenas `BAG`, calcula 50% por unidade arredondando para baixo e rejeita quantidades ou saldos inválidos/overflow. Estoque `null` permanece infinito; estoque finito é decrementado. A venda remove o item e credita ouro, sem repor o estoque da loja.
- Equipar consome uma cópia da mochila, devolve itens deslocados para pilhas e recalcula Defesa/DES/esquiva/DR/velocidade a partir de `baseFinalDex`. A troca não restaura passos de movimento já gastos. Aprender pergaminho insere a magia e decrementa o item atomicamente; magia já conhecida não consome outro pergaminho.
- Ferramentas administrativas permitem editar lojas/baús e conceder ouro/itens a personagens aprovados, inclusive offline. Operações de economia/equipamento/scroll e edições administrativas ficam bloqueadas durante combate; a leitura da ficha, chat e dados continuam disponíveis.
- `InventoryRepository` centraliza pilhas, metadados do catálogo, recálculo e snapshots. `INVENTORY_SYNC` envia ouro, equipamento, mochila, grimório e atributos ao dono e ao Mestre; consultar outro inventário exige papel de Mestre. A sincronização ocorre também ao criar/entrar/reconectar com uma ficha.
- `SHOP_SYNC`/`CHEST_SYNC` atualizam quem abriu o objeto e continua autorizado/adjacente. Observadores ausentes, afastados ou sem acesso deixam de receber atualizações.
- `rooms/handlers/chatAndLog.ts` transmite chat de texto simples com `expiresAt = createdAt + 7000`, sem guardá-lo no banco ou no histórico do servidor. Rolagens `d4/d6/d8/d10/d12/d20/d100` usam `diceService.roll` no servidor e emitem `DICE_RESULT` e `LOG_ENTRY`.
- Chat, dados e logs são enviados somente à câmara do jogador e ao Mestre. O Mestre pode informar `chamberId`; por padrão usa a câmara do combate ativo ou a primeira câmara da fase ativa. Jogadores não podem redirecionar mensagens para outra câmara.
- Logs de combate e dados são deduplicados e limitados aos últimos 200 eventos em memória, disponíveis em `LOG_SYNC`/`REQUEST_LOG` e descartados com a instância da sala. Chat não é reapresentado ao reconectar.
- O cliente registra os novos pacotes em `useEconomyStore`, expira mensagens, mantém uma fala por participante, limita/deduplica o log e limpa dados ao sair. Modais, gavetas, balões e botões visuais continuam na Etapa 5.

### Validação do incremento 4

- `pnpm build`: passou; permanece o aviso de bundle acima de 500 kB.
- `pnpm test`: 26 arquivos e 163 testes passaram.
- `tests/e2e/combat-perspective.spec.ts`: passou em Chromium após integrar os novos pacotes à conexão da sala.
- `git diff --check`: passou.
- Teste de sala com sockets reais: dois jogadores disputam o último item de um baú e a última unidade de estoque; apenas um comando vence em cada disputa. Inventários não são enviados ao outro jogador; chat/dados/logs não chegam ao personagem de outra câmara.
- Testes cobrem venda 50%, bloqueio de item equipado, slots 2H/duas cópias, armadura, passos gastos, scroll duplicado, visibilidade/adjacência, ferramentas do Mestre e rollback de compra/equipamento/scroll/overflow de ouro de baú.
- Chat testado com TTL de 7 segundos, ausência de gravações SQLite/histórico e expiração/substituição no cliente; histórico de dados/combate é limitado e não sobrevive à criação de outro handler de sala.

## Próximo incremento

Etapa 4: integrar equipamentos, consumíveis e grimório reais ao executor de combate; substituir ataques/pocões provisórios; executar magias individuais/área, buffs, SLOW e veneno; implementar IA por turnos com alternância individual/global e pausa sem o Mestre. As interfaces completas de comércio, ficha/mochila/grimório, chat, dados e log seguem na Etapa 5.

A falha de reconexão registrada no primeiro incremento permanece pendente.
