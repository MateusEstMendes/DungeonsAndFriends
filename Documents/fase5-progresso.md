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

## Próximo incremento

Etapa 3: handlers transacionais de inventário/equipamento, pergaminhos, lojas, baús, ferramentas do Mestre, chat efêmero e rolagens livres. Todas as interações com objetos deverão validar câmara, presença, visibilidade, adjacência e estado ativo (`isArchived = false`), além de autoria/autorização. Comércio e coleta ainda não estão disponíveis na interface.

A integração completa do inventário/consumíveis/grimório ao combate e a IA continuam reservadas à Etapa 4. A falha de reconexão registrada no primeiro incremento permanece pendente.
