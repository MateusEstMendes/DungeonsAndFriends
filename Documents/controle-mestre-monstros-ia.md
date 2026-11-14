# Controle do Mestre, monstros e IA — análise e especificações complementares

Data: 14/11/2026. Estado: documento para planejamento; mudanças ainda não implementadas.

## 1. Resultado da análise

O plano já prevê que o Mestre arbitra o combate e controla os monstros, podendo comandar todos manualmente ou delegar à IA. Isso está distribuído entre a Fase 4, a Fase 5 e o playtest da Fase 6. Não é necessário criar uma funcionalidade nova de IA fora dessas fases.

Há, porém, uma diferença entre o comportamento planejado e a interface atual: a apresentação do Mestre ainda compartilha elementos da perspectiva dos heróis. Este documento registra essa lacuna e os detalhes de controle que ainda precisam ser definidos para implementar a Fase 5 sem manter a confusão de papéis.

### O que já está previsto

| Documento | Previsão existente | Situação observada no código |
| --- | --- | --- |
| [Planejamento geral](planejamento-jogo.md), seções 6 e 7 | Mestre assume qualquer monstro; controle manual de movimento, ataque, defesa e habilidade; automático individual; intervenção do Mestre | Controle manual de ações existe; movimentação tática e IA ainda não estão implementadas no combate |
| [Fase 4](Fase4.md), seções 1.2, 1.3 e etapa 6 | Comando `MASTER_MANUAL_MONSTER_ACTION`, barra de arbitragem e seleção de monstro | Implementado parcialmente em relação à experiência desejada: permite agir como o monstro do turno, mas a perspectiva visual continua compartilhada com a dos jogadores |
| [Roadmap](roadmap-mvp.md), Fase 5 | Automático por monstro ou global | Ainda não implementado |
| [Fase 5](Fase5.md), seção 1.2 e etapa 5 | `tacticalAi.ts`, `isAutoMode`, IA corpo a corpo e à distância, restrição de fuga | Arquivo e executor automático ainda não existem |
| [Especificação de telas](especificacao-telas.md), seção 6.4 | Ativar IA e assumir uma criatura, exibindo seus ataques e os heróis como alvos | Assumir criatura existe; chave de IA e apresentação consistente por papel estão pendentes |
| [Fase 6](Fase6.md), checklist final | Mesa com 1 Mestre e 3–4 jogadores, incluindo um combate manual e outro automático | Validação futura; não substitui a implementação da Fase 5 |

## 2. Diagnóstico do comportamento atual

### O Mestre não é um herói participante

O Mestre tem identidade de conexão em `RoomState.players`, com papel `MASTER`. Estar nessa coleção permite autenticação, presença e comandos administrativos; isso não significa participar da iniciativa como personagem.

Em [GameRoom.ts](../apps/server/src/rooms/GameRoom.ts), o Mestre permanece `APPROVED`, não recebe ficha de jogador e não pode usar a criação de personagem. Em [combat.ts](../apps/server/src/rooms/handlers/combat.ts), o encontro coleta personagens presentes com ficha e HP positivo, além dos monstros da câmara. A ação manual exige papel `MASTER` e participante ativo do tipo `MONSTER`. O Mestre não recebe um corpo próprio para lutar contra os monstros nesse fluxo.

### Onde a interface pode causar a impressão relatada

Em [CombatOverlay.tsx](../apps/client/src/components/combat/CombatOverlay.tsx):

- Os cards de aliados são sempre montados com participantes `PLAYER`, inclusive na tela do Mestre.
- O lado usado para listar inimigos só muda para `MONSTER` quando é o turno de um monstro e esse mesmo monstro está selecionado para controle. Fora dessa condição, o lado volta a `PLAYER`.
- O retrato e os recursos inferiores acompanham o participante ativo da iniciativa, inclusive quando ele é um herói observado pelo Mestre.
- A doca compartilhada apresenta as ações universais, em vez de distinguir claramente observação, arbitragem e comando da criatura.

