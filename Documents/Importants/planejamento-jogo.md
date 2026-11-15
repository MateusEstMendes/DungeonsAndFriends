# Planejamento do Jogo — Dungeons & Friends

Documento vivo de design e planejamento funcional do jogo (independente de stack técnica).

---

## 1. Visão Geral do Produto
- **Formato**: Jogo no navegador no PC como PWA (com suporte a controle/gerenciamento do Mestre e jogadores em tela responsiva/celular).
- **Proposta**: RPG tático em grade hexagonal com exploração de masmorras, névoa de guerra, combate por turnos, fichas simplificadas (6 atributos, raças com passivas, point buy) e ferramentas autoritativas em tempo real para o Mestre.
- **Identidade e Acesso**: Sem necessidade de cadastro prévio complexo; acesso baseado em Chave de Sala (5 caracteres), Papéis (Mestre com senha privada, Jogadores com nomes únicos e tokens gerados/salvos localmente para reconexão automática).

---

## 2. Decisões Consolidadas

### 2.1 Página Inicial e Fluxo de Entrada
- **Página Inicial**: Contém o espaço de Senha do Mestre com botão de Login e o botão **"Sou Jogador"**.
- **Entrada do Jogador**: O jogador clica em "Sou Jogador", digita manualmente o **Código da Sala (5 caracteres)** e seu **Nome**.
- **Token de Sessão**: Um token exclusivo é gerado no primeiro acesso e persistido no `localStorage` do navegador do jogador e no banco local do Mestre, permitindo reconexão automática após quedas de rede ou reload da página.
- **Fila de Espera e Aprovação**: O jogador aguarda em uma tela de espera (*"Aguardando aprovação do Mestre..."*). O Mestre recebe notificação em tempo real com opção de **Aprovar** ou **Recusar**. Apenas após a aprovação o jogador acessa a criação de ficha/mapa.
- **Morte de Personagem**: Caso o personagem morra, o Mestre tem o controle de gerar um novo token de reposição que concede ao jogador o direito de criar um novo personagem sem sobrescrever nem controlar personagens alheios.

---

## 3. Estrutura de Mapas e Exploração
- **Modelo de Câmaras Contíguas (Estilo Zelda / Metroidvania)**:
  - O mapa de uma região/masmorra é uma grande estrutura contínua de células hexagonais, organizada em câmaras interligadas por portas, passagens ou corredores.
  - **Transição de Câmera para Jogadores**: Ao atravessar uma passagem ou porta que leva a uma câmara vizinha, a câmera do jogador desliza suavemente para enquadrar a nova sala.
  - **Visão do Mestre**: O Mestre tem um modo de visão panorâmica global (*Macro View / Panorâmica*), permitindo ver todas as câmaras ao mesmo tempo, onde cada jogador está, além de poder aproximar (*zoom in*) em uma câmara específica para intervenções pontuais.
  - **Separação de Conteúdo e Névoa**: O servidor envia aos jogadores apenas o conteúdo da câmara atual. Jogadores em outras câmaras não se veem nem recebem os dados de outras salas.
  - **Visão Ativa e Memória de Terreno (Névoa Clássica)**:
    - **Raio de Visão Ativa**: Cada jogador tem visão compartilhada dentro da câmara em um raio de até 4 tiles hexagonais, bloqueada por paredes (linha de visada direta).
    - **Memória de Terreno**: Células de chão e paredes já vistas pelos jogadores dentro da câmara continuam visíveis em tom acinzentado/sombreado ("névoa de memória"), permitindo ao jogador se orientar pelo ambiente explorado.
    - **Inimigos e Tokens Ocultos**: Monstros, armadilhas, baús e outros personagens que não estejam sob a visão ativa (4 tiles de algum jogador) ficam 100% invisíveis no cliente do jogador.
    - **Limpeza ao Sair da Câmara**: Quando os jogadores saem de uma câmara e passam para outra, a memória da câmara anterior apaga e ela volta a ficar completamente coberta por névoa.
  - **Mapas Avulsos e Reutilizáveis**: Além de grandes masmorras com câmaras contíguas, o Mestre pode manter fases/mapas avulsos e reutilizáveis (como 'Taverna', 'Castelo', 'Acampamento'), acessíveis pela barra lateral para trocas de cenário narrativo.

---

