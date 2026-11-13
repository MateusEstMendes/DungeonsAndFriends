# Validação da Fase 3 — v0.3.0

Implementação em 2026-11-13. Plano: [Fase3.md](Fase3.md).

## Validação automatizada

Resultado: 44 testes Vitest, dois testes Playwright e build dos três pacotes aprovados.

- Núcleo hexagonal: conversão de centros e cliques internos em coordenadas positivas/negativas e três escalas; anéis; A* com paredes bidirecionais, custos e destinos ocupados; FOV limitado a quatro hexágonos.
- Movimento: passos, cooldown de 30s, intervalo de 1s no modo livre, FCFS, revisão de posição após intervenção do Mestre, entrada/saída de portal e rejeição de saída ocupada.
- Rede: o codec não transmite IDs ou nomes de monstros distantes, atrás de parede, ocultos ou em outra câmara. Testa visão compartilhada e remoção após perda de visão. Integração com `@colyseus/testing` verifica o estado de dois jogadores e do Mestre por WebSocket.
- Persistência: migração de banco anterior preserva identidades e fichas; seed transacional; posição, câmara e cooldown são persistidos. Drizzle confirma ausência de alterações pendentes após o snapshot `0002`.
- Editor: expansão de borda, dez Undo/Redo exatos, descarte da ramificação de Redo, objetos ocultos e rotacionados, histórico de reposicionamento e paredes.
- Névoa: teste de memória da visita atual e limpeza ao trocar de câmara e voltar.
- Chromium desktop: login do Mestre, edição, Undo/Redo, troca de câmara, visão macro, Debug e saída sem erros JavaScript.
- Chromium mobile em 390 × 844: entrada de personagem READY, renderização da névoa, ausência de IDs secretos nos frames iniciais, toque real movendo de `(0,0)` a `(1,0)`, layout sem rolagem horizontal e preferência de movimento reduzido. Após redimensionar, o teste atravessa para a Galeria Submersa e retorna ao Átrio, confirmando as posições sincronizadas nas duas transferências.

As capturas de referência são geradas em `.local/phase3-master.png`, `.local/phase3-player-mobile.png` e `.local/phase3-player-moved.png`. Os testes usam um banco separado; o banco real da mesa não é alterado pelo Playwright.

## Validação manual confirmada pelo usuário

- Em 2026-11-13, o usuário confirmou: "Todos passaram", referindo-se aos testes manuais propostos nesta sessão.
- A confirmação abrange controles e pinch, movimento e colisões, cooldown, névoa e visibilidade, portais, editor, Undo/Redo, disputa entre jogadores, prioridade do Mestre, reconexão e persistência.
- As verificações físicas anteriormente pendentes ficam registradas como aprovadas pelo usuário. A avaliação de fluidez é manual; não foi realizada nova medição instrumental de FPS pelo agente.

Fase 3 validada, sem pendências de testes relatadas. Host e túnel permanecem encerrados conforme solicitação do usuário.
