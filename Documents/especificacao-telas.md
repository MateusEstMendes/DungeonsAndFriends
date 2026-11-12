# Especificação de Telas, UX e Design Visual — Dungeons & Friends

Documento dedicado à arquitetura visual, ergonomia de telas, fluxo de navegação e componentes de interface do usuário (UI/UX) para Desktop e Mobile/PWA.

---

## 1. Princípios de Identidade Visual e Ergonomia

- **Estética Medieval-Fantasia Tátil**:
  - Paleta com tons escuros profundos (ardósia, pedra envelhecida `#18181b` e `#0f172a`), detalhes dourados metálicos (`#d97706` e `#f59e0b`), pergaminho amarelado suave para modais de leitura e toques de magia (azul arcano, vermelho carmesim e verde esmeralda).
  - Bordas entalhadas estilizadas, sombras suaves e texturas rústicas discretas.
- **Design Adaptativo para Celulares (Mobile-First Touch)**:
  - **Área Útil do Tabuleiro Preservada**: No celular, todo o mapa ocupa 100% da viewport. Menus, fichas e inventários nunca ficam fixos cobrindo a visão; eles deslizam em **Gavetas Inferiores (Bottom Sheets)** suaves.
  - **Alvos de Toque Generosos**: Todos os botões, hexágonos clicáveis e atalhos possuem dimensões mínimas de **44x44px** (recomendado 48x48px para ações de combate) evitando toques acidentais com os dedos.
  - **Gestos Naturais**: Suporte nativo a *pinch-to-zoom* (pinça com dois dedos) e arrastar com inércia para mover a câmera.

---

## 2. Página 1: Tela Inicial (Lobby de Entrada e Reconexão)

### 2.1 Layout e Componentes
- **Fundo**: Imagem atmosférica de entrada de masmorra iluminada por tochas com o logotipo estilizado **"Dungeons & Friends"** centralizado no topo.
- **Card Central Unificado**:
  - **Banner de Reconexão Rápida (Condicional)**:
    - Se o navegador possuir um `sessionToken` salvo de uma sala ativa, exibe um card destacado em dourado:
      `[ ⚔️ Continuar como "Thorgar" na Sala #K8X2M ]` com botão de 1 toque para reconexão imediata.
  - **Área do Jogador (Destaque Principal)**:
    - Campo `Código da Sala (5 caracteres)`: Caixa com letras maiúsculas grandes e espaçadas (ex: `[ K ] [ 8 ] [ X ] [ 2 ] [ M ]`). Se o usuário acessou por link com parâmetro (`?room=K8X2M`) ou QR Code, este campo já vem **preenchido automaticamente**.
    - Campo `Seu Nome de Aventureiro`: Input de texto nítido com foco automático.
    - Botão `[ 🚪 Entrar na Masmorra ]`: Botão largo com efeito tátil ao pressionar.
  - **Divisor Discreto**: Linha sutil com a palavra *"ou"*.
  - **Área do Mestre (Acesso Privado)**:
    - Botão retrátil `[ Sou o Mestre do Jogo ]`: Ao clicar, revela o campo de senha.
    - Campo `Senha Secreta do Mestre`: Input de senha mascarado com botão de olho para visualizar.
    - Botão `[ 👑 Abrir Sala do Mestre ]`: Cria uma nova sala ou reabre a sessão existente vinculada ao banco local.

---

## 3. Página 2: Tela de Espera e Fila de Aprovação

### 3.1 Experiência do Jogador
- **Estado**: Exibida imediatamente após o jogador digitar o nome e o código da sala.
- **Layout**:
  - Animação central de uma tocha medieval acesa ou ampulheta com partículas mágicas.
  - Texto de status pulsante: *"Aguardando aprovação do Mestre para entrar na masmorra..."*.
  - Detalhes da sessão:
    - `Sala`: **K8X2M**
    - `Aventureiro`: **Thorgar**
  - Botão de saída no rodapé: `[ ↩️ Cancelar / Voltar ao Início ]` (permite corrigir nome ou código caso tenha digitado errado).