## 4. Regras de Movimento e Exploração
- **Movimento Fora de Combate**:
  - **Dois Modos de Exploração (Alternados pelo Mestre)**:
    1. **Modo Tenso / Masmorra (Padrão em áreas hostis)**: O jogador pode mover uma quantidade de hexágonos igual à sua **Velocidade (Speed)** derivada da Destreza a cada ciclo de **Cooldown de 30 segundos**. O Mestre também pode conceder turnos individuais de movimento manualmente a qualquer momento.
    2. **Modo Exploração Livre (Áreas seguras / Taverna / Viagem)**: Sem cooldown de 30 segundos, permitindo navegação fluida em tempo real com pequeno intervalo anti-spam (ex: 1s).
  - **Autoridade e Prioridade do Mestre**:
    - O servidor é 100% autoritativo: valida colisões com paredes, água e obstáculos grandes.
    - Se Mestre e jogador moverem o mesmo token concorrentemente, a ação do Mestre tem prioridade soberana imediata.
    - **Regra de Não-Sobreposição**: Nenhuma entidade (jogador, NPC ou monstro) pode terminar o movimento sobre o mesmo hexágono ocupado por outra criatura (bloqueio rígido FCFS — First-Come, First-Served).
- **Transição entre Câmaras**: Ao atingir a célula de portal/passagem na borda de uma câmara, a transição desliza a câmera e posiciona o jogador na célula correspondente da câmara contígua.

## 5. Sistema de Combate por Turnos e Encontros
- **Gatilho de Início de Combate**:
  - Quando um monstro fica a uma distância de proximidade dos jogadores (ex: 1 a 2 hexágonos), o sistema emite um alerta discreto na tela do Mestre: `[Inimigo próximo! Iniciar Combate]`.
  - O Mestre clica para iniciar o encontro. O Mestre também pode iniciar ou encerrar o combate manualmente a qualquer momento.
- **Ordem de Turnos (Iniciativa)**:
  - **Fila Dinâmica por Velocidade/Destreza**: No início do combate, o servidor monta a ordem de turnos ordenando automaticamente todos os participantes (jogadores e monstros) do mais veloz para o mais lento com base na Destreza/Speed.
  - **Soberania do Mestre**: O Mestre visualiza a fila na interface e pode adiantar, atrasar ou passar o turno de qualquer participante manualmente.
- **Economia do Turno do Personagem**:
  - **1 Movimento**: Pode deslocar até a sua Velocidade (Speed) em hexágonos na sua vez.
  - **1 Ação Principal**: Escolher uma entre:
    1. **Ataque Físico**: Golpe corpo a corpo ou à distância com arma equipada.
    2. **Ataque Mágico**: Magia ou feitiço com foco/cajado/varinha, consumindo mana.
    3. **Defender (Esquiva Ativa com Rolagem)**: O personagem foca totalmente em evasão. Quando for atacado até a sua próxima vez, rola ativamente um contra-teste de esquiva (`1d20 + Modificador de Destreza`). Se a rolagem superar ou igualar o ataque do atacante, esquiva completamente do dano!
    4. **Usar Item**: Consumir poção de cura/mana, antídoto, 'O Suco' ou ler livro mágico.
    5. **Fugir**: Tentativa de escapar do encontro (ver regras de fuga abaixo).
  - **Ações Adicionais (Atacar ou Esquivar)**:
    - Calculadas por `1 + floor(atributo / 20)`, onde o atributo considerado é o maior entre FOR e INT.
    - Se FOR for maior: as ações extras só podem ser físicas.
    - Se INT for maior: as ações extras só podem ser mágicas.
    - Ações adicionais nunca podem ser usadas para fugir.
- **Esquiva Passiva Natural**:
  - Mesmo sem escolher a ação "Defender", personagens têm uma chance de esquiva passiva natural contra ataques: `min(20%, max(0%, 5% + (mod_DES * 2%)))`.
  - **Teto Global Rígido de Esquiva**: 20% (nenhum efeito, passiva ou item pode ultrapassar 20% de esquiva passiva).
- **Mecânica de Fuga**:
  - Difícil de escapar naturalmente (baseada no teste de velocidade vs velocidade média dos inimigos).
  - **Controle do Mestre estilo Pokémon**:
    - O Mestre pode **Bloquear a Fuga** (o botão fica desabilitado para os jogadores).
    - O Mestre pode conceder **100% de Chance de Fuga** (garantida caso o encontro seja difícil demais ou para fins narrativos).
    - Fuga bem-sucedida encerra o encontro para o personagem que fugiu ou para todo o grupo conforme autorizado pelo Mestre.

## 6. Arena Visual de Combate POV (Estilo Pokémon / JRPG Tático)
- **Transição e Cenário Contextual**:
  - Ao iniciar o combate, a tela transita suavemente do mapa para uma **Arena de Batalha Dedicada em Perspectiva Frontal (POV)**.
  - O plano de fundo da arena é gerado com base no ambiente atual onde o combate começou (ex: pedras e estalactites para Cavernas, árvores e musgo para Floresta, paredes rústicas de madeira e tochas para Taverna/Castelo).
