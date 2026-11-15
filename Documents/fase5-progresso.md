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

## Incremento 5: Etapa 4 — combate persistido e IA por turnos

- O executor monta heróis com equipamento, consumíveis e grimório reais, usando `InventoryRepository`. As ações disponíveis são calculadas no servidor e compartilhadas com o cliente; foram removidas as poções fictícias e listas universais de ataques do menu.
- Ataques usam os dados da mão selecionada (`MAIN`/`OFF`), ou `1d4` desarmado quando não há arma. Tipos de ataque incompatíveis com o equipamento e habilidades de outro arquétipo são rejeitados. Guerreiro/Bárbaro/Ladino mantêm habilidades e recargas próprias; bloqueio exige escudo para heróis.
- Magias exigem aprendizado, foco equipado, MP e alvo coerente. Dardo Arcano, Raio Congelante, Explosão Ígnea e Luz Curativa usam dados e modificadores do catálogo; cura usa SAB não negativa. Explosão atinge todos os oponentes vivos, descontando MP uma única vez e retornando um resultado por alvo.
- Poções de Vida/Mana, Antídoto, Livro Mágico e O Suco são consumidos da mochila na mesma transação SQLite do turno, HP/MP, buffs, iniciativa e token. Se persistir o encontro falhar, inventário e todos os participantes são restaurados e nenhum evento confirmado é emitido.
- Livro Mágico adiciona +4 mágico e O Suco multiplica o físico por 1,20 antes de críticos/DR; efeitos iguais renovam a duração sem empilhar. A duração de duas rodadas é contada por dois turnos completos do beneficiário; a ação de uso no próprio turno não consome essa duração. Fúria mantém seu prazo por rodada.
- Raio Congelante reduz velocidade de combate em 1 até o fim do turno do alvo na rodada seguinte. A iniciativa é reordenada quando a velocidade muda; alterações manuais de ordem são preservadas enquanto não houver nova alteração de velocidade. A velocidade de exploração não é sobrescrita pelo debuff.
- Aranha Gigante aplica veneno por dois turnos no acerto. Cada início de turno envenenado causa 3 HP (valor inicial de balanceamento), registrado como evento `STATUS`; Antídoto remove o efeito. Restaurar um turno já iniciado não reaplica o tick. Buffs e durações são preservados no JSON do participante.
- `decideMonsterAction` é uma função pura JRPG: prioriza inimigos vivos/presentes com menor HP; conjuradores avaliam cura e proteção de aliados feridos, ataques mágicos com MP e ataque básico físico sem MP. Sem ação compatível com o orçamento extra, defendem ou passam com registro. Fuga só é considerada com permissão individual e sem bloqueio global.
- A simulação da sala executa a cada 100 ms; o heartbeat continua a cada 20 segundos, sem comandar o relógio do combate. O tick autoritativo executa IA apenas em combate ativo, sem pausa/processamento, após a janela de 1,2s, com Mestre conectado e monstro em automático. Ações automáticas e manuais passam pelo mesmo executor. Retomar manual antes do tick impede a ação automática; um turno manual de monstro também exige Mestre conectado.
- `MASTER_SET_GLOBAL_AI` altera todos os modos e o padrão dos próximos monstros; `MASTER_SET_MONSTER_AI` permite exceções individuais e `allowAutoFlee`. Trocar modo não repõe HP/MP, ações ou recargas. Modos, padrão global e recursos sobrevivem à restauração; a consulta privilegia o encontro ativo mesmo se timestamps empatarem.
- O painel do Mestre ganhou controles de IA global, individual e permissão de fuga. Os menus de combate agora vêm do servidor, indicam MP/foco/quantidades e distinguem alvos de ataque e suporte. Feedback e VFX de área usam os resultados individuais, sem aplicar impactos de heróis sobre monstros.
- A sincronização privada da ficha acompanha os commits do combate. Fichas antigas restauradas passam a usar recursos reais, descartando o contador provisório de poções.

### Validação do incremento 5

- `pnpm build`: passou; permanece o aviso de bundle acima de 500 kB.
- `pnpm test`: 28 arquivos e 176 testes passaram, incluindo a execução real de IA em sala dentro da janela de animação, sem aguardar o heartbeat.
- Verificação direcionada: 38 testes de combate, economia/IA e decisão tática passaram, cobrindo dano/MP de área, foco, SAB, consumíveis reais, buffs, SLOW, veneno, rollback total e restauração sem repetir tick, pausa/desconexão do Mestre, controle misto, retomada manual, duração da janela e proibição de fuga.
- `tests/e2e/combat-magic-ai.spec.ts`: passou em Chromium com personagem mobile, área JRPG, custo de MP, IA global e controle misto.
- `git diff --check`: passou.
- Ajustados rótulos flutuantes compactos e duração da bandeja de dados para evitar sobreposição entre ações no mobile; o status e o log mantêm o resultado completo.
- Testes E2E anteriores de combate foram atualizados para dados e nomes das ações reais, sem presumir dano fixo ou ataques que o personagem não possui.

