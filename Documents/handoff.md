# Handoff — Dungeons & Friends

Atualizado em 2026-11-12.

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
