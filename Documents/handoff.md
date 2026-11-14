# Handoff — Dungeons & Friends

Atualizado em 2026-11-14.

## Próxima atualização visual — imagens dos inimigos

O estado mais recente dessa frente está em [handoff-imagens.md](handoff-imagens.md). As dez imagens fornecidas em `DesignEX/Enemies` foram associadas ao catálogo, à prévia do editor, aos tokens e à arena. O seed adiciona os sete tipos novos sem sobrescrever atributos existentes. A ampliação dos ataques e impactos continua planejada separadamente no PixiJS/GSAP. O [prompt de produção](prompt-design-inimigos.md) gera um inimigo por resposta. A clareza de atacante, alvo e dano está especificada em [controle-mestre-monstros-ia.md](controle-mestre-monstros-ia.md), seção 4.4.

## Estado atual — Fase 4 concluída, v0.4.0

As Fases 1 a 4 estão implementadas. A próxima etapa planejada é [Fase5.md](Fase5.md): equipamentos, consumíveis, grimório, economia, lojas/baús, chat/log e IA tática. Ela ainda não foi iniciada nesta sessão. Os sprites de armas e armaduras de referência estão em `DesignEX/`, conforme o escopo da Fase 5.

A Fase 4 adicionou ações universais, orçamento por FOR/INT, dano com DR e esquivas, passivas raciais, dados criptográficos e faixas d20 configuráveis. O servidor controla iniciativa, ações, pausa, fuga e ataques manuais de monstros. O cliente possui arena POV por bioma, seleção de alvos, cards de aliados, retrato da ficha, doca de batalha, barra do Mestre, VFX e dados sincronizados. Consulte [fase4-implementacao.md](fase4-implementacao.md) para os arquivos e o fluxo completo.

O protocolo e os pacotes agora usam `0.4.0`. A migração aditiva `0003_add_combat_system.sql` cria `monsters_catalog`, `combat_encounters`, `combat_participants` e `active_buffs`. O catálogo inicial contém Goblin, Esqueleto Guerreiro e Cultista Arcano. SQL, journal e snapshot Drizzle estão versionados; a comparação do snapshot com o schema não gerou diferenças.

Encontros `ACTIVE` são restaurados ao iniciar a sala, preservando rodada, fila, participante ativo, ações restantes, pausa, fuga, faixas d20, recursos, posturas e recargas. Ação, HP/MP e encerramento são persistidos na mesma transação. Falhas de gravação também revertem o estado em memória, sem publicar um evento de sucesso. `StateView` restringe fila/token à câmara do encontro e ao Mestre; elenco e eventos seguem a mesma audiência.

### Verificações registradas da Fase 4

- Build v0.4.0 e 79 testes Vitest aprovados. O teste de sala foi repetido depois de acrescentar a verificação de 15 pacotes: uma ação aplicada, 14 rejeições e uma ação extra restante.
- Quatro cenários Playwright validados: dois de tabuleiro, combate com duas sessões/mobile e dano mínimo. Na execução conjunta passaram os três primeiros; o último revelou uma troca indevida da lista de inimigos durante o turno do monstro. Após a correção, o cenário de dano mínimo passou isoladamente. A suíte completa não foi repetida depois dessa correção.
- No navegador: proximidade de Goblin, arena por bioma, dados iguais entre sessões, ação extra com fuga bloqueada, reload no meio do turno, esquiva ativa, controle manual, pausa e fuga garantida. O golpe fraco mostrou dano bruto `4`, DR `5`, dano aplicado `1` e HP `44/45` do Esqueleto.
- Simulação headless de 10.000 turnos executada. Migração de um banco v0.3 com dados, reabertura de arquivo WAL, recriação da sala e rollback provocado por triggers também foram testados.

As evidências ficam em `.local/phase4-*.png` e `.local/phase4-*.json`, fora do Git. Os testes usam banco descartável e Chromium desktop/celular emulado 390×844; não representam uma validação física em telefone. A checklist de [Fase4.md](Fase4.md) está 6/6. Não foram executados novos testes para esta atualização documental.

```powershell
pnpm build
pnpm test
pnpm test:combat
pnpm test:combat-sim
pnpm test:e2e
```

O Playwright usa servidor na porta 4179, banco isolado em `.local/` e Chrome instalado (`CHROME_PATH` permite outro Chromium). Compile antes de rodá-lo. Ao retomar, uma execução conjunta de `pnpm test:e2e` confirma os quatro cenários sobre a mesma revisão.

### Histórico Git e limites para a próxima fase

Foram criados os commits por tópico solicitados:

| Commit | Mensagem |
| --- | --- |
| `714540b` | `Fase 4(1.1) Finalizado` |
| `3f72af7` | `Fase 4(1.2) Finalizado` |
| `dd02553` | `Fase 4(1.3) Finalizado` |
| `73fec62` | `Fase 4(2) Finalizado` |
| `87c66e7` | `Fase 4(3.1) Finalizado` |
| `fc3b145` | `Fase 4(3.2) Finalizado` |

A checklist foi deixada fora desses commits, conforme a instrução da Fase 4. Posteriormente, o histórico recebeu `20c72b6 — Fase 4 (completa)`, que versionou `Documents/Fase4.md`. O working tree estava limpo antes desta atualização do handoff. Não presumir que a instrução de commits por tópico se aplica automaticamente à Fase 5.

Na Fase 5, preservar o pipeline de dano, os tokens renovados por ação, a trava de resolução, as transações e a restauração. Monstros atualmente são controlados manualmente pelo Mestre; IA automática pertence à próxima fase. As poções atuais têm reserva por encontro, e as magias usam regras básicas do executor; ainda não há inventário, economia, foco equipado ou catálogo canônico de feitiços da Fase 5. A compatibilidade com entidades antigas mapeia `Sentinela` para Esqueleto Guerreiro e `Monstro` para Goblin.