### 3.2 Experiência do Mestre
- **Notificação em Tempo Real**:
  - O Mestre não tem sua navegação travada. Um **Badge pulsante dourado** surge no cabeçalho com aviso sonoro sutil: `[ 🔔 1 Novo Jogador Solicitando Entrada ]`.
  - Ao clicar no badge, abre-se um popover estilizado:
    - Card com o nome do jogador: *"Thorgar"* solicitando entrada.
    - Botão `[ ✅ Aprovar ]`: Concede a entrada, gera o token permanente de sessão no SQLite e no cliente do jogador, e direciona o jogador automaticamente para a Criação de Personagem.
    - Botão `[ ❌ Recusar ]`: Encerra a solicitação e exibe mensagem amigável na tela do jogador (*"Entrada não autorizada pelo Mestre"*).

---

## 4. Página 3: Criação de Personagem (Point Buy e Customização Modular 2D)

### 4.1 Arquitetura da Tela (Split-Screen Responsivo)
- **Painel Esquerdo (Desktop) / Topo Compacto com Accordion (Mobile)**:
  - **Visualizador 2D em Tempo Real (Canvas PixiJS)**:
    - Exibe o **Busto HD (512x512)** do personagem, atualizando instantaneamente a cada clique em raça, cabelo, cor ou feição.
    - Embaixo, exibe o **Token Circular (128x128)** com borda dourada estilizada exatamente como aparecerá no grid do tabuleiro.
  - **Card de Status Derivados**:
    - Barras dinâmicas recalculadas em tempo real:
      - `HP Máximo`: Calculado por `100 + (mod_CON * 10)`.
      - `MP Máximo`: Calculado por `max(10, (INT * 2) + (mod_SAB * 5))`.
      - `Defesa Base`: `10 + mod_DES`.
      - `Esquiva Base`: `%` calculada com teto de 20%.
      - `Velocidade`: Hexágonos por rodada derivados de Destreza.
- **Painel Direito (Desktop) / Abas Inferiores Deslizantes (Mobile)**:
  - **Aba 1: Raça & Arquétipo**:
    - Grid com as 8 raças oficiais: `Humano`, `Anão`, `Elfo`, `Orc`, `Vampiro`, `Demônio`, `Meio-Dragão` e `Meio-Tubarão`. Cada card exibe a silhueta, os bônus nos atributos e a passiva descrita com clareza.
    - Seleção de Arquétipo de Combate: `Guerreiro`, `Bárbaro`, `Ladino`, `Mago`, `Clérigo` com descrição da habilidade ativa e seu custo/cooldown.
  - **Aba 2: Atributos (Point Buy de 27 Pontos)**:
    - Contador de pontos em destaque no topo: `Pontos Restantes: [ 27 / 27 ]`.
    - 6 linhas táteis para os atributos primários: `FOR`, `DES`, `CON`, `INT`, `SAB`, `CAR`.
    - Cada linha contém: Sigla, Nome, valor numérico base 8 (limite 15), Modificador calculado (`+0`, `+2`, etc.), e botões táteis grandes `[ - ]` e `[ + ]`.
    - Custo progressivo transparente (1 ponto de 8 a 13; 2 pontos para 14 e 15). Trava automática caso atinja 0 pontos restantes.
  - **Aba 3: Aparência Modular 2D**:
    - Abas de componentes: *Pele*, *Rosto/Olhos*, *Cabelo/Barba*, *Traços Raciais* (Chifres para Demônio/Dragão, Barbatanas/Guelras para Tubarão, Presas para Orc/Vampiro, Orelhas para Elfo).
    - Paleta de cores RGB tátil para selecionar tons de pele, cor dos olhos e matiz dos cabelos.
  - **Rodapé do Painel**:
    - Campo `Nome do Personagem`.
    - Botão de Destaque: `[ ⚔️ Concluir Ficha e Entrar na Masmorra ]` (desabilitado se os pontos de Point Buy não estiverem zerados ou nome em branco).