Em [CombatPOVScene.ts](../apps/client/src/game/scenes/CombatPOVScene.ts), a cena central renderiza monstros para todos os clientes. Na tela do Mestre, tocar num monstro também preenche tanto a seleção de controle quanto a seleção de alvo. Isso mistura dois conceitos que precisam ficar claros na interface.

Em [MasterRefereeBar.tsx](../apps/client/src/components/combat/MasterRefereeBar.tsx), o Mestre já pode selecionar qualquer monstro da lista. Ele pode controlar vários monstros ao longo do encontro, um por vez conforme a iniciativa; não executa ações de todos simultaneamente.

O método `tick()` do servidor não executa decisões automáticas. Não há estado de controle manual/IA por criatura nem comando para alterná-lo. A IA está planejada, mas ainda não está disponível.

Essas conclusões vêm da leitura do código e dos documentos. O relato visual não foi reproduzido em uma nova sessão de navegador nesta análise.

## 3. Comportamento solicitado

### Papéis e participantes

- O Mestre é o árbitro e controlador dos monstros. Sua identidade não deve aparecer como herói, aliado dos jogadores, alvo de dano ou participante da iniciativa.
- Cada jogador controla seu próprio personagem. O Mestre pode consultar e administrar personagens sem assumir o papel de herói na batalha.
- Selecionar uma criatura para comandar não cria outro participante nem concede ações adicionais.

### Controle de vários monstros

- O Mestre deve conseguir comandar todos os monstros do encontro manualmente, respeitando o turno e os recursos de cada um.
- Cada criatura deve apresentar nome, identificação suficiente para distinguir monstros iguais, HP/MP, modo de controle e indicação de turno.
- Escolher um monstro fora do turno permite inspecioná-lo; não adianta sua vez nem autoriza ataque imediato.
- A interface deve informar claramente qual criatura está sendo comandada e quais são os alvos válidos daquela ação.

### Delegação à IA

- Permitir automático individual e um controle global para colocar os monstros em automático, conforme o roadmap existente.
- Permitir combate misto: por exemplo, o Mestre controla um chefe enquanto a IA controla dois Goblins.
- Permitir ao Mestre retomar o controle de uma criatura delegada à IA.
- Executar IA tática no servidor, reutilizando as regras autoritativas de movimento, alcance, ações, dano e recursos. O plano descreve uma máquina de decisão, não uma integração com serviço externo de IA.
- Manter os comportamentos já previstos: aproximação e ataque corpo a corpo, distância/linha de visão para ataques à distância, recuo quando necessário e proibição de fuga automática sem autorização.

## 4. Especificações complementares propostas

As propostas abaixo detalham pontos que o plano atual não fecha. Devem ser revisadas durante o planejamento da mudança.

### 4.1 Perspectiva da tela do Mestre

- Separar o indicador de **participante em ação** do indicador de **monstro selecionado para controle**.
- No turno de um herói, mostrar ao Mestre que ele está acompanhando a ação do jogador; não apresentar comandos que sugiram controlar aquele herói.
- No turno de um monstro manual, destacar “Controlando: [criatura]”, suas ações e os heróis que podem ser atacados. Cura e proteção devem selecionar aliados da criatura conforme a habilidade.
- A apresentação do lado dos monstros não deve depender de haver um monstro selecionado naquele instante. Sem seleção, mostrar arbitragem/inspeção, com indicação do que fazer para comandar.
- Separar seleção de criatura controlada de seleção de alvo. Trocar a criatura deve limpar ou revalidar o alvo e o submenu aberto.
- Ações disponíveis devem vir da ficha/catálogo da criatura e dos recursos restantes; não presumir que todo monstro possui todas as ações de um herói.

### 4.2 Estado de controle e alternância