## Incremento 6: Etapa 5 — interfaces de economia e HUD compartilhada

- `CharacterSheetDrawer` reúne Ficha, Equipamentos & Mochila e Grimório; consome snapshots privados, mostra retrato, atributos, passivas, habilidades, recursos, ouro e atributos derivados. Adapta-se como gaveta lateral no desktop e painel inferior no mobile.
- Equipamento usa slots reais e sinaliza bloqueio da mão secundária por armas 2H. Pergaminhos conhecidos ficam desabilitados. Consumíveis podem ser usados em si no próprio turno, pelo executor autoritativo de combate; a consulta do Mestre é somente leitura.
- `ShopModal` implementa compra, venda a 50%, saldo, estoque finito/infinito, bloqueio de venda de equipamento e editor visual de nome/diálogo/estoque exclusivo do Mestre.
- `ChestModal` permite coleta individual de itens/ouro ou sequência de coleta total, com edição visual de ouro/loot pelo Mestre. Cada coleta da sequência mantém a transação e as validações autoritativas existentes; a sequência completa não constitui uma transação única.
- `AdventureHUD` integra ficha, dados d4/d6/d8/d10/d12/d20/d100, gaveta de log e chat ao tabuleiro e à arena, para ambos os papéis. Jogadores recebem ações contextuais junto de objetos visíveis/adjacentes, sem paredes entre eles. A janela fecha quando perdem acesso ou iniciam combate.
- O Mestre seleciona personagens para consultar suas fichas e abre editores de baú/loja pelo inspetor de objetos. O editor do tabuleiro coloca mercadores; `ObjectLayer` renderiza uma silhueta própria.
- `ItemIcons` fornece ícones SVG de armas, escudos, focos, armaduras, consumíveis, pergaminhos e elementos mágicos, sem importar os JPGs de referência para o bundle.
- Chat aparece em balões ancorados aos tokens no Pixi e em avisos discretos na arena; usa o prazo de sete segundos recebido do servidor e respeita redução de movimento. O desenho dos balões é atualizado somente quando suas informações mudam.
- `CombatLogDrawer` substitui o histórico provisório e apresenta eventos de combate, resultados por alvo, rolagens e horários. Os menus dinâmicos de combate e controles de IA da Etapa 4 permanecem integrados.
- Respostas de loja/baú são aplicadas somente à janela atualmente solicitada. Fechar ou trocar de objeto descarta respostas atrasadas e impede que alterações de estoque/loot reabram uma janela fechada; há testes específicos desse ciclo.
- Janelas usam diálogo modal nativo, foco contido, Escape, retorno ao controle de origem, alvos de toque de 44px e apresentação de erros do servidor dentro da janela.

## Incremento 7: Etapa 6 — verificação da fase

- Suíte Vitest: 28 arquivos, 178 testes passaram, incluindo migrações, regras compartilhadas, concorrência de economia, chat e execução de IA.
- Build e tipagem: passaram; permanece o aviso já existente de bundle acima de 500 kB.
- Playwright: os 9 cenários passaram em Chromium, incluindo tabuleiro/toque, perspectiva do Mestre, magia/IA, reconexão em combate, dano mínimo, economia, imagens de inimigos e expulsão/retorno com a mesma ficha.
- Novo E2E de economia cobre coleta de baú, slots 2H, leitura de pergaminho, compra/venda, edição da loja pelo Mestre, dados/log e expiração do chat.
- Teste de magia/IA atualizado para consultar a gaveta de log. Testes de combate encerram explicitamente as sessões ao concluir, evitando manter conexões reservadas durante a janela de reconexão entre cenários.
- Corrigida inicialização da câmera com redução de movimento: resize e posicionamento são imediatos; o E2E de toque aguarda a cena pronta. Atalhos mobile ficam ao lado do retrato e se ocultam durante submenus para liberar os comandos de combate.
- Cenários de proximidade saem da região dos monstros antes de se aproximar novamente, evitando depender da assinatura de alertas deixada por outro teste.
- O teste de presença compara o HP antes/depois da expulsão e retorno, preservando a verificação sem assumir HP cheio após outros combates.
- Playwright usa o navegador instalado por padrão em Linux/macOS, preservando `CHROME_PATH` e o caminho anterior em Windows.

O cenário completo de reconexão em combate passou: recarregar a página preserva participante, iniciativa, ação extra e comandos disponíveis; pausa/retomada e fuga do Mestre também foram validadas. A pendência registrada no primeiro incremento foi encerrada. A suíte E2E completa passou. Etapas 5 e 6 concluídas.