---

## 5. Página 4: O Tabuleiro Principal (Board Screen)

### 5.1 O Canvas Central do Tabuleiro (PixiJS v8)
- Ocupa 100% da tela do navegador em formato tela cheia (*edge-to-edge*).
- Grid hexagonal Pointy-Topped (`⬢`) com suporte a drag para mover a câmera e scroll/pinça para zoom.
- Câmaras contíguas: transição suave de câmera por deslizamento quando o jogador cruza uma porta/passagem.
- Névoa de Guerra suave: iluminação circular nos 4 hexágonos de visão ativa, terreno visitado em tom sombreado (sem monstros) e escuridão nas áreas inexploradas.

### 5.2 HUD do Jogador
- **Barra Superior (Header Compacto)**:
  - Identificador da Sala: `#K8X2M` com botão de copiar link.
  - **Indicador de Modo de Movimento**:
    - No *Modo Masmorra Tenso*: exibe medidor circular de **Cooldown de 30s** mostrando quantos segundos faltam para o próximo ciclo de movimento e quantos passos restam.
    - No *Modo Exploração Livre*: exibe etiqueta verde *"Livre (1s anti-spam)"*.
  - Controle de Volume de Áudio (Slider de som e botão de Mudo).
- **Canto Inferior Esquerdo**:
  - **Card do Personagem**: Retrato circular em miniatura com as barras horizontais de **Vida (HP)** e **Mana (MP)** com números legíveis (`110/110`).
  - Ao tocar no card, abre a **Gaveta Retrátil da Ficha Completa**.
- **Canto Inferior Direito**:
  - Conjunto de botões de acesso rápido:
    - `[ 🎒 Mochila ]`: Abre a gaveta de equipamentos e itens consumíveis.
    - `[ 🎲 Dados ]`: Abre a bandeja de dados poliédricos (d4..d100).
    - `[ 📜 Log ]`: Abre o histórico lateral de rolagens e combate.
- **Balões de Conversa Efêmeros**:
  - Caixa de texto acessível por toque na tela ou atalho `Enter`.
  - Ao enviar mensagem, ela surge em um **balão de fala estilizado** sobre a cabeça do token do jogador por **7 segundos**, sumindo com fade-out suave para não poluir o mapa.

### 5.3 Interface Exclusiva do Mestre no Tabuleiro
- **Barra Superior de Comando**:
  - Seletor do Modo de Movimento: Botão alternador `[ ⏱️ Modo Tenso 30s ]` / `[ 🏃 Modo Livre ]`.
  - Alternador de Câmera: `[ 🔍 Focar Câmara Atual ]` vs `[ 🗺️ Visão Macro Panorâmica ]` (afasta o zoom para ver todas as salas simultaneamente).
  - Botões de Histórico Ilimitado: `[ ↩️ Desfazer (Ctrl+Z) ]` e `[ ↪️ Refazer (Ctrl+Y) ]`.
  - Botão `[ ⏸️ Pausar Jogo ]`.
- **Sidebar Retrátil Esquerda (Fases e Câmaras)**:
  - Lista de fases reutilizáveis ('Taverna', 'Acampamento', 'Masmorra Nível 1') para troca instantânea de cenário com 1 clique.
- **Toolbar Flutuante de Edição em Camadas**:
  - `Camada de Terreno`: Pincéis com texturas de grama, pedra, terra, areia e água. Ferramenta expansível para aumentar os limites da fase pintando além da borda.
  - `Camada de Paredes`: Ferramenta de linha/segmento para traçar paredes que bloqueiam visão e movimento.
  - `Camada de Objetos`: Baús interativos (com inventário próprio), portas, tochas, mesas e decorações.
  - `Camada de Entidades`: Posicionamento de Monstros (com edição de HP/ataque), NPCs mercadores e Ponto de Spawn inicial.
  - `Alternador Oculto`: Ferramenta de olho para marcar qualquer token como secreto (visível apenas para o Mestre com transparência).

