# Fase 6 — validação técnica

Data: 2026-11-15. Bancos descartáveis em `.local/` e diretórios temporários; o banco habitual não foi sanitizado nem substituído.

## Resultados

| Verificação | Resultado |
| --- | --- |
| Build TypeScript/Vite/PWA | Aprovado |
| Vitest completo | 32 arquivos, 190 testes aprovados |
| Credenciais e áudio após separação do armazenamento | 5 testes aprovados |
| SIGKILL em processo Node separado | Aprovado: dois heróis, magia com MP consumido e dano ao monstro, iniciativa, token, orçamento de ações, fichas e integridade preservados |
| Playwright | 11 cenários aprovados em rodadas sequenciais; cenários afetados por timeout/cascata repetidos após corrigir o isolamento e as esperas |
| Lighthouse mobile | Performance 91; acessibilidade, boas práticas e SEO 100 |
| Teste em celulares físicos | Usuário informou que testou e funcionou; dispositivos e itens individuais não especificados |
| Mesa Zero (90–120 min, participantes reais, Wi-Fi e rede móvel) | Pendente de aceite manual |

O teste SIGKILL exercita a persistência real em WAL e a restauração do executor de combate. O teste de sala cobre decisão de recuperação e reconexão; o SIGKILL não simula uma sessão humana completa via túnel. A abertura offline se refere à interface e aos assets já armazenados: a partida continua exigindo o servidor.

O Lighthouse instalado não inclui a antiga categoria PWA. Manifesto, Service Worker, cache offline e API sem cache são verificados pelo Playwright. A pontuação de performance é da entrada/lobby sob emulação mobile, não uma medição de FPS da arena WebGL.

## Reproduzir

```sh
pnpm build
pnpm test
pnpm test:e2e
pnpm test:lighthouse
```

Instale Chromium com `pnpm exec playwright install chromium` quando necessário. `CHROME_PATH` seleciona um executável alternativo. Deixe a porta 4179 livre para os testes/auditoria e execute Lighthouse sem outra suíte concorrendo por CPU. O relatório bruto fica em `.local/lighthouse-phase6.json`; o workflow CI está configurado para publicar relatórios como artefatos (não executado remotamente nesta sessão).

Cada teste de navegador inicia um servidor com banco descartável exclusivo e encerra seus contextos e processo ao terminar, inclusive em falhas. Isso impede que a reserva de reconexão de 60 segundos de um caso afete o seguinte. O cenário que recarrega o cliente em combate aguarda até 60 segundos para reconstrução de Pixi/WebGL e tem orçamento total de seis minutos no Chromium por software; as mesmas verificações de iniciativa e ações continuam obrigatórias.

Para aceite manual, siga [fase6-testes-manuais.md](fase6-testes-manuais.md). Não há registro de execução da Mesa Zero nesta sessão.


## Fechamento

A implementação e a automação das cinco etapas estão concluídas. O aceite final da release permanece condicionado à Mesa Zero. A rodada completa anterior teve seis cenários aprovados e cinco falhas de espera/captura ou cascata de conexões; os cenários afetados foram repetidos com isolamento por teste e esperas adequadas ao Chromium por software. A última rodada de seis cenários aprovou cinco; a repetição isolada do catálogo aprovou o restante. Não houve uma nova execução única dos onze após esses ajustes finais do harness.