- **Disposição Visual na Tela (Layout POV)**:
  - **Inimigos Centrais**: O monstro (ou grupo de monstros) fica posicionado de frente no centro do cenário temático. Clicar diretamente no monstro ativa a retícula de mira para o ataque. Sobre a cabeça de cada monstro, exibem-se seu nome, barra de HP e eventuais efeitos ativos (como veneno ou buffs).
  - **Status do Jogador Ativo (Canto Inferior)**: Card estilizado contendo o retrato do personagem, barras de **Vida (HP)**, **Mana (MP)** e indicadores de status temporários.
  - **Cards de Aliados**: Mini-retratos dos companheiros de equipe com suas respectivas barras de vida ficam alinhados na lateral, permitindo ao jogador clicar no aliado para canalizar magias de cura, bênçãos ou usar itens de suporte.
- **As 4 Ações Principais de Combate (Menu Inferior)**:
  Na parte inferior da tela, o jogador tem 4 grandes botões de ação tátil:
  1. **`[⚔️ Atacar]`**: Abre o submenu com os ataques disponíveis:
     - **Golpes Físicos (baseados na arma equipada)**:
       - *Corte (Slashing)*: Espadas e lâminas (efeito visual de arco luminoso afiado).
       - *Impacto (Blunt)*: Machados, maças e martelos (efeito de tremor e centelhas).
       - *Perfuração / Estocada (Thrust)*: Lanças, adagas, flechas de arco e virotes de besta (feixe de perfuração veloz).
       - *Desarmado*: Socos, chutes e ataques naturais (mordida de tubarão, garras).
     - **Ataques Mágicos (Grimório do Personagem)**:
       - Lista de feitiços de dano com custo de Mana visível, categorizados por elemento (Fogo, Luz, Gelo, Escuridão e Arcano).
  2. **`[🛡️ Defender]`**: Abre as posturas e manobras defensivas:
     - *Esquiva Ativa*: Prepara o contra-teste de rolagem (`1d20 + Destreza`) contra o próximo golpe recebido.
     - *Bloqueio com Escudo / Defesa Física*: Foco em sustentação física reduzindo o impacto do ataque.
     - *Magias Defensivas*: Barreira arcana ou domo de proteção (caso tenha aprendido feitiços de proteção).
     - *Habilidades de Suporte / Cura*: Canalizar feitiços curativos para restaurar a própria vida ou a de um aliado selecionado.
  3. **`[🎒 Itens]`**: Abre a bolsa de consumíveis de combate:
     - Poções de vida e mana de uso rápido, antídotos contra veneno, 'O Suco' (multiplicador 1,20x) ou Livro Mágico de aumento de poder.
  4. **`[🏃 Fugir]`**: Dispara o teste de escape baseado em velocidade (desabilitado se o Mestre bloquear a fuga, ou automático se o Mestre conceder 100%).
- **Animações e Efeitos Visuais de Impacto (VFX)**:
  - **Animação Específica por Golpe**: O tipo de arma e elemento ditam o efeito visual projetado sobre o alvo:
    - *Lâmina*: Risco de corte luminoso cortando o ar.
    - *Impacto*: Tremor de impacto com centelhas e poeira.
    - *Fogo*: Espiral flamejante explodindo no monstro.
    - *Gelo*: Fragmentos pontiagudos congelando o alvo.
    - *Luz*: Feixe dourado brilhante translúcido.
    - *Escuridão*: Chamas sombrias e névoa etérea roxa/negra.
  - **Feedback Tátil e Números Flutuantes**:
    - Dano normal em números vermelhos nítidos (`-18`).
    - Dano crítico com fonte dourada ampliada e leve tremor de tela (*screen shake*).
    - Esquiva com texto azul flutuante *"Esquivou!"* e rastro de silhueta.
    - Mitigação de dano com ícone de escudo mostrando o valor absorvido pela Redução de Dano (DR).
- **Visão Soberana do Mestre na Arena POV**:
  - O Mestre assiste ao combate com uma **Barra Superior de Árbitro** (botões para pausar a luta, forçar fuga 100%, ativar IA automática para todos os monstros ou encerrar o combate).
  - **Assumir Controle Manual**: Ao clicar em qualquer monstro no campo, a perspectiva da interface do Mestre assume a criatura, exibindo seus ataques monstruosos, defesas e alvos heróis disponíveis para que o Mestre jogue o turno do monstro manualmente.

## 7. Comportamento e Inteligência dos Monstros
- **Controle pelo Mestre**:
  - O Mestre pode controlar cada monstro manualmente: escolher para onde move, quem ataca, se defende e qual habilidade usa.
