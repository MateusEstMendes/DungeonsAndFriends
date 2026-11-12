# Validação da Fase 1 — v0.1.0

## Resultado final

Em 2026-11-12, o usuário confirmou que todos os sete itens do checklist da Fase 1 passaram, incluindo WAL/migrações/Studio, códigos sem ambiguidades, QR Code em 4G/5G, fila de aprovação, queda de rede, reload e heartbeat por três minutos pelo túnel. Os testes manuais foram executados e confirmados pelo usuário; não foram observados diretamente pelo agente. Não há pendências nesse checklist.

## Implementado

- Monorepo, builds em ordem de dependência, TypeScript estrito e decorators.
- Schemas compartilhados Colyseus e payloads Zod com handshake de versão.
- SQLite com WAL, busy timeout, foreign keys, migração inicial e ledger de versão/checksum.
- Sala criada pelo host com código de cinco caracteres sem ambiguidades.
- Senha do Mestre com salt/scrypt; tokens de sessão HMAC-SHA256 e reconexão nativa de 60 segundos.
- Identidades persistentes, nomes únicos, bloqueio de conexões simultâneas da mesma identidade.
- Fila de aprovação, comandos exclusivos do Mestre e persistência das decisões.
- Heartbeat servidor/cliente de 20 segundos, medição de RTT e logs com IP mascarado.
- Quick Tunnel, URL com o código real da sala, QR Code e encerramento dos subprocessos.
- Stores Zustand, localStorage, reconexão, lobby, espera, recusa e fila do Mestre.

O Mestre da sala usa o próprio UUID da sala como identidade; os demais jogadores têm UUIDs próprios. A sala restaura seus jogadores e aprovações no boot. Clientes externos não podem criar outras salas pelo matchmaking. A senha padrão é `Mateus2312@`, aplicada também às salas existentes ao iniciar. `MASTER_PASSWORD` tem prioridade enquanto estiver definida; sem a variável, o próximo início restaura o padrão. A fundação hospeda uma mesa persistente por processo.

## Verificação automatizada

`pnpm test`: 21 testes passando, cobrindo 10.000 códigos de sala, assinatura e adulteração de tokens, senha com salt, mascaramento de IP, contratos de entrada, serialização e patches, migrações, constraints, WAL em disco, aprovação, recusa, comando não autorizado, nomes duplicados, ping/pong, cancelamento, reconexão nativa e restauração da sala autoritativa.

`pnpm build` e `pnpm typecheck`: compilação e tipos dos três pacotes.

Verificação anterior à atualização da seção 3, em Chromium, com banco temporário e duas sessões de navegador independentes: login do Mestre, código via query param, aprovação, recusa, reload com identidade preservada, alternância offline/online, heartbeat após 20 segundos e tela mobile de 390 px sem overflow horizontal. Nenhum erro JavaScript de página foi detectado. O navegador foi instalado em `/tmp` para esta verificação, sem acrescentar dependência à aplicação.

O teste de túnel HTTP foi realizado na preparação do ambiente. Uma tentativa adicional de navegação pública nesta etapa encontrou `ERR_NAME_NOT_RESOLVED` na URL temporária do Quick Tunnel; o fluxo WebSocket completo pelo túnel não foi confirmado pelo agente naquela rodada. Posteriormente, o usuário confirmou a aprovação de todos os cenários físicos do checklist, encerrando essa pendência.

A atualização da seção 3 foi validada por build, TypeScript e testes automatizados. O teste Chromium não foi repetido nesta rodada: o script e o navegador temporários de `/tmp` já não estavam disponíveis.

## Integração e dados — seção 3

- `PENDING_APPROVAL` é persistido na entrada, sincronizado com jogador e Mestre e exibido na fila.
- A aprovação grava `APPROVED` e renova o token assinado atomicamente no SQLite; no estado Colyseus a etapa é `NEEDS_CHARACTER_CREATION`.
- `SESSION_CREDENTIALS` tem contrato Zod compartilhado. O cliente valida antes de substituir as chaves de localStorage.
- As credenciais iniciais são provisórias e permitem recuperar a espera. O token é substituído na aprovação; o anterior deixa de servir para `joinById`.
- Reentrada verifica assinatura, sala, token persistido e recusa antes de restaurar o jogador; `last_seen_at` é atualizado.
- O UUID é a chave estável de `RoomState.players`. `sessionId` fica vinculado internamente à identidade, sem virar chave persistente.
- Host e sala garantem sessão `ACTIVE` no banco sem duplicar o registro em reinícios de sala.
- Os testes conferem os patches recebidos pelo Mestre e jogador, a igualdade entre credenciais emitidas e banco, rotação de token, rejeição do token antigo, armazenamento bloqueado e restauração após recriar a sala.

## Roteiro manual com celulares

1. Encerre a instância anterior com Ctrl+C e execute `pnpm start:host`.
2. Abra o link e entre como Mestre com `Mateus2312@`, ou com o valor de `MASTER_PASSWORD` se definido.
3. Escaneie o QR Code com dois celulares fora do Wi-Fi. Confira o código preenchido.
4. Peça entrada com nomes diferentes. No Mestre, aprove um e recuse outro.
5. Confirme que as telas mudam imediatamente. Latência inferior a 500 ms deve ser medida nessa rede; não é garantida pelo código.
6. No jogador aprovado, desligue a rede por 10 segundos, religue e confira a identidade sem duplicação.
7. Recarregue a página e clique em **Continuar sessão**.
8. Deixe conectado por pelo menos três minutos sem interação e confira os heartbeats e a conexão.
9. Reinicie o host. Entre na nova URL com a mesma senha; confirme sala e jogadores preservados. Uma nova URL de Quick Tunnel é outra origem: seus tokens antigos não ficam disponíveis nela. Com uma origem estável, a sessão persistente permite recuperar a identidade após reiniciar.
10. Use `pnpm db:studio` para inspecionar `rooms`, `players`, `sessions`, `_dungeons_migrations` e `__drizzle_migrations`.

## Limite desta entrega

A tela de entrada aprovada encerra a Fase 1. Criação de personagens, mapas, combate e PWA pertencem às fases seguintes do planejamento.