- Representar o modo manual/IA de cada criatura no servidor e sincronizá-lo com o painel do Mestre. Uma seleção local como `manualMonsterId` não é suficiente para conceder ou revogar controle.
- Definir o efeito do controle global sobre exceções individuais e monstros adicionados depois. Exibir o modo efetivo de cada criatura para evitar ambiguidade.
- Uma ação já confirmada deve terminar uma única vez. Ao assumir controle manual, cancelar decisões automáticas ainda não confirmadas e impedir que a IA consuma a próxima ação da criatura.
- Antes de aplicar uma decisão automática, conferir novamente encontro, criatura, turno, modo de controle, pausa, presença do alvo e recursos.
- Pausar ou encerrar o combate deve impedir novas decisões automáticas. Trocar o modo não deve restaurar HP/MP, ações, consumíveis ou recargas.
- Definir e persistir o modo de controle. Reconexão e recuperação de sessão não devem duplicar ações já resolvidas.

### 4.3 Movimento e integração com as regras atuais

O servidor atualmente bloqueia `MASTER_MOVE_ENTITY` durante o combate. Portanto, a movimentação tática da Fase 5 não pode depender de simplesmente reutilizar o arraste administrativo do editor.

- Planejar uma operação de movimento de combate validada no servidor, utilizada tanto pelo comando manual quanto pela IA.
- Especificar orçamento de deslocamento, momento do movimento em relação às ações, alcance, paredes, colisões e linha de visão.
- Definir o comportamento quando não houver caminho ou alvo válido, para que a IA não fique tentando indefinidamente nem trave a iniciativa.
- Considerar as regras de presença já implementadas: jogador ausente definitivamente deixa de ser alvo; a tolerância de 60 segundos mantém a presença após queda; personagem sem posição não participa; retorno ao combate depende do Mestre.
- Compatibilizar a recuperação prevista na Fase 6 com essas regras de ausência, evitando reintroduzir automaticamente personagens offline apenas porque estavam em um checkpoint.

### 4.4 Decisão confirmada — indicação de atacante, alvo e dano

Decisão do usuário: a interface deve deixar explícito se quem está agindo é um monstro ou um personagem de jogador, com efeito visual de dano na visão do jogador atingido. Esse requisito está confirmado; a aparência e a intensidade dos efeitos serão detalhadas no planejamento.

- Exibir nome e tipo do participante ativo e identificar atacante e alvo durante a resolução. Exemplos: “Goblin 2 ataca Ael” e “Ael ataca Goblin 2”. Quando um monstro for comandado pelo Mestre, o atacante continua sendo a criatura; o nome do Mestre não substitui o dela.
- Destacar visualmente a criatura ou o personagem que executa a ação e o alvo que recebe o golpe, inclusive em encontros com vários monstros iguais.
- Quando o próprio personagem do jogador receber dano, apresentar impacto na sua visão, destacar seu retrato/card e exibir o dano aplicado junto à atualização da barra de HP. O efeito não pode parecer um golpe recebido pelo monstro que aparece no centro da arena.
- Quando outro herói for atingido, destacar o card desse aliado e seu dano, distinguindo esse evento de dano sofrido pelo próprio jogador.
- Quando um jogador atacar um monstro, apresentar o impacto, o dano e a alteração de HP na criatura atingida.
- Na visão do Mestre, identificar a mesma origem e o mesmo destino da ação, permitindo acompanhar qual monstro atacou qual herói, tanto em modo manual quanto automático.
- Distinguir dano, crítico, esquiva, bloqueio/absorção e cura com texto e sinais visuais, sem depender apenas de cores. Uma esquiva não deve produzir indicação de perda de HP; a absorção deve ser diferenciada do dano efetivamente aplicado.
- Sincronizar indicação, impacto, número de dano e HP com o resultado confirmado pelo servidor. Efeitos são apresentação do evento, sem aplicar dano novamente ou antecipar um acerto ainda não resolvido.
- Respeitar redução de movimento: manter identificação textual, destaque do alvo, valores e HP, reduzindo ou removendo tremores e flashes. Intensidade, duração e estilo visual ficam para o planejamento.

## 5. Decisões para o próximo planejamento