- **Modo Automático (IA Tática de Proximidade)**:
  - O Mestre pode ligar a chave "Automático" para qualquer monstro com 1 clique.
  - **Comportamento Padrão**:
    1. A criatura localiza o jogador mais próximo (calculado por distância hexagonal).
    2. Se for uma criatura de ataque corpo a corpo: caminha pelo menor trajeto em direção ao alvo e, se alcançar adjacência, desfere o ataque físico. Se não alcançar para atacar no mesmo turno, aproxima o máximo que sua velocidade permitir.
    3. Se for uma criatura de ataque à distância/mágico: mantém linha de visada desobstruída na distância ideal de alcance e dispara seu ataque; caso um jogador esteja colado nela, tenta recuar antes de atirar.
  - O Mestre pode interromper a ação automática a qualquer instante e assumir o controle manual.
  - **Restrição de Fuga dos Monstros**: Monstros no modo automático NUNCA fogem, a menos que o Mestre habilite explicitamente a fuga para aquela criatura/batalha.
- **Redução de Dano (DR) dos Monstros**:
  - Cada monstro tem um valor próprio individual de Redução de Dano plana (DR), que desconta diretamente do dano bruto recebido (dano mínimo sempre será 1 caso o ataque atinja).

## 8. Itens, Equipamentos e Economia
- **Formas de Obtenção de Itens**:
  1. **Baús Interativos no Mapa**: Baús posicionados pelo Mestre que os jogadores podem abrir ao ficarem adjacentes, recolhendo os itens armazenados.
  2. **Distribuição Direta pelo Mestre**: Painel administrativo do Mestre para conceder, editar ou remover itens diretamente no inventário de qualquer jogador.
  3. **Comércio com NPCs**: NPCs mercadores/lojistas posicionados pelo Mestre com um catálogo de venda definido, permitindo aos jogadores comprar equipamentos, poções e suprimentos.
- **Sistema de Moedas e Economia**:
  - **Moedas de Ouro Unificadas**: Cada personagem possui um saldo simples e direto de **Ouro (G)** em sua ficha/inventário.
  - Ouro é encontrado em baús, recompensas concedidas pelo Mestre ou tesouros de monstros.
  - **Lojas de NPCs e Comércio**:
    - **Interação de Adjacência**: Ao parar em um hexágono adjacente ao NPC, o jogador pode interagir para abrir a loja.
    - **Aba de Compra**: Exibe a lista de itens ofertados pelo mercador com nome, atributos, ícone e preço em Ouro.
    - **Aba de Venda (Recompra a 50%)**: O jogador pode vender itens e consumíveis da sua mochila por metade (50%) do valor base de mercado, recuperando ouro para novos investimentos.
    - **Configuração pelo Mestre**: O Mestre edita o nome do NPC, mensagem de boas-vindas, e arrasta itens do catálogo para compor o estoque daquela loja.
- **Slots Rígidos de Equipamento**:
  - `Mão Principal (mainHand)`
  - `Mão Secundária (offHand)`
  - `Armadura (armor)`
- **Regras Rígidas de Armas e Mãos**:
  - **Armas de 2 Mãos** (Espada Grande, Machado, Lança): ocupam a mão principal e bloqueiam a mão secundária (força `offHand = null`), impedindo o uso de escudo ou arma secundária.
  - **Armas de 1 Mão** (Espada Comum, Adagas): podem ser combinadas com Escudo na mão secundária ou com outra arma de 1 mão (*Dual Wielding*). Duas espadas causam menos dano bruto que uma arma pesada de 2 mãos.
  - **Longo Alcance** (Arco e Besta): maior alcance hexagonal e dano moderado.
  - **Focos Mágicos** (Cajados, Varinhas, Focos Arcanos): equipáveis para canalizar ataques e feitiços mágicos.
- **Armaduras e Proteções**:
  - **Leve**: foco em agilidade (+2 Defesa, mantém Destreza total e +5% esquiva).
  - **Média**: equilíbrio defensivo (+4 Defesa, limita bônus de Destreza a +2).
  - **Pesada**: máxima proteção física (+7 Defesa, +2 Redução de Dano DR, penalidade de -2 em Destreza e -10% esquiva).
  - **Escudo**: equipado na mão secundária, aumentando a Defesa base.
- **Consumíveis e Efeitos Temporários**:
  - Inventário individual com rastreamento numérico de quantidades (item é consumido ao ser usado).
  - **Poções de Vida e Mana**: restauração instantânea de recursos vitais.
  - **Veneno**: dano periódico ao iniciar o turno por duração determinada (ex: 3 rodadas) ou até uso de antídoto.
  - **Livro Mágico**: bônus numérico somado ao dano mágico por rodadas configuradas.
  - **'O Suco'**: poção especial que concede multiplicador de **1,20x** ao dano físico causado por rodadas determinadas.
  - **Itens Narrativos**: chaves, cordas, tochas, mapas e ferramentas sem valores numéricos diretos.

