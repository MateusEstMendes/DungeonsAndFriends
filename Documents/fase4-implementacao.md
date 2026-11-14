# Fase 4 — Implementação do combate

A seção 2 de `Fase4.md` reúne seis etapas. As responsabilidades estão distribuídas nesta ordem de dependência:

| Etapa | Implementação | Evidência de funcionamento |
| --- | --- | --- |
| 1. Dados e fórmulas | `packages/shared/src/combat/actions.ts`, `damage.ts` e `apps/server/src/services/diceService.ts` | Testes de DR, esquivas, passivas, ações extras e faixas d20; simulador `combatSim.ts` com 10.000 turnos |
| 2. Estado e migração | `CombatStateSchema` em `RoomState.ts`; migração `0003_add_combat_system.sql` | Banco novo recebe encontros, participantes, buffs e catálogo com Goblin, Esqueleto Guerreiro e Cultista Arcano |
| 3. Executor autoritativo | `rooms/handlers/combat.ts`, registrado em `GameRoom.ts` | Iniciativa por velocidade/destreza, token renovado por ação, trava durante resolução e comandos exclusivos do Mestre |
| 4. Cena e transição | `CombatPOVScene.ts`, `combatArt.ts` e `BoardScreen.tsx` | Entrada em POV por `combatState.active`; cenário por bioma; seleção de monstros e retorno ao tabuleiro |
| 5. VFX e dados visuais | `game/vfx/combatEffects.ts`, `floatingText.ts`, `diceAnimation.ts` | Efeitos por golpe, crítico com tremor, esquiva, absorção de DR e resultados sorteados no servidor |
| 6. Interface | `CombatOverlay.tsx`, `MasterRefereeBar.tsx` e `useCombatStore.ts` | Ações, alvos aliados/inimigos, retrato, recursos, iniciativa e controles de arbitragem em desktop e celular |

## Executar

```powershell
pnpm build
pnpm test:combat
pnpm test:combat-sim
pnpm test:e2e -- tests/e2e/combat.spec.ts
```

O teste de navegador inicia um servidor na porta 4179 com banco descartável em `.local/`. Usa duas sessões independentes, uma do Mestre e outra do jogador em resolução 390×844 durante a batalha. O teste cobre alerta de proximidade, transição, valores de dados iguais, ações extras, defesa, ataque manual de monstro, pausa e modos de fuga. As capturas ficam em `.local/phase4-master.png` e `.local/phase4-player-mobile.png`.

## Usar na mesa

Ao encerrar um movimento próximo de um inimigo visível, o Mestre recebe **Inimigo próximo! Iniciar Combate**. O botão inicia o encontro na câmara indicada. Também é possível preparar o encontro pelo botão do tabuleiro do Mestre. O servidor exige ao menos um herói vivo com ficha e um monstro com entrada no catálogo.

O jogador escolhe o inimigo na arena ou na lista de alvos. Os cards de aliados selecionam o alvo de cura, proteção ou poção. A primeira ação é livre; ações adicionais seguem a família determinada por FOR/INT. Fuga fica indisponível nessas ações extras.

O Mestre assume um monstro tocando nele ou usando **Controlar monstro**. Os ataques ficam disponíveis no turno desse monstro. **Iniciativa** permite antecipar ou atrasar participantes na fila; **Pular turno** avança imediatamente. Pausa, bloqueio de fuga, fuga garantida, faixas d20 e encerramento são validados no servidor.

Os resultados são enviados por `COMBAT_EVENT`, com os dados efetivamente sorteados e o dano após mitigação. O cliente apresenta esses valores e não calcula resultados de combate. As animações respeitam redução de movimento; efeitos temporários são descartados ao ocultar a aba ou sair da cena.