---

## 6. Página 5: A Arena de Combate POV (Perspectiva Frontal JRPG / Pokémon)

### 6.1 Disposição Visual da Arena
- **Transição de Entrada**:
  - Ao iniciar o combate, o mapa escurece brevemente com efeito de zoom suave e revela a Arena POV temática.
- **Cenário de Fundo (PixiJS)**:
  - Arte ilustrada contextual do bioma onde a luta começou (Caverna de pedra escura com estalactites, Floresta densa com névoa, Taverna de madeira com lareira).
- **Monstros Inimigos (Centro da Tela)**:
  - Inimigos desenhados de frente com animação contínua e suave de respiração (*idle breathing*) via GSAP.
  - Acima de cada monstro: Nome, Nível, Barra de HP nítida e ícones de status ativos (ex: veneno).
  - Ao clicar em um monstro, surge a **Retícula Dourada de Mira** indicando o alvo selecionado.
- **Cards de Companheiros de Equipe (Aliados)**:
  - Alinhados horizontalmente no topo lateral: miniaturas dos outros jogadores com suas respectivas barras de HP, permitindo clicar no aliado para canalizar feitiços de cura ou bênçãos.
- **Card do Personagem Ativo (Canto Inferior Esquerdo)**:
  - Retrato HD, HP atual, MP atual e ações extras restantes na rodada.

### 6.2 Doca Inferior de Batalha (Os 4 Grandes Botões Táteis)
Localizada no rodapé com botões de tamanho generoso para toque:
1. **`[ ⚔️ Atacar ]`**:
   - Desliza submenu limpo:
     - *Arma Principal*: Nome da arma, tipo de dano (Corte, Impacto, Perfuração) e dano base.
     - *Arma Secundária*: Caso esteja em dual-wielding.
     - *Ataques Mágicos (Grimório)*: Lista de feitiços de dano com custo de MP (Dardo Arcano, Explosão Ígnea, Raio Congelante).
2. **`[ 🛡️ Defender ]`**:
   - Submenu tático:
     - *Esquiva Ativa*: Prepara rolagem de contra-teste (`1d20 + DES`).
     - *Bloqueio com Escudo*: Redução física direta.
     - *Magias de Proteção e Cura*: Luz Curativa, Barreira Arcana.
3. **`[ 🎒 Itens ]`**:
   - Submenu com consumíveis rápidos da bolsa: Poção de Vida, Poção de Mana, Antídoto, 'O Suco' (multiplicador 1,20x) e Livro Mágico.
4. **`[ 🏃 Fugir ]`**:
   - Dispara teste de fuga baseado em velocidade. Desabilitado com cadeado se o Mestre bloquear, ou 100% imediato se o Mestre conceder fuga garantida.

### 6.3 Efeitos Visuais (VFX) e Números Flutuantes
- Cortes de espada cruzando o monstro, centelhas de impacto, chamas rodopiantes e estilhaços de gelo.
- **Números de Dano**:
  - Dano normal: Números vermelhos subindo suavemente (`-18`).
  - Dano crítico: Fonte dourada ampliada com tremor de tela (*screen shake*).
  - Esquiva: Texto azul flutuante *"Esquivou!"*.
  - Redução de Dano (DR): Ícone de escudo indicando dano absorvido.

### 6.4 Barra Superior de Árbitro do Mestre
- Exclusiva para o Mestre durante a batalha:
  - `[ ⏸️ Pausar Combate ]`
  - `[ 🏃 Forçar Fuga 100% ]`
  - `[ 🤖 Ativar IA Automática para Monstros ]`
  - `[ ⚔️ Encerrar Combate Manualmente ]`
  - **Controle Manual Direto**: Clicar em qualquer monstro no campo transfere a doca inferior para os ataques daquela criatura, permitindo ao Mestre jogar o turno do monstro manualmente.

