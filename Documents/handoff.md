# Handoff — Dungeons & Friends

Atualizado em 2026-11-13.

## Fase 3 — implementação v0.3.0

Foram implementados núcleo hexagonal, mapas e migração `0002`, seed de três câmaras, FOV compartilhado e StateView por cliente, movimento FCFS, portais, cooldowns e prioridade do Mestre. O cliente READY e o Mestre acessam o tabuleiro PixiJS, com camadas, névoa em RenderTexture, pan/zoom, HUD e editor com Undo/Redo persistente. As animações seguem as skills oficiais GSAP Core, React, Performance e Timeline: contexto por cena, limpeza, timelines de percurso e movimento reduzido.

Build, 44 testes Vitest e dois testes Playwright constam em [fase3-validacao.md](fase3-validacao.md). Em 2026-11-13, o usuário confirmou que todos os testes manuais passaram, concluindo a validação da Fase 3. Host e túnel foram encerrados a pedido e permanecem desligados. `pnpm test:e2e` usa Chrome e banco isolado em `.local/`; requer `pnpm build` antes. O snapshot Drizzle foi gerado e conferido sem diferenças pendentes. Não foi criado commit.

O protocolo agora é `0.3.0`; reinicie o servidor e recarregue os clientes juntos. O banco real é migrado na próxima inicialização. Preserve o banco e o segredo de sessões. As seções abaixo registram o histórico da Fase 1.

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

## Estado da implementação

A implementação da Fase 1 (`v0.1.0`) foi concluída: monorepo, schemas e validadores compartilhados, SQLite/Drizzle, autenticação, sala persistente, fila de aprovação, reconexão, heartbeat, túnel com QR Code, stores e telas responsivas.

Últimas verificações: build e TypeScript passaram; 21 testes Vitest passaram. Na etapa anterior, Chromium validou login do Mestre, aprovação, recusa, reload com identidade preservada, offline/online, heartbeat e layout mobile. Um aviso que permanecia após reconectar foi corrigido e a verificação local foi repetida com sucesso.

Uma tentativa adicional de teste pelo Quick Tunnel encontrou falha de DNS na URL temporária. Posteriormente, em 2026-11-12, o usuário confirmou que todos os sete itens do checklist passaram, incluindo os testes físicos em 4G/5G, aprovação, reconexão, reload e heartbeat de três minutos pelo túnel. O checklist está concluído com base nessa confirmação do usuário. Consulte `Documents/fase1-validacao.md`.

## Integração e dados — seção 3 concluída

A aprovação agora grava `APPROVED` no banco e renova o token HMAC; o estado sincronizado usa `NEEDS_CHARACTER_CREATION`. Na restauração, esse mapeamento é refeito para jogadores. Credenciais provisórias preservam a espera após reload e são substituídas na aprovação. O payload de credenciais tem contrato Zod compartilhado e a persistência local tem testes próprios. O UUID continua sendo a chave estável do jogador; `sessionId` é vinculado internamente. Host e sala garantem um registro `ACTIVE` em `sessions`.

## Cuidados para continuar

- Consulte `Documents/Fase1.md` e `Documents/planejamento-jogo.md` para o escopo. Fichas, mapas e combate pertencem às próximas fases.
- Preserve a alteração pré-existente do usuário em `Documents/Fase1.md`.
- A última checagem mostrou arquivos novos ainda não versionados; não foi criado commit nesta sessão.
- Não inicie dois servidores na porta 2567. `pnpm dev` e `pnpm start:host` usam essa porta.
- Preserve `apps/server/dungeons.db` e seu arquivo `.secret` para manter as identidades persistentes.
- Uma nova URL de Quick Tunnel muda a origem do navegador e não tem acesso ao localStorage da URL anterior.

Instruções de execução e configuração estão no `README.md`.