## 9. Sistema de Magias e Feitiços
- **Grimório Dinâmico e Aprendizado**:
  - Personagens com foco arcano/mágico iniciam com **2 magias básicas** em seu Grimório pessoal.
  - Novos feitiços são aprendidos encontrando **Pergaminhos e Livros de Magia** em baús de masmorra, comprando em NPCs mercadores ou por concessão direta do Mestre.
  - Ao ler e consumir um pergaminho de feitiço, o feitiço é incorporado permanentemente ao Grimório daquele personagem.
- **Canalização e Requisitos**:
  - Para lançar feitiços em combate, o personagem deve ter um **Foco Mágico** equipado (Cajado, Varinha ou Foco Arcano) e ter pontos suficientes na barra de **Mana (MP)**.
  - O dano mágico tem como base a Inteligência (`INT`) para magias arcanas ou Sabedoria (`SAB`) para magias divinas/curativas, somado aos modificadores do foco equipado e bônus ativos (ex: Livro Mágico).
- **Catálogo Inicial de Feitiços Essenciais (4 Categorias)**:
  1. **Dardo Arcano (Ataque Único Rápido)**:
     - *Custo*: 4 MP | *Alcance*: 4 hexágonos | *Alvo*: Único.
     - *Efeito*: Dispara um projétil de energia concentrada causando dano mágico direto.
  2. **Explosão Ígnea (Dano em Área Hexagonal)**:
     - *Custo*: 10 MP | *Alcance*: 4 hexágonos | *Alvo*: Hexágono central + os 6 hexágonos vizinhos adjacentes.
     - *Efeito*: Detona uma esfera de fogo que atinge todas as criaturas na área de impacto.
  3. **Luz Curativa (Suporte e Regeneração)**:
     - *Custo*: 6 MP | *Alcance*: 3 hexágonos (ou sobre si mesmo).
     - *Efeito*: Canaliza luz divina restaurando vida (`HP`) do alvo com base na Sabedoria (`SAB`).
  4. **Raio Congelante (Dano e Controle de Campo)**:
     - *Custo*: 8 MP | *Alcance*: 4 hexágonos | *Alvo*: Único.
     - *Efeito*: Causa dano de gelo moderado e reduz a Velocidade (Speed) do alvo em 1 hexágono na sua próxima rodada.
- **Resolução em Combate**: Feitiços de ataque passam pelo teste contra a Defesa e Esquiva do alvo (magias do Demônio ignoram 2 pontos de DR pela passiva *Pacto Flamejante*).

## 10. Criação de Personagem, Raças e Habilidades de Arquétipo
- **Atributos Primários (6 Atributos)**:
  - Força (`FOR`), Destreza (`DES`), Constituição (`CON`), Inteligência (`INT`), Sabedoria (`SAB`) e Carisma (`CAR`).
  - **Fórmula de Modificador**: `mod = floor((atributo - 10) / 2)`.
- **Status Derivados**:
  - **Vida Máxima (HP)**: `100 + (mod_CON * 10)`.
  - **Mana Máxima (MP)**: `max(10, (INT * 2) + (mod_SAB * 5))`.
  - **Defesa Base**: `10 + mod_DES`.
  - **Esquiva Passiva Base**: `min(20%, max(0%, 5% + (mod_DES * 2%)))`. Teto global absoluto de 20%.
  - **Velocidade Base (Hexágonos)**: `max(1, 2 + floor(mod_DES / 2))`.
- **Sistema de Criação — Point Buy (27 Pontos)**:
  - Pontuação base em todos os atributos: 8.
  - Custo de 8 a 13: 1 ponto por incremento.
  - Custo de 14 a 15: 2 pontos por incremento.
  - Faixa permitida antes de bônus raciais: `[8, 15]`.
- **Catálogo das 8 Raças e Passivas**:
  1. `Humano`: +1 em todos os atributos; Passiva *Adaptabilidade* (+1 ponto extra configurável).
  2. `Anão`: +2 CON, +1 FOR, -1 DES; Passiva *Resiliência das Rochas* (+1 DR plana permanente).
  3. `Elfo`: +2 DES, +1 INT, -1 CON; Passiva *Graça Silvestre* (+5% esquiva base natural).
  4. `Orc`: +2 FOR, +1 CON, -2 INT; Passiva *Fúria Indomável* (+2 dano físico quando HP < 30%).
  5. `Vampiro`: +2 DES, +1 INT, -1 CON; Passiva *Toque Sanguíneo* (recupera 20% do dano corpo a corpo causado como vida).
  6. `Demônio`: +2 INT, +1 FOR, -1 CAR; Passiva *Pacto Flamejante* (ataques mágicos ignoram 2 pontos de DR do alvo).
  7. `Meio-Dragão`: +2 FOR, +1 CON, -1 SAB; Passiva *Couraça Escamosa* (+2 de Defesa base natural).
  8. `Meio-Tubarão`: +2 DES, +1 FOR, -1 SAB; Passiva *Instinto Predador* (+2 de dano corpo a corpo contra alvos abaixo de 50% de HP).
