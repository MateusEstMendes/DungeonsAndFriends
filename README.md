# Dungeons & Friends

Fase 4 `v0.4.0`: monorepo pnpm com TypeScript, React 19 / Vite 8 / Tailwind 4, Colyseus 0.18, SQLite / Drizzle, tabuleiro e arena POV PixiJS 8, combate autoritativo e animações GSAP.

## Começar uma mesa

Requisitos: Node.js 24, pnpm 12.16.1 e o binário oficial [cloudflared](https://developers.cloudflare.com/tunnel/downloads/) em `.tools/cloudflared.exe` no Windows, `.tools/cloudflared` no Linux/macOS ou no PATH. `CLOUDFLARED_PATH` permite escolher outro caminho. O host verifica o executável antes de iniciar o servidor e informa o caminho esperado se ele estiver ausente.

```bash
pnpm install
pnpm start:host
```

A senha padrão do Mestre neste projeto pessoal é `Mateus2312@`. O terminal mostra o código da sala e informa se a senha padrão ou `MASTER_PASSWORD` está em uso. Abra a URL pública, expanda **Acesso do Mestre** e faça login. Compartilhe o convite ou QR Code com os jogadores; o código da sala vem preenchido pelo parâmetro `?room=`. Cada jogador informa seu nome e aguarda a aprovação do Mestre na fila de pedidos.

O Mestre usa **Pedidos** para aprovar ou recusar. O jogador aprovado cria a ficha, exporta seu token e entra no tabuleiro. O Mestre já acessa o editor da masmorra. Combate pertence às próximas fases.

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
- `pnpm test:combat`: regras determinísticas, dados, migração e executor de combate.
- `pnpm test:combat-sim`: simula 10.000 turnos sem interface e apresenta dano, cura e esquivas.
- `pnpm test:e2e`: testes Chromium do tabuleiro em desktop e mobile, após `pnpm build`. Usa banco separado em `.local/` e servidor na porta 4179; encerra o servidor ao terminar. No Windows usa o Chrome instalado; `CHROME_PATH` permite informar outro executável Chromium.
- `pnpm db:generate`: gera uma nova migração a partir de `schema.ts`.
- `pnpm db:migrate`: aplica migrações pendentes.
- `pnpm db:studio`: inspeciona o banco no navegador.

O servidor entrega o cliente compilado, `GET /health` e `GET /api/host-info`. O cliente usa a mesma origem para HTTP e WebSocket; em desenvolvimento há um proxy Vite. Para outro backend, configure `VITE_SERVER_URL` antes de compilar o cliente. `PORT` permite alterar a porta do servidor isolado; o comando de túnel usa 2567.

## Sessões e reconexão

O navegador guarda `df_session_token`, `df_reconnection_token`, `df_room_code` e `df_player_name`. Após uma queda, o SDK tenta reconectar por até 60 segundos sem criar outro jogador. Após recarregar a página, o card **Continuar sessão** usa o token nativo e, se necessário, o token assinado persistente. Uma identidade aceita somente uma conexão por vez.

A entrada nova persiste `PENDING_APPROVAL` e entrega credenciais provisórias para recuperar a espera após um reload; elas não concedem aprovação. Ao aprovar, o servidor grava `APPROVED` no banco e renova o token HMAC na mesma transação. O estado sincronizado avança para `NEEDS_CHARACTER_CREATION`, e `SESSION_CREDENTIALS` substitui as credenciais no navegador. O token provisório anterior deixa de ser aceito para um novo `joinById`.

Na restauração da sala, jogadores aprovados com ficha voltam a `READY`, preservando posição, câmara, passos e cooldown, mas permanecem ausentes até se conectarem. Personagens expulsos continuam aguardando nova aprovação. Aprovados sem ficha entram em `NEEDS_CHARACTER_CREATION`; o Mestre permanece `APPROVED`. A chave de `RoomState.players` é o UUID persistente, com vínculo interno entre `sessionId` e UUID. O host e a sala garantem um registro `ACTIVE` em `sessions` sem criar outro a cada reconexão.

Cancelar um pedido pendente sem ficha libera o nome. Pedidos de retorno com ficha preservam a identidade ao cancelar. Sair depois da aprovação preserva a identidade para voltar. **Esquecer sessão neste navegador** apaga as credenciais locais; isso não remove um jogador já aprovado do banco. Nomes são únicos na sala sem diferenciar maiúsculas de minúsculas; `Mestre` é reservado.

O menu **Personagens** do Mestre separa conectados e ausentes e permite consultar suas fichas. O personagem aparece no mapa, ocupa uma casa e contribui para a visão compartilhada enquanto está conectado à sala ou dentro dos 60 segundos de tolerância após uma queda. **Sair** remove sua presença imediatamente. Após a ausência definitiva, o personagem também sai da iniciativa e deixa de ser alvo; seu turno avança, e o combate termina se não restar nenhum herói vivo participante.

**Expulsar** remove imediatamente o personagem, inclusive durante a janela de reconexão, e preserva sua ficha. O jogador usa **Continuar sessão** para solicitar nova aprovação. Saídas comuns dispensam essa aprovação. No retorno, o servidor tenta a posição anterior e depois a casa livre mais próxima na mesma câmara. Sem espaço, o jogador aguarda sem token, e o Mestre usa **Posicionar** no menu Personagens para escolher uma casa válida, inclusive em outra câmara. Se houver combate em andamento, **Incluir no combate** adiciona o personagem ao fim da iniciativa por decisão do Mestre, preservando o turno atual.

O servidor envia heartbeat a cada 20 segundos e responde ao ping do cliente. Os logs registram timestamp ISO, IP mascarado e RTT, sem senhas ou tokens. Somente o Mestre pode aprovar/recusar; clientes não podem criar salas pelo endpoint de matchmaking.

## Banco de dados e migrações

O banco padrão é `apps/server/dungeons.db`, com WAL, timeout de 5 segundos e chaves estrangeiras. Migrações são aplicadas antes de o servidor ficar pronto. `DATABASE_PATH` permite escolher outro arquivo; prefira um caminho absoluto.

As tabelas em `apps/server/src/db/schema.ts` incluem `rooms`, `players`, `characters`, `sessions`, `maps`, `chambers`, `terrain_cells`, `walls`, `placed_objects`, `editor_history` e `_dungeons_migrations`. Datas usam milissegundos Unix. O Drizzle mantém seu controle nativo em `__drizzle_migrations`; o ledger do jogo registra a versão `0.1.0` e o checksum da migração inicial. A migração `0002` adiciona mapas e posições, e o seed transacional cria três câmaras conectadas quando não há mapas.

A migração `0003_add_combat_system.sql` adiciona `monsters_catalog`, `combat_encounters`, `combat_participants` e `active_buffs`, com catálogo inicial e um encontro ativo por sala. HP/MP, participantes e turno são gravados na mesma transação SQLite. Encontros `ACTIVE` são carregados ao iniciar a sala e conciliados com a presença: personagens offline são retirados, e o encontro termina se não restar nenhum herói vivo participante. Durante uma reconexão dentro da tolerância, rodada, iniciativa e ações restantes são preservadas. Encontros encerrados ou concluídos por fuga não são retomados.

Para alterar a estrutura, edite `schema.ts`, rode `pnpm db:generate`, revise o SQL gerado e execute `pnpm db:migrate`. Versione os arquivos SQL e seus metadados. Não altere uma migração já aplicada: gere outra. Faça backup antes de mudanças que removam ou transformem dados.

## Planejamento e validação

- [Visão do jogo](Documents/planejamento-jogo.md)
- [Escopo da Fase 1](Documents/Fase1.md)
- [Validação e teste manual](Documents/fase1-validacao.md)
- [Escopo da Fase 3](Documents/Fase3.md)
- [Validação da Fase 3](Documents/fase3-validacao.md)
- [Escopo da Fase 4](Documents/Fase4.md)
- [Implementação do combate](Documents/fase4-implementacao.md)

## Tabuleiro e editor

O seletor **Entidades → Monstro do catálogo** oferece Goblin, Esqueleto Guerreiro, Cultista Arcano, Slime, Lobo Sombrio, Aranha Gigante, Zumbi, Orc Saqueador, Golem de Pedra e Dragão Jovem, com prévia da imagem. As artes fornecidas em `DesignEX/Enemies` são usadas nos tokens e na arena, com arquivos de execução em `apps/client/public/enemies/`. Os tipos ausentes são cadastrados na inicialização sem sobrescrever ajustes existentes; os sete tipos novos têm atributos iniciais para balanceamento.

Cada hexágono aceita um objeto de cada tipo (baú, mesa, cadeira, porta e tocha). Tipos diferentes podem se sobrepor. O servidor bloqueia duplicatas na colocação, no movimento e no Undo/Redo. Objetos acumulados antes dessa regra são preservados e podem ser separados ou removidos pelo painel do Mestre.

Toque/clique em um hexágono para mover. Arraste o chão para pan, use a roda ou dois dedos para zoom e **Centralizar** para reenquadrar. O modo tenso usa `speed` como orçamento; gastar os passos ou encerrá-los inicia 30 segundos de cooldown. O modo livre aplica intervalo de um segundo. Água rasa custa dois passos; paredes, obstáculos, água profunda e destinos ocupados bloqueiam movimento. Portais transferem para a próxima câmara e descartam a memória de névoa da visita anterior.

O editor tem seleção e quatro camadas: Terreno, Paredes, Objetos e Entidades. Terreno amplia os limites. Objetos aceitam rotação e sobreposição; a seleção alterna os elementos do mesmo hexágono, também disponíveis no seletor do painel. **Oculto** controla a visibilidade de objetos e monstros para jogadores. Arrastar um token ou usar coordenadas reposiciona com autoridade do Mestre. **Undo/Redo**, `Ctrl+Z` e `Ctrl+Y` restauram edições; uma edição nova descarta a ramificação de Redo. A restauração rejeita posições que prenderiam ou sobreporiam personagens.

`Ctrl+Shift+D` ou **Debug** mostra coordenadas e alcance de visão. A visão compartilhada de quatro hexágonos é calculada no servidor: `StateView` filtra monstros, objetos e tokens de outros jogadores. A névoa local conserva apenas terreno e paredes da câmara atual. Câmera e tokens usam contextos/timelines GSAP, com limpeza ao sair e respeito a `prefers-reduced-motion`.
