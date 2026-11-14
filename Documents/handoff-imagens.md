# Handoff — atualização das imagens e apresentação do combate

Atualizado em 14/11/2026.

## Objetivo da próxima etapa

Substituir a arte provisória dos inimigos da arena por sprites estáticos com identidade visual consistente. A sensação de combate virá dos ataques, magias, impactos, reações e informações na interface, no formato discutido de batalhas com sprites parados e ataques animados.

Atualização de 14/11/2026: o usuário forneceu as dez imagens em `DesignEX/Enemies` e solicitou apenas cadastrar os inimigos e utilizar suas artes. Os dez tipos agora estão no catálogo, no seletor do Mestre com prévia, nos tokens do mapa e na arena. A ampliação dos efeitos e a mudança da perspectiva do Mestre continuam como planejamento separado.

Os PNGs originais têm 1254 × 1254 pixels e transparência. Foram copiados, sem edição, para `apps/client/public/enemies/` com nomes estáveis. O carregamento PixiJS reutiliza as texturas entre criaturas e mantém a arte provisória como alternativa na arena se uma imagem falhar. Os sprites da arena ficam estáticos, preservam suas proporções e têm escala ajustada ao número de inimigos.

O catálogo compartilhado está em `packages/shared/src/rules/monsters.ts`. `apps/server/src/db/seedMonsters.ts` adiciona registros ausentes na inicialização, inclusive em bancos existentes, sem sobrescrever atributos personalizados ou mapas. Os três inimigos anteriores mantêm seus valores; os outros sete receberam atributos iniciais, sujeitos a balanceamento.

## Direção escolhida

- Uma imagem principal estática por inimigo, de corpo inteiro, diretamente de frente para a câmera.
- Fundo realmente transparente, com margem ao redor de cabeça, pés/patas, arma, asas e cauda. Nenhuma parte cortada.
- Estilo 2D de fantasia, formas claras, contorno escuro uniforme e complexidade moderada: fácil de copiar e redesenhar, preservando personalidade.
- Uma cor-base e um tom de sombra por material/região, com poucas cores secundárias e iluminação consistente.
- Armas e acessórios próprios de cada design; sem esconder rosto e tronco. Animais e criaturas usam suas armas naturais.
- Sem cenário, texto, marca-d'água ou efeitos de ataque embutidos no sprite principal.
- Ataques e reações serão animados separadamente. Poses alternativas podem ser adicionadas depois.

O usuário tem um PC com 4 GB de RAM, sem placa de vídeo dedicada, e informou que não consegue usar Blender. Foram discutidos aplicativos de celular, mas nenhum editor foi escolhido. O fluxo inicial deve permitir receber uma imagem estática por criatura sem exigir Blender, esqueleto articulado, renderização 3D ou vídeo.

## Produção das imagens

O prompt está pronto em [prompt-design-inimigos.md](prompt-design-inimigos.md).

É um único prompt contendo a fila de dez designs, com a instrução de gerar **uma imagem com um inimigo por resposta**, começar pelo Goblin e aguardar “próximo”. Pode ser reutilizado para novas versões. Correções devem alterar somente a criatura atual. Não gerar uma prancha com os dez personagens.

| Ordem | Inimigo | Situação no jogo | Característica do design |
| --- | --- | --- | --- |
| 1 | Goblin | Já cadastrado | Verde, pequeno, couro e adaga |
| 2 | Esqueleto Guerreiro | Já cadastrado | Ossos marfim, espada e escudo |
| 3 | Cultista Arcano | Já cadastrado | Túnica roxa e cajado com cristal |
| 4 | Slime | Cadastrado | Gel verde, sem arma artificial |
| 5 | Lobo Sombrio | Cadastrado | Quadrúpede, pelagem escura, presas e garras |
| 6 | Aranha Gigante | Cadastrado | Oito pernas, presas e marca vermelha |
| 7 | Zumbi | Cadastrado | Humanoide deteriorado, roupas rasgadas, sem violência gráfica |
| 8 | Orc Saqueador | Cadastrado | Robusto, couro e machado |
| 9 | Golem de Pedra | Cadastrado | Blocos de pedra, runas e punhos grandes |
| 10 | Dragão Jovem | Cadastrado | Vermelho, quatro patas, duas asas e cauda |

Todos os dez já podem ser colocados pelo editor e participar de encontros. Foram utilizados os tipos de ataque que o executor atual já suporta. Veneno, teias, ataques em área e outras habilidades específicas não foram acrescentados nesta etapa; balanceamento e habilidades especiais permanecem pendentes.

## Integração na stack atual

O cliente usa PixiJS 8 e GSAP. A atualização inicial pode aproveitar essa stack, com imagens estáticas como texturas e animações de transformação/efeitos no cliente.

Arquivos relacionados para continuar o trabalho:

- [combatArt.ts](../apps/client/src/game/scenes/combatArt.ts): cenários e arte provisória mantida como alternativa se a imagem de um monstro falhar.
- [CombatPOVScene.ts](../apps/client/src/game/scenes/CombatPOVScene.ts): sprites da arena, enquadramento, seleção, barras de HP e reprodução dos impactos.
- [combatEffects.ts](../apps/client/src/game/vfx/combatEffects.ts): efeitos separados de golpes e magias.
- [floatingText.ts](../apps/client/src/game/vfx/floatingText.ts): valores de dano, cura e resultados.
- [CombatOverlay.tsx](../apps/client/src/components/combat/CombatOverlay.tsx): identidade de atacante/alvo, retratos e reações dos heróis.
- [motion.ts](../apps/client/src/game/motion.ts): ciclo de vida das animações e redução de movimento.