- **Sistema Híbrido de Classe / Arquétipo (Liberdade + Assinatura)**:
  - **Liberdade de Equipamento**: Qualquer personagem pode empunhar armas ou usar itens/focos mágicos se atender aos requisitos de atributos (sem restrições artificiais de equipamento).
  - **Habilidade Ativa de Arquétipo**: O jogador escolhe um arquétipo de combate que concede uma habilidade de assinatura única em combate:
    - *Guerreiro*: Golpe Avassalador ou Segundo Fôlego (Cooldown marcial de 3 rodadas).
    - *Bárbaro*: Fúria Berserk (Aumenta dano físico e recebe mais dano temporariamente; Cooldown de 3 rodadas ou 1 uso por combate).
    - *Ladino*: Ataque Furtivo / Passo Ágil (Golpe de alta precisão ou reposicionamento tático; Cooldown marcial de 2 rodadas).
    - *Mago*: Feitiço Arcano de Assinatura (consome Mana da barra).
    - *Clérigo*: Cura Divina / Bênção Radiante (restaura HP de aliado em alcance hexagonal; consome Mana).
  - **Gerenciamento de Custos**: Magias consomem a barra de **Mana**; manobras marciais possuem **Cooldown de Rodadas** ou cargas por encontro.

## 11. Sistema de Customização Modular de Personagens 2D (Character Creator)
- **Princípio Arquitetural e Visual**:
  - Baseado em **anatomia compartilhada, slots intercambiáveis e paletas de cores independentes**.
  - **Estética Humanizada**: Todas as raças possuem uma **aparência predominantemente humana/humanoide** (estilo anime/fantasia estilizada), em vez de formas animalescas ou monstruosas grotescas. As características não-humanas funcionam como traços marcantes incorporados à base humana.
  - Permite que qualquer uma das 8 raças seja construída e customizada pelo mesmo sistema, sem necessidade de desenhar um personagem completo fechado para cada variação.
- **Os 4 Elementos Fundamentais**:
  1. **Base Anatômica**:
     - Sistema de coordenadas compartilhado para crânio, rosto, pescoço e tronco.
     - Cada raça modifica as proporções estruturais sem alterar os pontos de ancoragem/encaixe.
     - *Diferenciação de Silhueta*: Anões, Elfos e Orcs possuem contornos de crânio e mandíbulas próprios para que a identidade racial seja profunda e não superficial.
  2. **Peças Modulares (Slots Intercambiáveis)**:
     - Componentes independentes montados em camadas: formato dos olhos, penteados/cabelos, orelhas, chifres, presas, barbas, guelras, escamas e cicatrizes.
     - Regras de compatibilidade automáticas (ex: chifres demônicos adaptáveis ao crânio, elmos que respeitam orelhas de elfo).
  3. **Materiais e Paletas de Cores Independentes**:
     - Separação estrita entre geometria de contornos (lineart), sombreamento e camadas de cor (máscaras de matiz).
     - Uma única peça de cabelo, olho ou pele pode receber dezenas de tons e cores sem duplicar assets.
  4. **Presets Raciais e Criação Livre / Híbridos**:
     - Cada raça define uma configuração visual padrão recomendada ao ser selecionada no Point Buy.
     - O jogador pode livremente ajustar cada componente modular individualmente, permitindo estética única e até conceitos híbridos.
- **Mapeamento Anatômico das 8 Raças Oficiais (Base Humana)**:
  - `Humano`: Base humana clássica | Rosto equilibrado | Orelhas arredondadas | Penteados e barbas versáteis.
  - `Anão`: Estrutura humana robusta | Crânio mais largo e mandíbula firme | Barbas imponentes, tranças e sobrancelhas densas.
  - `Elfo`: Estrutura humana elegante e esguia | Queixo afilado | Traços delicados | Orelhas pontudas e longas.
  - `Orc`: Estrutura humana imponente e forte | Mandíbula levemente projetada com presas inferiores pontiagudas | Cicatrizes de combate e olhar firme.
  - `Vampiro`: Base humana aristocrática | Pele pálida | Olhos penetrantes/brilhantes | Caninos superiores discretamente alongados.
  - `Demônio`: Base humana refinada | Pequenos ou médios chifres estéticos (curvados/retos) | Olhos ardentes | Textura de pele levemente avermelhada ou escura.
  - `Meio-Dragão`: Base humana atlética | Olhos estilo dragão (íris dracônicas intensas/místicas) | Chifres rígidos e detalhes discretos de escamas na têmpora/pescoço.
  - `Meio-Tubarão`: Base humana atlética | Olhos com fenda vertical mais grossa (*thick slit eyes*) | Guelras sutis no pescoço/mandíbula, barbatanas auriculares estilizadas e dentes triangulares afiados.
