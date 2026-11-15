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

## Etapa 2 — Recuperação e ciclo de sessão

- Checkpoints e eventos mutantes são confirmados na mesma transação SQLite. Os dados relacionais (fichas, equipamentos, ouro, baús, mapa e participantes) são a fonte autoritativa; o checkpoint registra metadados, presença e estado do combate. Falhas restauram memória e banco.
- Boot preserva participantes, ausências, iniciativa, ações consumidas e turnToken; combate reinicia pausado e IA fica bloqueada até a decisão do Mestre. Modal permite restaurar ou descartar preservando fichas e economia.
- Encerrar Sessão fecha o encontro, marca CLOSED, remove checkpoint e consolida WAL. Sair depois disso não recria marcador de recuperação. Uma ação nova inicia outra sessão.
- Cliente tenta reconectar com token persistente após esgotar a reconexão nativa, com backoff e jitter, cancelável ao sair.
- Validação: 30 arquivos / 186 testes passaram, incluindo orçamento de ações, preservação de ausentes, rollback de checkpoint e encerramento sem falso prompt. Cenários existentes de reinício agora confirmam a restauração explicitamente.
- Teste brutal em processo separado e verificações de navegador ficam na etapa 5. Validação física iOS/Android e Mesa Zero exigem dispositivos e participantes reais.

## Etapa 3 — Áudio imersivo

- Howler com WebAudio, desbloqueio por gesto, recuperação de contexto ao voltar para a aba, crossfade e cancelamento de timers antigos nas trocas rápidas de cena.
- Preferências persistentes `df_audio_prefs`, volumes independentes e mute; painel acessível a jogadores e Mestre.
- Pipeline determinístico `pnpm audio:build`: 15 SFX originais com gaps de 500 ms e duas músicas em loop, WebM/Opus e MP3. Proveniência/CC0 no README dos assets.
- Gatilhos de passos/portais por estado confirmado, combate por eventos sem duplicação, dados, transações confirmadas e efeitos narrativos globais. Pacote Zod restringe efeitos; só Mestre pode disparar, com intervalo de 400 ms.
- API vigente do Howler usa `autoUnlock`, substituindo a opção legada `mobileAutoEnable` citada no plano.
- Validação: build passou; suíte completa com 188 testes passou; rodada específica com 18 testes passou após adicionar o cenário narrativo (autorização, broadcast, rate limit e payload inválido). Testes de áudio cobrem desbloqueio, retorno da aba, crossfade rápido, limites do sprite e outcomes reais de esquiva/cura/magia.
- Reprodução audível e comportamento em iPhone/Android físicos ainda precisam de verificação manual.

## Pausa solicitada pelo usuário

Etapas 1–3 registradas em `c045c91`, `ffda6b0` e `c558413`. Etapa 4 tem implementação de PWA, ícones, cache, prompt seguro, gestos e recuperação gráfica no diretório de trabalho, ainda sem conclusão/commit. Etapa 5 pendente. Não considerar a fase 6 concluída.

Roteiro para testar: [fase6-testes-manuais.md](fase6-testes-manuais.md). Alterações externas nos documentos de especificação foram preservadas.

Build de preparação para a pausa: `pnpm build` passou, incluindo geração do Service Worker e manifesto. A etapa 4 ainda precisa dos testes de navegador antes do commit de conclusão.

## Retomada — validação das etapas 4 e 5 em andamento

- Build PWA passou. Divisão automática do Vite preserva lazy loading; agrupamento manual foi retirado porque trouxe dependências gráficas para o lobby e depois causou erro de inicialização.
- Removido ajuste de altura que deslocava o centro do canvas para um controle de comércio. Tabuleiro desktop e mobile/portais passaram novamente.
- Vitest: 31 arquivos / 189 testes aprovados. Teste adicional em processo separado executa SIGKILL após magia, confirma HP/MP, posições, ouro, iniciativa, ações e integridade SQLite: aprovado.
- Cenários E2E de magia/IA e perspectiva do Mestre passaram. Cenário seguinte de combate falhou aguardando arena; contexto ficou aberto e afetou os próximos testes. Adicionado teardown dos contextos explícitos em todas as specs para impedir cascata. Revalidação isolada em andamento.
- Lighthouse inicial: performance 70, acessibilidade/boas práticas/SEO 100; medição anterior à retirada dos chunks manuais. Nova medição pendente. Lighthouse atual não fornece a antiga categoria PWA; manifesto, cache e SW são testados no Playwright.
- Etapas 4 e 5 ainda não marcadas concluídas. Mesa Zero e dispositivos físicos continuam pendentes.