---

## 7. Página 6: Modal / Painel de Loja de NPC (Comércio de Itens)

### 7.1 Gatilho e Estrutura
- **Gatilho**: Ao mover para um hexágono adjacente ao NPC mercador, surge o balão de ação tátil `[ 💬 Comerciar com Mercador ]`.
- **Cabeçalho da Loja**:
  - Retrato circular do NPC com seu nome (ex: *"Darius, o Mercador de Armas"*).
  - Balão com mensagem de diálogo personalizada pelo Mestre (ex: *"Tenho as melhores lâminas do reino! O que deseja?"*).
  - Indicador do Saldo de Ouro do Jogador em destaque: `💰 [ 120 ] Moedas de Ouro`.
- **Aba 1: `[ 🛒 Comprar ]`**:
  - Grade de cards dos produtos ofertados pelo mercador.
  - Cada card exibe: Ícone ilustrado, Nome, Tipo de equipamento, bônus numéricos e preço em ouro `[ 45 G ]`.
  - Botão de compra: ao clicar, reproduz efeito sonoro de tilintar de moedas (`coins`), desconta o ouro e transfere para a mochila do jogador. Se o ouro for insuficiente, o botão fica desabilitado com aviso em vermelho.
- **Aba 2: `[ 💰 Vender ]`**:
  - Lista todos os itens da mochila do jogador (itens atualmente vestidos/equipados no corpo ficam protegidos com ícone de cadeado).
  - Cálculo automático de **50% do valor base de mercado**: ex: item de 40G exibe o valor de venda `[ +20 G ]`.
  - Botão de venda: remove o item da mochila e soma as moedas instantaneamente na carteira.
- **Edição pelo Mestre**:
  - O Mestre possui um botão `[ ✏️ Editar Loja ]` no canto do modal para alterar nome, mensagem de diálogo e adicionar/remover produtos daquele NPC arrastando do catálogo geral.

---

## 8. Gavetas Retráteis Unificadas (Ficha, Mochila e Dados)

### 8.1 Gaveta de Ficha, Inventário e Grimório
- Desliza de baixo para cima no celular (Bottom Sheet) ou da lateral direita no desktop.
- **3 Abas Internas**:
  1. **Aba `Ficha`**:
     - Retrato HD, Raça, Classe/Arquétipo e nível.
     - 6 Atributos em grade com modificadores calculados.
     - Descrição da Passiva Racial e da Habilidade Ativa de Arquétipo com medidor de Cooldown/cargas.
  2. **Aba `Equipamentos & Mochila`**:
     - **3 Slots de Equipamento do Corpo**:
       - `Mão Principal`: Arma de 1 mão ou de 2 mãos (bloqueia mão secundária).
       - `Mão Secundária`: Escudo ou segunda arma de 1 mão.
       - `Armadura`: Armadura Leve, Média ou Pesada.
     - **Grade da Mochila**:
       - Itens consumíveis com contador de quantidade (ex: `Poção de Cura x3`).
       - Saldo de Moedas de Ouro.
  3. **Aba `Grimório`**:
     - Lista de feitiços conhecidos do personagem com custo de Mana (MP) e alcance em hexágonos.

### 8.2 Bandeja de Rolagem de Dados 2D & Log de Combate
- Acionada pelo botão flutuante `[ 🎲 Dados ]`.
- Desliza uma bandeja translúcida com os dados poliédricos clássicos: **d4, d6, d8, d10, d12, d20 e d100**.
- Ao clicar no dado desejado:
  - O cliente solicita ao servidor a rolagem determinística.
  - Uma animação 2D sincronizada exibe o dado girando e pousando no número oficial sorteado.
  - O resultado é transmitido com destaque no centro da tela e arquivado na gaveta retrátil **Log de Rolagens e Combate** para consulta posterior.