- **Geração Automática de Tokens**:
  - Ao concluir a customização no criador modular, o sistema gera dinamicamente:
    1. O **Retrato de Rosto/Busto em Alta Resolução** para a ficha de personagem.
    2. O **Token Circular Transparente para o Grid Hexagonal** com borda temática da classe/raça.

## 12. Comunicação, Chat e Rolagem de Dados
- **Chat Efêmero e Balões de Fala**:
  - Mensagens de texto trocadas entre mestre e jogadores aparecem na tela (em balões de fala sobre os tokens ou em toasts no canto inferior) com duração de **7 segundos**, sumindo automaticamente para manter a interface e o mapa limpos e imersivos.
  - Não há persistência de histórico de conversa no banco de dados ao encerrar a sessão.
- **Gaveta Retrátil de Histórico de Dados e Combate**:
  - Uma gaveta lateral retrátil (*Log de Combate*) mantém o registro cronológico das **rolagens de dados** e dos **danos/efeitos aplicados** ocorridos durante a sessão ativa.
  - Permite ao Mestre e aos jogadores consultarem rolagens anteriores caso tenham piscado ou precisem auditar o resultado de um golpe.
  - Este log é volátil à sessão (limpo ao encerrar a sala).
- **Rolagem e Sorteio de Dados**:
  - Suporte aos dados poliédricos padrão: **d4, d6, d8, d10, d12, d20 e d100**.
  - **Sorteio Estritamente no Servidor**: O cliente apenas solicita a rolagem; o servidor gera o número aleatório determinístico e publica o evento sincronizado para todos os clientes conectados.
  - **Animação 2D Sincronizada**: Todos os participantes assistem simultaneamente à animação estilizada do dado pousando no resultado final gerado pelo servidor.
  - **Faixas de Sucesso e Fracasso (d20)**:
    - O Mestre pode configurar faixas de corte nos testes de d20 (ex: Fracasso Crítico/Completo, Fracasso, Sucesso, Sucesso Crítico/Ultra).
    - Feedback visual com cores temáticas ao pousar em cada faixa.

## 13. Ferramentas de Edição do Mestre e Persistência
- **Camadas de Edição do Mapa**:
  1. **Camada de Terreno**: Pincéis para azulejos de grama, arbusto, pedra, areia e água. Pincel expansível permite pintar além dos limites atuais, aumentando dinamicamente a área da fase.
  2. **Camada de Paredes e Obstáculos**: Paredes criadas por pontos conectáveis e segmentos editáveis; bloqueiam movimento e bloqueiam linha de visada (visão dos jogadores).
  3. **Camada de Componentes/Objetos Movíveis**: Mesas, cadeiras, balcões, baús e elementos decorativos com suporte a rotação e sobreposição (o último item movido fica no topo; clique em sobreposição exibe menu para selecionar qual item mover/girar/excluir).
  4. **Camada de Entidades e Tokens**: Posicionamento de jogadores, NPCs mercadores/narrativos e monstros.
- **Camada Oculta do Mestre (Elementos Secretos)**:
  - O Mestre pode marcar qualquer monstro, baú, armadilha ou porta como **'Oculto'**.
  - Elementos ocultos são renderizados com transparência/ícone de olho fechado apenas na tela do Mestre.
  - O servidor não transmite dados de entidades ocultas aos clientes dos jogadores até que o Mestre clique em "Revelar" ou até que uma condição (como pisar na armadilha) seja disparada.
- **Histórico Completo de Desfazer e Refazer (Undo/Redo)**:
  - Cobre todas as ações e alterações da sessão (pintura, colocação de paredes, movimento de objetos) sem limite de quantidade.
- **Ponto Inicial (Spawn) e Reconexão Segura**:
  - Cada mapa/fase possui um ponto de spawn configurado pelo Mestre onde novos jogadores aparecem.
  - Ao reconectar após queda ou reload, o jogador é restaurado com precisão no último hexágono em que estava na sessão.
  - **Regra de Não-Sobreposição**: Personagens nunca se sobrepõem; caso a célula anterior esteja ocupada, o jogador é alocado no hexágono livre adjacente mais próximo.