Diretrizes para manter e ampliar a integração:

1. Guardar os originais e preparar versões de uso no jogo, inicialmente PNG com transparência. Definir resolução e eventual conversão para WebP após testar legibilidade e memória.
2. Usar uma associação estável entre tipo de monstro e arquivo visual. Preservar a compatibilidade atual dos nomes antigos `Sentinela` e `Monstro`, sem depender somente de nomes exibidos para expandir o catálogo.
3. Carregar e reutilizar texturas entre criaturas do mesmo tipo. Cada instância mantém HP, seleção e animações próprios.
4. Normalizar escala e ponto de apoio dos sprites para não haver saltos de posição, pés flutuando ou armas/asas cortadas.
5. Prever imagem alternativa se um recurso estiver ausente ou falhar ao carregar. A falha visual não deve interromper o combate.
6. Manter os resultados no servidor. O cliente reproduz o `COMBAT_EVENT` e não aplica dano por conta da animação.

O retrato da ficha e o token circular do tabuleiro permanecem representações distintas da imagem de corpo inteiro da arena. A troca da arte dos monstros não exige refazer o criador de personagens.

## Ataques e reações planejados

| Evento | Apresentação pretendida |
| --- | --- |
| Espera | Sprite estático, com movimento discreto opcional |
| Ataque físico | Preparação/avanço breve do atacante e efeito de corte, estocada, garra ou impacto no alvo |
| Magia | Efeito de conjuração e projétil ou explosão correspondente à habilidade |
| Dano no monstro | Reação no sprite correto, número de dano e alteração coerente de HP |
| Dano no próprio jogador | Impacto na sua visão e destaque do seu retrato/card, com dano e HP |
| Dano em outro herói | Destaque no card do aliado atingido, sem sugerir dano ao observador |
| Esquiva | Reação de esquiva e texto, sem indicação falsa de perda de HP |
| Absorção, crítico e cura | Sinais visuais e texto distinguindo os resultados |
| Derrota | Escurecimento, desaparecimento ou pose alternativa, a definir |

O conjunto inicial sugerido é corte, impacto, projétil mágico, cura, esquiva e derrota. A lista exata, o estilo e a duração de cada efeito ainda devem ser definidos. Efeitos podem ser procedurais em PixiJS/GSAP ou pequenas sequências de imagens; isso não exige animar o corpo por partes.

## Clareza dos papéis — requisito confirmado

Consultar [controle-mestre-monstros-ia.md](controle-mestre-monstros-ia.md), especialmente a seção 4.4.

Cada ação deve identificar quem agiu e quem recebeu o golpe, por exemplo: “Goblin 2 ataca Ael”. O atacante é a criatura, mesmo quando o Mestre a controla. Na tela do Mestre, observar um turno de jogador não deve sugerir que ele está jogando como aquele herói.

Impacto, dano e HP devem corresponder ao mesmo evento confirmado. Respeitar redução de movimento e evitar repetir efeitos de eventos já reproduzidos. A apresentação deve funcionar com vários monstros iguais e em controle manual, automático ou misto quando esses modos estiverem disponíveis.

## Próximos passos

- [x] Receber as dez imagens fornecidas pelo usuário, incluindo Goblin, Esqueleto Guerreiro e Cultista Arcano.
- [x] Conferir transparência real dos dez arquivos e suas prévias no editor; preservar o enquadramento e as margens dos originais sem editar os desenhos.
- [x] Definir pasta, nomes de arquivos e associação com o catálogo atual; nesta etapa foram preservadas as dimensões originais.
- [x] Integrar as imagens dos dez inimigos ao mapa, à prévia do editor e à arena, com alternativa em caso de falha de carregamento na arena.
- [ ] Implementar uma sequência completa: indicação do atacante → ataque → impacto no alvo → dano/HP → retorno à espera.
- [ ] Validar dano no monstro, no próprio jogador e em outro herói, também na visão do Mestre.
- [x] Expandir o catálogo para os dez tipos, preservando os valores existentes no banco.
- [ ] Testar em desktop e celular, com múltiplas criaturas, imagens ausentes e redução de movimento.

Ainda estão pendentes a eventual otimização das imagens para resoluções menores, a ampliação dos efeitos e a escolha do editor de celular, caso seja utilizado. Animações esqueléticas, vídeo e 3D foram alternativas discutidas; não são requisitos desta primeira atualização de imagens.

## Verificação deste handoff

102 testes Vitest aprovados, incluindo ataques dos dez inimigos, disponibilidade das imagens, compatibilidade dos nomes antigos e seed idempotente com preservação de atributos personalizados. TypeScript e build aprovados.

No Playwright, os dois cenários de tabuleiro e o combate completo passaram na primeira execução. O teste de dano mínimo também passou, mas sua saída fechava os contextos sem sair da sala e bloqueava os testes seguintes durante a tolerância de reconexão. Após corrigir essa limpeza, passaram em sequência dano mínimo, novos inimigos e expulsão/retorno com ficha preservada. Os seis cenários foram, assim, verificados em duas execuções; a suíte inteira não foi repetida após o ajuste de limpeza.

O novo teste confere as dez prévias do editor, coloca Slime, Golem de Pedra e Dragão Jovem e inicia um encontro com eles e os monstros existentes. Não houve erros de página ou respostas de imagem com falha. A captura inspecionada está em `.local/enemies-arena.png`; testes e capturas usam banco descartável, sem alterar a partida real.