Validação manual informada pelo usuário na retomada: **testou nos celulares e funcionou**. Modelos, navegadores e verificações individuais não foram especificados; não inferir validação completa de cada item nem execução da Mesa Zero.

## Etapa 4 — PWA e mobile concluída

- Manifesto standalone, ícones PNG reproduzíveis, metadados iOS, Workbox com cache de mídia e rotas de API exclusivamente em rede. Atualização fica bloqueada durante combate.
- Pinça trava o toque até todos os dedos saírem; cancelamento/visibilidade limpam ponteiros, histerese de 8 px e velocidade de pan limitada. Controles táteis, safe areas e tratamento de perda/restauração de contexto WebGL implementados.
- A divisão de chunks fica a cargo do Vite, com as telas lazy já existentes. Agrupamento manual descartado após validação revelar carregamento gráfico indevido no lobby e erro de inicialização.
- Build passou. Os dois cenários de tabuleiro (desktop/mobile/portais) passaram. Os dois testes novos de PWA e pinça passaram em 20,5 s: manifesto, cache offline de áudio, reabertura da interface offline, API sem cache, pinça sem edição e toque posterior funcional.
- Validação em celulares informada pelo usuário: funcionou. Etapa 5 continua em validação; não confundir este registro com aprovação da Mesa Zero.

### Etapa 5 — ponto atual da validação final

- Lighthouse final atingiu **91** em performance mobile e **100** em acessibilidade, boas práticas e SEO, executado sem suítes concorrentes. `pnpm test:lighthouse` passa e produz relatório em `.local/`.
- Para reduzir trabalho no lobby, o módulo de rede carrega na primeira conexão; a leitura de credenciais locais e a função de presença foram separadas da inicialização dos validadores/schemas. O pacote shared permite tree shaking de módulos sem efeitos globais. Bundle inicial: aproximadamente 281 kB.
- Última suíte Vitest completa: **32 arquivos / 190 testes passaram**. Após separar armazenamento, os cinco testes específicos de credenciais e áudio também passaram.
- Suíte E2E final ainda em execução no mesmo build. Até aqui, tabuleiro desktop/mobile, magia/IA e perspectiva do Mestre foram aprovados. Aguardar o resultado total antes de marcar a etapa técnica concluída.

## Etapa 5 — implementação e validação técnica concluídas

- Criado teste real de SIGKILL em processo separado, com dois heróis, dano por magia e MP consumido. Confere recursos, ouro, posições, iniciativa, token, ações e integridade após reabrir o WAL.
- `pnpm test:lighthouse` executa auditoria em host/banco descartável e exige performance >= 90. Resultado final: **91**; acessibilidade/boas práticas/SEO **100**.
- Workflow CI preparado para build, Vitest, Playwright, Lighthouse e artefatos. Não houve execução remota do workflow nesta sessão.
- Testes E2E agora criam servidor e banco por cenário, liberando contextos/processos mesmo em falhas. Screenshots e transições de reconstrução/saída de arena têm esperas explícitas para o Chromium por software; nenhum critério de resultado foi removido.
- Resultado: **190 testes Vitest aprovados** e **11 cenários E2E aprovados em rodadas sequenciais**. A rodada completa teve seis aprovados e cinco falhas de timeout/captura ou cascata; os casos afetados foram repetidos após corrigir o harness. A última rodada aprovou cinco de seis, e o catálogo restante passou isoladamente. Não foi feita outra execução única de todos os onze após esses ajustes.
- Build e testes específicos finais de credenciais/áudio passaram. O diff desta entrega foi verificado antes do commit.

**Entrega técnica das cinco etapas concluída.** O usuário informou sucesso nos testes em celulares. **A Mesa Zero de 90–120 minutos com participantes reais e redes mistas permanece pendente para aceite final da release**; não foi simulada nem declarada executada. Relatório: [fase6-validacao.md](fase6-validacao.md).