1. **Modo inicial:** monstros começam em manual ou automático? A preferência vale por sala, encontro ou criatura?
2. **Comando global:** altera todos os modos individuais ou funciona como padrão com exceções? O que acontece com criaturas adicionadas depois?
3. **Assumir controle:** o toque no monstro apenas o inspeciona ou já desliga sua IA? Como a interface confirma que o controle foi assumido?
4. **Tela do Mestre:** manter a arena frontal com painel de monstros ou oferecer uma visão tática própria? A inversão visual completa da arena não está detalhada nos documentos atuais.
5. **Mestre desconectado:** os monstros automáticos continuam? Um turno manual aguarda reconexão ou pausa o encontro? O prazo não deve ser presumido a partir da tolerância de presença dos jogadores.
6. **Sem ação válida:** a criatura defende, aguarda ou passa? Como o Mestre recebe a explicação?
7. **Movimento no turno:** como deslocamento e ações se combinam para comandos manuais e automáticos?

## 6. Encaixe sugerido nas fases

| Momento | Trabalho proposto |
| --- | --- |
| Correção complementar à Fase 4 | Separação visual dos papéis, controle e alvo; seleção clara de vários monstros; comandos coerentes com a criatura; identificação de atacante/alvo e efeitos de dano na perspectiva de quem foi atingido |
| Fase 5, junto ao motor de IA | Modos individual/global/misto, comando manual e IA pelo mesmo executor, movimentação tática e alternância sem ações duplicadas |
| Fase 6 | Persistência dos modos nos checkpoints, reconexão do Mestre, ergonomia mobile e playtest manual/automático/misto |

O plano de economia, itens e lojas permanece separado. Este documento não aprova automaticamente uma ordem de implementação nem altera as checklists das fases existentes.

## 7. Critérios de aceitação para incluir no plano

- [ ] Iniciar um encontro com 1 Mestre, 2 heróis e 3 monstros: existem 5 participantes na iniciativa, e a identidade do Mestre não é alvo nem recebe turno.
- [ ] O Mestre comanda os 3 monstros nos respectivos turnos; dano, cura e recursos pertencem à criatura que agiu.
- [ ] No turno de um herói, a tela do Mestre indica observação/arbitragem, sem sugerir que ele é aquele personagem.
- [ ] Ao atacar, monstro e herói são identificados por nome e tipo; todas as visões indicam corretamente quem agiu e quem foi atingido.
- [ ] Um monstro ataca o próprio personagem do jogador: há impacto na visão desse jogador, destaque do seu retrato/card, dano aplicado e atualização coerente de HP.
- [ ] Um monstro ataca outro herói: o efeito destaca o aliado atingido, sem sugerir que o jogador observador recebeu dano.
- [ ] Um herói ataca um monstro: impacto, valor e HP aparecem na criatura correta, inclusive com monstros de nomes iguais.
- [ ] Esquiva, absorção, crítico e cura são distinguíveis; redução de movimento preserva as informações essenciais sem exigir tremores ou flashes.
- [ ] Monstros com o mesmo nome podem ser diferenciados e selecionados sem ambiguidade.
- [ ] O alvo permanece coerente ao trocar de criatura; o servidor rejeita ações de jogador tentando comandar monstro e comandos fora do turno.
- [ ] Todos os monstros em automático jogam seus turnos sem intervenção manual; o modo misto mantém apenas as criaturas escolhidas sob IA.
- [ ] Assumir uma criatura enquanto a IA prepara uma decisão aplica no máximo uma ação válida, preservando ações restantes e recursos.
- [ ] Pausa, fim de combate, morte ou ausência do alvo invalidam decisões automáticas pendentes.
- [ ] Movimento manual e IA obedecem ao mesmo orçamento, alcance, paredes, colisões e linha de visão.
- [ ] Um monstro sem caminho/alvo segue a política definida, sem loop infinito ou iniciativa travada.
- [ ] Reconexão do Mestre e restauração mantêm os modos definidos e não repetem uma ação confirmada.
- [ ] O playtest da Fase 6 inclui manual com vários monstros, automático e misto, em desktop e celular.
