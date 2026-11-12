# Dungeons & Friends

Fundação `v0.1.0`: monorepo pnpm com TypeScript, React 19 / Vite 8 / Tailwind 4, Colyseus 0.18, SQLite / Drizzle e Vitest.

## Começar uma mesa

Requisitos: Node.js 24, pnpm 12.16.1 e o binário oficial [cloudflared](https://developers.cloudflare.com/tunnel/downloads/) em `.tools/cloudflared` ou no PATH. `CLOUDFLARED_PATH` permite escolher outro caminho.

```bash
pnpm install
pnpm start:host
```

A senha padrão do Mestre neste projeto pessoal é `Mateus2312@`. O terminal mostra o código da sala e informa se a senha padrão ou `MASTER_PASSWORD` está em uso. Abra a URL pública, expanda **Acesso do Mestre** e faça login. Compartilhe o convite ou QR Code com os jogadores; o código da sala vem preenchido pelo parâmetro `?room=`. Cada jogador informa seu nome e aguarda a aprovação do Mestre na fila de pedidos.

O Mestre usa **Pedidos** para aprovar ou recusar. O jogador aprovado acessa a tela de confirmação, pronta para a etapa futura de criação de personagem. Fichas, mapas e combate ficam para as próximas fases.

O servidor mantém a mesma sala ao reiniciar e aplica a senha padrão também às salas existentes. Para substituir a senha durante a execução:

```bash
MASTER_PASSWORD='sua-senha-privada' pnpm start:host
```

Sem `MASTER_PASSWORD` no próximo início, a senha volta a ser `Mateus2312@`. A variável é lida pelo processo; arquivos `.env` não são carregados automaticamente. Apenas o hash da senha é armazenado. O segredo de assinatura é gerado em `apps/server/dungeons.db.secret`; preserve esse arquivo junto com o banco para que as sessões continuem válidas. Opcionalmente, forneça um segredo persistente por `SESSION_SECRET`.

Ctrl+C encerra o servidor e o túnel. Execute apenas uma instância na porta 2567: encerre `pnpm dev` antes de usar `pnpm start:host`. A URL pública é temporária e muda ao reiniciar o túnel; os tokens salvos pelo navegador pertencem à origem da URL, portanto uma URL nova exige entrar novamente.

## Desenvolvimento e verificações

- `pnpm dev`: servidor em `http://localhost:2567` e Vite em `http://localhost:5173`, com proxy HTTP/WebSocket.
- `pnpm build`: compila shared antes das aplicações.
- `pnpm typecheck`: verifica TypeScript nos três pacotes.
- `pnpm test`: testes de contratos, serialização, autenticação, SQLite, aprovação e reconexão usando `@colyseus/testing` (porta local 2568).
- `pnpm db:generate`: gera uma nova migração a partir de `schema.ts`.
- `pnpm db:migrate`: aplica migrações pendentes.
- `pnpm db:studio`: inspeciona o banco no navegador.

O servidor entrega o cliente compilado, `GET /health` e `GET /api/host-info`. O cliente usa a mesma origem para HTTP e WebSocket; em desenvolvimento há um proxy Vite. Para outro backend, configure `VITE_SERVER_URL` antes de compilar o cliente. `PORT` permite alterar a porta do servidor isolado; o comando de túnel usa 2567.

## Sessões e reconexão

O navegador guarda `df_session_token`, `df_reconnection_token`, `df_room_code` e `df_player_name`. Após uma queda, o SDK tenta reconectar por até 60 segundos sem criar outro jogador. Após recarregar a página, o card **Continuar sessão** usa o token nativo e, se necessário, o token assinado persistente. Uma identidade aceita somente uma conexão por vez.

A entrada nova persiste `PENDING_APPROVAL` e entrega credenciais provisórias para recuperar a espera após um reload; elas não concedem aprovação. Ao aprovar, o servidor grava `APPROVED` no banco e renova o token HMAC na mesma transação. O estado sincronizado avança para `NEEDS_CHARACTER_CREATION`, e `SESSION_CREDENTIALS` substitui as credenciais no navegador. O token provisório anterior deixa de ser aceito para um novo `joinById`.

Na restauração da sala, jogadores com `APPROVED` no banco voltam à etapa `NEEDS_CHARACTER_CREATION`; o Mestre permanece `APPROVED`. A chave de `RoomState.players` é o UUID persistente, com vínculo interno entre `sessionId` e UUID. Esse vínculo evita trocar a identidade quando uma conexão é recriada. O host e a sala garantem um registro `ACTIVE` em `sessions` sem criar outro a cada reconexão.

Cancelar um pedido pendente libera o nome. Sair depois da aprovação preserva a identidade para voltar. **Esquecer sessão neste navegador** apaga as credenciais locais; isso não remove um jogador já aprovado do banco. Nomes são únicos na sala sem diferenciar maiúsculas de minúsculas; `Mestre` é reservado.

O servidor envia heartbeat a cada 20 segundos e responde ao ping do cliente. Os logs registram timestamp ISO, IP mascarado e RTT, sem senhas ou tokens. Somente o Mestre pode aprovar/recusar; clientes não podem criar salas pelo endpoint de matchmaking.

## Banco de dados e migrações

O banco padrão é `apps/server/dungeons.db`, com WAL, timeout de 5 segundos e chaves estrangeiras. Migrações são aplicadas antes de o servidor ficar pronto. `DATABASE_PATH` permite escolher outro arquivo; prefira um caminho absoluto.

As tabelas em `apps/server/src/db/schema.ts` são `rooms`, `players`, `sessions` e `_dungeons_migrations`. Datas usam milissegundos Unix. O Drizzle mantém seu controle nativo em `__drizzle_migrations`; o ledger do jogo registra a versão `0.1.0` e o checksum da migração inicial.

Para alterar a estrutura, edite `schema.ts`, rode `pnpm db:generate`, revise o SQL gerado e execute `pnpm db:migrate`. Versione os arquivos SQL e seus metadados. Não altere uma migração já aplicada: gere outra. Faça backup antes de mudanças que removam ou transformem dados.

## Planejamento e validação

- [Visão do jogo](Documents/planejamento-jogo.md)
- [Escopo da Fase 1](Documents/Fase1.md)
- [Validação e teste manual](Documents/fase1-validacao.md)