As skills `grill-me` e `grilling` foram instaladas globalmente em `C:\Users\PC Gamer\.codex\skills`, fora do repositório. A instalação não iniciou uma sessão de entrevista nem alterou o projeto.

## Histórico — Fase 3, v0.3.0

Foram implementados núcleo hexagonal, mapas e migração `0002`, seed de três câmaras, FOV compartilhado e StateView por cliente, movimento FCFS, portais, cooldowns e prioridade do Mestre. O cliente READY e o Mestre acessam o tabuleiro PixiJS, com camadas, névoa em RenderTexture, pan/zoom, HUD e editor com Undo/Redo persistente. As animações seguem as skills oficiais GSAP Core, React, Performance e Timeline: contexto por cena, limpeza, timelines de percurso e movimento reduzido.

Build, 44 testes Vitest e dois testes Playwright constam em [fase3-validacao.md](fase3-validacao.md). Em 2026-11-13, o usuário confirmou que todos os testes manuais passaram, concluindo a validação da Fase 3. Host e túnel foram encerrados a pedido naquela ocasião; o estado atual desses processos não foi verificado nesta atualização. O snapshot Drizzle foi gerado e conferido sem diferenças pendentes. A Fase 3 está registrada no commit `df95d30`.

O protocolo dessa etapa era `0.3.0`, substituído por `0.4.0`. Reinicie o servidor e recarregue os clientes juntos ao atualizar. O banco real é migrado na inicialização; preserve o banco e o segredo de sessões. As seções abaixo registram decisões e o histórico da Fase 1.

## Inicialização no Windows — correções

Correção posterior à validação manual: o editor permitia empilhamento ilimitado de objetos iguais. O servidor agora impede aumentar a quantidade de objetos do mesmo tipo no mesmo hexágono em colocação, movimento e Undo/Redo. Tipos diferentes continuam podendo se sobrepor. Duplicatas existentes são preservadas e podem ser separadas ou removidas. A suíte passou com 50 testes, incluindo três regressões específicas desse problema.

O script `dev` usa os nomes `@df/client` e `@df/server`, evitando aspas simples no filtro de diretórios, que o shell de scripts do Windows interpreta literalmente. O host reconhece `.tools/cloudflared.exe` automaticamente e verifica `--version` antes de iniciar o servidor. O executável encontrado em Downloads foi copiado para `.tools/`, que continua fora do Git. Os cinco testes de resolução do executável e senha do host passaram.

## Senha do Mestre — decisão implementada

O usuário definiu explicitamente `Mateus2312@` como senha padrão do projeto pessoal.

- `DEFAULT_MASTER_PASSWORD`, em `apps/server/src/host.ts`, define esse valor.
- Ao iniciar, o host aplica a senha padrão tanto a salas novas quanto à sala persistida, guardando somente o hash com salt/scrypt no SQLite.
- `MASTER_PASSWORD` tem prioridade quando definida. Ao iniciar novamente sem a variável, o padrão volta a valer.
- O terminal informa o uso da senha padrão ou de `MASTER_PASSWORD` em cada inicialização.
- A interface não exibe a senha em texto puro. O login continua passando pela validação da senha no servidor.
- Reinicie a instância anterior para carregar essa alteração.

## Histórico — implementação da Fase 1

A implementação da Fase 1 (`v0.1.0`) foi concluída: monorepo, schemas e validadores compartilhados, SQLite/Drizzle, autenticação, sala persistente, fila de aprovação, reconexão, heartbeat, túnel com QR Code, stores e telas responsivas.

Verificações daquela etapa: build e TypeScript passaram; 21 testes Vitest passaram. Chromium validou login do Mestre, aprovação, recusa, reload com identidade preservada, offline/online, heartbeat e layout mobile. Um aviso que permanecia após reconectar foi corrigido e a verificação local foi repetida com sucesso.

Uma tentativa adicional de teste pelo Quick Tunnel encontrou falha de DNS na URL temporária. Posteriormente, em 2026-11-12, o usuário confirmou que todos os sete itens do checklist passaram, incluindo os testes físicos em 4G/5G, aprovação, reconexão, reload e heartbeat de três minutos pelo túnel. O checklist está concluído com base nessa confirmação do usuário. Consulte `Documents/fase1-validacao.md`.

## Integração e dados — seção 3 concluída

A aprovação agora grava `APPROVED` no banco e renova o token HMAC; o estado sincronizado usa `NEEDS_CHARACTER_CREATION`. Na restauração, esse mapeamento é refeito para jogadores. Credenciais provisórias preservam a espera após reload e são substituídas na aprovação. O payload de credenciais tem contrato Zod compartilhado e a persistência local tem testes próprios. O UUID continua sendo a chave estável do jogador; `sessionId` é vinculado internamente. Host e sala garantem um registro `ACTIVE` em `sessions`.

## Cuidados para continuar

- Consulte `Documents/Fase5.md` para a próxima etapa e `Documents/planejamento-jogo.md` para a visão geral. Fichas, mapas e combate já estão implementados.
- Confira `git status` antes de editar ou fazer commits e preserve alterações do usuário.
- Não inicie dois servidores na porta 2567. `pnpm dev` e `pnpm start:host` usam essa porta.
- Preserve `apps/server/dungeons.db` e seu arquivo `.secret` para manter as identidades persistentes.
- Uma nova URL de Quick Tunnel muda a origem do navegador e não tem acesso ao localStorage da URL anterior.

Instruções de execução e configuração estão no `README.md`.
