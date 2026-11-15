# Dungeons & Friends

**Versão 1.0.0**

RPG multiplayer de mesa para jogar com amigos pelo navegador. O Mestre prepara a masmorra, conduz a aventura e controla os encontros; os jogadores criam seus personagens, exploram o tabuleiro e enfrentam monstros em combates por turnos.

A partida reúne tabuleiro hexagonal, visão compartilhada, criação visual de personagens, inventário, lojas e uma arena de combate em perspectiva. Um computador hospeda a mesa e compartilha o acesso com o grupo por link ou QR Code.

## Conteúdo

- [O que o jogo apresenta](#o-que-o-jogo-apresenta)
- [Como começar uma mesa](#como-começar-uma-mesa)
- [Controles](#controles)
- [Sessões e recuperação](#sessões-e-recuperação)
- [Configuração do host](#configuração-do-host)
- [Desenvolvimento](#desenvolvimento)
- [Banco de dados](#banco-de-dados)
- [Documentação](#documentação)

## O que o jogo apresenta

### Personagens

- Oito raças com modificadores e habilidades passivas: Humano, Anão, Elfo, Orc, Vampiro, Demônio, Meio-Dragão e Meio-Tubarão.
- Cinco classes: Guerreiro, Bárbaro, Ladino, Mago e Clérigo.
- Distribuição de atributos por pontos e ficha com os dados do personagem.
- Personalização visual por camadas, incluindo cabelos, olhos, barba, marcas raciais e chifres, com escolha de cores.
- Exportação do token do personagem e rascunho de criação salvo no navegador.

### Exploração e masmorras

- Tabuleiro hexagonal com câmaras conectadas por portais.
- Névoa de guerra e visão compartilhada do grupo, calculada pelo servidor.
- Terrenos com custos de movimento e obstáculos que bloqueiam a passagem.
- Modo livre para explorar e modo tenso com orçamento de passos e intervalo de 30 segundos após gastar ou encerrar o movimento.
- Cenários com biomas de masmorra, caverna, floresta e taverna.

### Ferramentas do Mestre

- Aprovação de entrada dos jogadores e consulta das fichas de personagens conectados ou ausentes.
- Editor de terreno, paredes, objetos e entidades, com ações de desfazer e refazer.
- Colocação e reposicionamento de monstros, mercadores, baús, mesas, cadeiras, portas e tochas.
- Objetos e monstros que podem ficar ocultos para os jogadores.
- Controle manual ou por IA dos monstros, pausa de combate e configuração de fuga.
- Reposicionamento de personagens e inclusão de jogadores em um combate em andamento.

### Combate

- Encontros por turnos com iniciativa, rodadas, HP e MP.
- Ataques, defesas, magias, habilidades de classe, consumíveis e tentativa de fuga.
- Arena em perspectiva com animações, efeitos visuais e registro de combate.
- Regras e resultados validados pelo servidor.
- Catálogo com Goblin, Esqueleto Guerreiro, Cultista Arcano, Slime, Lobo Sombrio, Aranha Gigante, Zumbi, Orc Saqueador, Golem de Pedra e Dragão Jovem.

### Itens e economia

- Inventário, equipamentos, consumíveis e ouro.
- Baús com recompensas configuradas pelo Mestre.
- Mercadores com nome, diálogo, estoque e catálogo editáveis.
- Compra de itens e venda por 50% do preço base; itens equipados precisam ser desequipados antes da venda.

### Áudio e acesso

- Controles de volume geral, música, efeitos e silêncio, salvos no navegador.
- Efeitos de Trovão e Porta Pesada que o Mestre pode disparar para o grupo.
- Interface com controles de mouse e toque.
- Instalação como aplicativo (PWA) em HTTPS ou localhost e cache dos arquivos da interface.
- Aviso de atualização, com aplicação bloqueada durante o combate.

A interface pode abrir offline após ser armazenada em cache. Para jogar, é necessário estar conectado ao servidor da mesa. O primeiro toque ou clique libera o áudio no navegador.

## Como começar uma mesa

### Requisitos do host

- **Node.js 24**.
- **pnpm 12.16.1**, conforme o campo `packageManager` do projeto.
- Binário oficial do [cloudflared](https://developers.cloudflare.com/tunnel/downloads/), necessário para compartilhar a mesa pela internet.

Coloque o executável em `.tools/cloudflared.exe` no Windows ou `.tools/cloudflared` no Linux/macOS. Também é possível disponibilizá-lo no `PATH` ou definir `CLOUDFLARED_PATH`.

### Iniciar e convidar o grupo

```bash
pnpm install
pnpm start:host
```

O comando compila o projeto, inicia o servidor e abre um túnel público. O terminal mostra a URL de acesso, o código da sala e as informações de entrada do Mestre.

1. Abra a URL pública e expanda **Acesso do Mestre**.
2. Entre com a senha do Mestre. A senha padrão do projeto é `Mateus2312@`; para usar outra, configure `MASTER_PASSWORD` antes de iniciar.
3. Compartilhe o convite ou QR Code com os jogadores. O link já preenche o código da sala.
4. Cada jogador informa seu nome e aguarda na fila de pedidos.
5. O Mestre aprova a entrada pelo menu **Pedidos**.
6. Os jogadores criam seus personagens e entram no tabuleiro; o Mestre prepara a exploração e os encontros.

Para iniciar com uma senha própria no Linux/macOS:

```bash
MASTER_PASSWORD='sua-senha-privada' pnpm start:host
```

No PowerShell:

```powershell
$env:MASTER_PASSWORD = 'sua-senha-privada'
pnpm start:host
```

Use **Ctrl+C** para encerrar o host e o túnel. Mantenha apenas uma instância na porta 2567; encerre `pnpm dev` antes de executar `pnpm start:host`.

A URL pública é temporária e muda ao reiniciar o túnel. Como as credenciais do navegador pertencem à origem da URL, um endereço novo exige entrar novamente.

## Controles

| Ação | Controle |
| --- | --- |
| Mover o personagem | Clique ou toque em um hexágono acessível |
| Mover a câmera | Arraste o chão do tabuleiro |
| Aproximar ou afastar | Roda do mouse ou gesto com dois dedos |
| Reenquadrar o tabuleiro | Botão **Centralizar** |
| Desfazer edição do Mestre | **Undo** ou `Ctrl+Z` |
| Refazer edição do Mestre | **Redo** ou `Ctrl+Y` |
| Mostrar coordenadas e visão | **Debug** ou `Ctrl+Shift+D` |

## Sessões e recuperação

O banco local preserva a sala, as fichas, os inventários e as alterações do mapa. O navegador guarda as credenciais necessárias para oferecer **Continuar sessão**.

- Após uma queda de conexão, o cliente tenta reconectar automaticamente. A janela de tolerância é de 60 segundos.
- Sair preserva o personagem para um retorno posterior. **Esquecer sessão neste navegador** remove as credenciais locais, sem apagar a ficha do banco.
- Expulsar preserva a ficha, mas exige nova aprovação do Mestre para voltar.
- Após uma interrupção do host, o Mestre pode restaurar ou descartar a sessão recuperável. Um combate restaurado mantém o turno e começa pausado.
- **Encerrar Sessão** fecha o combate e elimina o marcador de recuperação.

Preserve o banco e o arquivo de segredo do host para manter os dados e a validade das sessões entre reinicializações.

## Configuração do host

As variáveis são lidas do ambiente do processo. Arquivos `.env` não são carregados automaticamente.

| Variável | Finalidade |
| --- | --- |
| `MASTER_PASSWORD` | Define a senha do Mestre, inclusive para a sala existente. Sem a variável, o host usa a senha padrão do projeto. |
| `SESSION_SECRET` | Define um segredo persistente para assinar as sessões. Quando omitido, o host gera e mantém um arquivo ao lado do banco. |
| `DATABASE_PATH` | Escolhe o arquivo SQLite. Prefira um caminho absoluto. |
| `DB_SYNCHRONOUS` | Aceita `NORMAL` (padrão) ou `FULL`, para maior durabilidade contra perda de energia. |
| `CLOUDFLARED_PATH` | Informa um caminho alternativo para o executável do túnel. |
| `PORT` | Altera a porta do servidor isolado. O fluxo `start:host` usa a porta 2567. |
| `VITE_SERVER_URL` | Define outro backend para o cliente; deve ser configurada antes da compilação. |
| `CHROME_PATH` | Informa um executável Chromium para os testes de navegador e a auditoria Lighthouse. |

## Desenvolvimento

O projeto é um monorepo TypeScript com pnpm.

| Área | Tecnologias |
| --- | --- |
| Interface | React 19, Vite 8, Tailwind CSS 4 e Zustand |
| Tabuleiro e combate | PixiJS 8 e GSAP |
| Comunicação em tempo real | Colyseus 0.18 e WebSocket |
| Servidor | Node.js, Express e regras autoritativas |
| Persistência | SQLite e Drizzle ORM |
| Áudio e PWA | Howler e Workbox |
| Verificações | Vitest, Playwright e Lighthouse |

```text
apps/
  client/          Interface, tabuleiro, arena e áudio
  server/          Salas, regras do servidor, persistência e túnel
packages/
  shared/          Contratos, regras, dados e geometria hexagonal
Documents/
  Importants/      Planejamento, arquitetura e especificações
scripts/           Geração de áudio e auditoria
```

### Executar localmente

```bash
pnpm install
pnpm dev
```

Acesse `http://localhost:5173`. O servidor roda em `http://localhost:2567`, e o Vite encaminha as requisições HTTP e WebSocket.

Na versão compilada, o servidor entrega o cliente pela mesma origem, além dos endpoints `GET /health` e `GET /api/host-info`.

### Testar aparência sem iniciar o jogo

Se já houver uma instância anterior do visualizador aberta, encerre-a com **Ctrl+C** antes de executar o comando novamente.

```bash
pnpm test:appearance
```

O comando compila o pacote compartilhado e abre automaticamente `http://localhost:5180/` no criador, direto na aba **Aparência**. Só o visualizador local é iniciado: não precisa de backend, banco, sala ou aprovação do Mestre. Se o ambiente remoto não abrir o navegador, acesse a URL exibida no terminal. Toda entrada desse visualizador abre a aparência, mesmo sem parâmetros na URL. A porta 5180 deve estar livre; o comando informa se já estiver em uso.

Troque entre as oito raças, ajuste peças e cores e use **Exportar retrato e token** para conferir e baixar as imagens WebP usadas pelo jogo. O teste usa o mesmo renderizador da criação normal, guarda um rascunho separado no navegador e atualiza automaticamente ao editar o código. Encerre com **Ctrl+C**. Esse modo está disponível apenas em desenvolvimento.

### Comandos disponíveis

| Comando | Descrição |
| --- | --- |
| `pnpm test:appearance` | Abre o teste visual de aparência sem servidor do jogo |
| `pnpm dev` | Inicia cliente e servidor em desenvolvimento |
| `pnpm start:host` | Compila o projeto e inicia o host com túnel público |
| `pnpm build` | Compila os pacotes e as aplicações |
| `pnpm typecheck` | Verifica os tipos nos três pacotes |
| `pnpm test` | Executa a suíte Vitest |
| `pnpm test:combat` | Executa os testes das regras, dados e servidor de combate |
| `pnpm test:combat-sim` | Simula 10.000 turnos sem interface |
| `pnpm test:e2e` | Executa cenários de navegador com Playwright; requer `pnpm build` |
| `pnpm test:lighthouse` | Audita o cliente compilado e grava `.local/lighthouse-phase6.json` |
| `pnpm audio:build` | Regenera os arquivos de áudio originais |
| `pnpm db:generate` | Gera migrações a partir do schema |
| `pnpm db:migrate` | Aplica as migrações pendentes |
| `pnpm db:studio` | Abre a inspeção do banco no navegador |
| `pnpm db:sanitize` | Verifica integridade e faz manutenção do SQLite com o host parado |

Os testes E2E e a auditoria usam banco descartável e a porta 4179, que precisa estar livre. Os testes de sala usam a porta local 2568.

## Banco de dados

O banco padrão fica em `apps/server/dungeons.db`. As migrações são aplicadas antes de o servidor ficar pronto, e o mapa inicial é criado quando ainda não há mapas.

O SQLite usa WAL, chaves estrangeiras e gravações transacionais para os estados de jogo. Sem `SESSION_SECRET`, o segredo de assinatura fica em `apps/server/dungeons.db.secret`; mantenha esse arquivo junto com o banco nos backups.

Para alterar a estrutura, edite `apps/server/src/db/schema.ts`, execute `pnpm db:generate`, revise o SQL e rode `pnpm db:migrate`. Versione o SQL e seus metadados. Crie uma nova migração em vez de alterar uma já aplicada.

Com o host parado, `pnpm db:sanitize` consolida o WAL, verifica a integridade e remove registros antigos elegíveis para limpeza. O comando preserva fichas, inventários, recuperação de sessões ativas e histórico ainda disponível para desfazer/refazer. Faça backup antes de mudanças que removam ou transformem dados.

## Documentação

- [Planejamento do jogo](Documents/Importants/planejamento-jogo.md)
- [Arquitetura técnica](Documents/Importants/arquitetura-tecnica.md)
- [Especificação das telas](Documents/Importants/especificacao-telas.md)
- [Roadmap do MVP](Documents/Importants/roadmap-mvp.md)
- [Controle do Mestre e IA dos monstros](Documents/Importants/controle-mestre-monstros-ia.md)
- [Direção visual dos inimigos](Documents/Importants/prompt-design-inimigos.md)