- **Persistência de Sessão e Recuperação de Falhas**:
  - Salvamento automático de estado e eventos em banco de dados local.
  - **Recuperação de Crash**: Se a sessão fechar abruptamente sem clique em "Encerrar Sessão", o sistema marca o estado como "Salvamento Pendente". Ao reabrir, o Mestre recebe opção de retomar exatamente de onde parou ou descartar.

## 14. Experiência de Usuário, PWA e Adaptação Responsiva
- **Instalação e Suporte PWA (Progressive Web App)**:
  - Pode ser instalado diretamente no computador (Desktop PWA) e na tela inicial de dispositivos móveis (Android/iOS).
  - Ícone de aplicativo dedicado, tela inicial sem barra de endereços do navegador e cache local de assets gráficos e sons para inicialização instantânea.
- **Adaptação Responsiva Desktop vs. Mobile/Tablet**:
  - **No Computador (Desktop)**:
    - Barra lateral (Sidebar Drawer) retrátil para o Mestre selecionar fases/mapas com cards ilustrados.
    - Menus de ferramentas, paletas de terreno e painéis de combate organizados em painéis ergonômicos que não obscurecem o foco central.
    - Controles de câmera por scroll de mouse, arrastar (pan) e atalhos de teclado.
  - **No Celular / Tablet (Mobile Touch)**:
    - **Gavetas Retráteis Inferiores (Bottom Sheets) e Botões Flutuantes (FABs)**: As ferramentas do Mestre e os painéis de ficha/combate recolhem em botões flutuantes compactos. Ao tocar, abrem gavetas que deslizam suavemente de baixo para cima, liberando o tabuleiro inteiro para interação tátil.
    - Gestos de pinça (*pinch-to-zoom*) e arrastar com o dedo com inércia suave, evitando cliques acidentais ou rolagem indevida da página.
    - Alvos de toque generosos (mínimo de 44x44px) para dedos em todas as ações de combate e botões.
- **Identidade Estética e Atmosfera**:
  - **Tema Medieval Fantasia Tátil**: Bordas ornamentadas em estilo pergaminho/pedra entalhada, cartões de inventário táteis e tipografia medieval nítida e legível.
  - **Feedback Visual "Juice" (GSAP)**: Números flutuantes coloridos de dano/cura ao atingir alvos, destaque pulsante e colorido nos hexágonos do caminho alcançável ao mover, e tremor sutil de tela (*screen shake*) em acertos críticos.
  - **Design de Som (SFX com Web Audio API)**:
    - Efeitos sonoros táteis para: rolagens de dados com impacto, passos no terreno, acertos físicos de lâmina/machado, magias, esquivas e som misterioso de transição de portal.
    - Chave individual de mudo (*Mute*) e controle de volume no cabeçalho para cada jogador e para o Mestre.

## 15. Pontos em Aberto a Serem Pesquisados em Como Fazer
Lista de tópicos técnicos e de design aprofundado a serem pesquisados para execução:

1. **Algoritmo de Linha de Visada (FOV / LOS) em Grid Hexagonal**:
   - Pesquisa de implementação eficiente de *Hexagonal Shadowcasting* ou *Bresenham Hexagonal Raycasting* com paredes segmentadas por vetores.
   - Garantir cálculo autoritativo no servidor e renderização fluida no cliente sem queda de FPS em dispositivos móveis.
2. **Motor de Renderização do Character Creator Modular 2D**:
   - Como estruturar as matrizes de coordenadas de ancoragem compartilhadas para crânio, olhos, cabelos e traços raciais (guelras, chifres, presas).
   - Renderização via máscaras de matiz (color tinting / color lookup tables) em canvas 2D para manter os assets levíssimos e com centenas de variações de cor.
3. **Suavidade da Transição de Câmera entre Câmaras (Viewport Sliding & Culling)**:
   - Interpolação suave (easing GSAP/lerp) ao cruzar a passagem de uma câmara para outra, com culling rigoroso para nunca renderizar entidades de outras câmaras no cliente.
4. **Resiliência de Reconexão e Estado de Sala FCFS no Colyseus/WebSocket**:
   - Protocolo de reconexão transparente com token persistente em redes móveis instáveis (ex: oscilação entre Wi-Fi e 4G/5G).
   - Validação FCFS sem descompasso perceptível para o jogador que perdeu a disputa de célula.
5. **Cache Inteligente de PWA e Otimização de Assets para Celular**:
   - Estratégia de Service Worker para pre-caching de texturas de terreno, spritesheets modulares e áudio Web Audio API para carregamento instantâneo.
