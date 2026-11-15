# Fase 6 — Progresso de implementação

## Incremento 1 — Etapa 1: Banco e sanitização

Implementado conforme a ordem de `fase6-plano.md`:

- Migração aditiva `0005_finalize_mvp_schema.sql` e snapshot Drizzle. Cria `crash_recovery_checkpoints`, os três índices compostos previstos e o marcador `editor_history.discarded`. Mantém foreign keys habilitadas e preserva as tabelas existentes sem reconstrução.
- Checkpoints têm uma entrada por sala, JSON de sala/combate validado como objeto e referência composta que impede vincular o checkpoint à sessão de outra sala. A gravação/restauração dos checkpoints será integrada na Etapa 2.
- Inicialização SQLite mantém WAL, timeout de 5 segundos e FKs; define `synchronous=NORMAL`, aceita `DB_SYNCHRONOUS=FULL` e rejeita valores inválidos. Executa `quick_check` e validação de referências antes de migrar/seedar.
- `checkpointWal('PASSIVE' | 'TRUNCATE')` fica disponível na conexão. Rejeita chamadas dentro de transações e retorna os contadores do SQLite, incluindo leitores que impediram a consolidação.
- `pnpm db:sanitize` aplica migrações sem executar os seeds. Faz limpeza transacional, consolida WAL com TRUNCATE, exige `integrity_check=ok` e retorna código 1 se houver corrupção, referências inválidas, erro ou WAL ocupado.
- Limpeza conserva sessões ACTIVE e checkpoints de recuperação ativa, fichas, ouro, inventários, grimórios, encontros e tokens de sessão. Remove sessões CLOSED expiradas e seus checkpoints antigos após 30 dias, histórico explicitamente marcado `discarded=1` e tokens de reconexão inativos há mais de 120 segundos (janela conservadora para a tolerância de 60s e o heartbeat de 20s).
- Entradas `undone=1` continuam disponíveis para Redo; esse campo não significa descarte. Undo/Redo ignora entradas explicitamente descartadas. O fluxo existente que elimina uma ramificação ao criar outra edição foi mantido.

### Operação

Execute a manutenção com o host parado e sem outros leitores do banco:

```sh
pnpm db:sanitize
```

O comando respeita `DATABASE_PATH`, como os demais comandos de banco. Para a opção de durabilidade FULL, configure `DB_SYNCHRONOUS=FULL` no ambiente do host. O padrão NORMAL protege contra queda de processo; FULL aumenta a durabilidade contra perda física de energia.

### Validação

- `pnpm build`: passou; permanece o aviso existente de bundle acima de 500 kB.
- Vitest: 29 arquivos, 184 testes passaram. Os seis testes novos cobrem upgrade sequencial com dados em cada fase, índices/FKs/JSON, WAL e FULL/NORMAL, preservação/limpeza seletiva, rollback, integridade e execução real de `pnpm db:sanitize` com sucesso e erro.
- Playwright: os dois cenários de tabuleiro desktop/mobile passaram com a migração 0005, incluindo editor, Undo/Redo, movimento e portais.
- `git diff --check`: passou.
- A validação utilizou bancos temporários; não foi executada sanitização no banco habitual do jogo.

Etapa 1 concluída. A suíte final de crash recovery/PWA/áudio/Lighthouse permanece para os incrementos correspondentes.

## Próximo incremento — Etapa 2

Implementar o serviço de checkpoints e o ciclo de encerramento/restauração: decisão do Mestre após crash, preservação de participantes e orçamento de ações, pausa inicial de combate, modal de recuperação e retry de conexão após queda do host.

Áudio, PWA, ergonomia adicional, teste SIGKILL, Lighthouse e Mesa Zero permanecem nas Etapas 3–5. A fase 6 ainda não está concluída.
