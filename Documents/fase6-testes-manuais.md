# Fase 6 — testes durante a pausa

Etapas 1, 2 e 3 estão commitadas. Etapa 4 (PWA/mobile) está em andamento no diretório de trabalho, sem commit de conclusão. Etapa 5 ainda não foi executada. Use um banco separado para estes testes.

## Iniciar

Na raiz do projeto:

```sh
mkdir -p .local
DATABASE_PATH="$PWD/.local/fase6-manual.db" pnpm start:host
```

O host imprime o convite e o código da sala. Use a senha do Mestre configurada no projeto ou defina `MASTER_PASSWORD` no comando. Preserve `.local/fase6-manual.db` e seu segredo entre reinícios. Uma nova URL do túnel exige entrar novamente; para testar reconexão automática, mantenha a mesma origem (por exemplo, localhost).

Para desenvolvimento local sem túnel, use `pnpm dev` e abra http://localhost:5173. Para validar PWA, use o cliente de produção servido pelo host em HTTPS ou localhost.

## Roteiro

1. Entrar como Mestre e aprovar dois jogadores em navegadores/perfis distintos. Criar fichas, mover, atravessar portais e comprar/saquear itens.
2. Abrir **Áudio**, tocar na tela e testar música, volumes separados e silêncio. Atualizar a página e conferir persistência. No Mestre, testar **Trovão** e **Porta Pesada** nos demais clientes. Minimizar e reabrir no celular.
3. Iniciar combate, gastar uma ação/MP e anotar HP, MP, ouro, turno e posições. Encerrar abruptamente somente o processo Node do servidor de teste, sem **Encerrar Sessão**, e reiniciar com o mesmo banco/segredo. Restaurar pelo modal do Mestre. Conferir os valores e a iniciativa; o combate deve permanecer pausado até o Mestre despausar.
4. Testar também **Descartar e Criar Nova**: fichas e itens devem permanecer, combate deve terminar. **Encerrar Sessão** deve impedir o prompt de recuperação no próximo início.
5. No celular, testar instalar na tela inicial, voltar ao aplicativo, pinça seguida de toque e cancelamento do gesto. Pinça não deve mover personagem nem editar terreno. Controles devem continuar acessíveis sem rolagem horizontal.

Anote navegador/dispositivo, passos, resultado esperado e observado. Cache permite abrir a interface offline; jogar exige o servidor conectado.

## Verificações automatizadas

```sh
pnpm build
pnpm test
pnpm test:e2e
```

No Linux, se necessário: `pnpm exec playwright install chromium`. Para um Chrome específico, informe `CHROME_PATH`. Lighthouse, teste automatizado SIGKILL e Mesa Zero permanecem pendentes da etapa 5; os testes físicos iOS/Android também não foram realizados nesta sessão.
