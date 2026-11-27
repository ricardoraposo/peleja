<h1 align="center">PELEJA</h1>

<p align="center">
  <b>Uma ponte, dois times, cada um com seu herói. Derrube o núcleo do outro lado.</b><br />
  MOBA de uma rota só, em 3D, direto no navegador. Contra bots ou online com os amigos.
</p>

<p align="center">
  <img src="docs/batalha.jpg" alt="Briga de time no meio da ponte, com o aviso de primeiro abate" />
</p>

## O jogo

Dois times de até cinco heróis se enfrentam numa ponte só. Cada lado tem **duas torres**, um **selo**, mais **duas torres** e o **núcleo**: derrube tudo em ordem e quebre o núcleo inimigo.

- **Tropas** marcham dos dois lados a cada 26 segundos.
- **Cura**: frutas espalhadas pela ponte, ou voltando pra base com `B` (8 segundos parado; dano ou qualquer ação cancela). Na fonte a vida volta depressa.
- **A loja só abre na base ou quando você cai**, então voltar pra comprar custa tempo de rota.
- **Canhão da base**: clique com o botão direito no canhão ao lado da fonte pra entrar nele. A câmera abre e você tem 5 segundos pra clicar onde quer cair, em volta da torre mais avançada do seu time que ainda está de pé (sem clicar, cai atrás dela; `S` desiste). No ar ninguém te acerta, e a queda joga pro alto os inimigos que estiverem embaixo. Sem as duas torres da ponte, o canhão para de atirar.
- **Golpe começado sai**: depois que o herói ergue a arma, o ataque básico acerta mesmo que o alvo dê uns passos pra trás. Só escapa quem avança ou salta pra longe. Atrás de quem foge, o herói vai andando enquanto recarrega, mas planta o pé no golpe: é nessa brecha que quem foge ou kita ganha distância.
- **Moitas**: seis touceiras de capim nas bordas da ponte, três de cada lado. Herói dentro some pro time inimigo e o próprio time vê ele meio transparente. Quem entra na mesma moita (herói ou tropa) enxerga quem está lá. Atacar ou usar habilidade revela por 1 segundo. Ninguém clica em quem não vê, mas disparo e área acertam normal.
- **Ouro**: abate vale 400, torre derrubada 300 pra cada herói do time, e o ouro que pinga sozinho é pouco (3 por segundo). Quem ganha as brigas fecha a build antes.
- **Assistência**: quem bateu no herói nos últimos 15 segundos, ou curou, deu escudo ou bônus em quem bateu, ganha assistência. As assistências dividem 75% do ouro do abate, cada uma com pelo menos 100.
- **Abates seguidos**: matar de novo em até 10 segundos anuncia **Double kill** (+150 de ouro), **Triple kill** (+300) e **Quadra kill** (+450); o quinto, em até 30 segundos depois do quarto, é **Pentakill** (+600).
- **Time inteiro no chão**: as tropas do time que derrubou todo mundo ficam 50% mais fortes por 60 segundos.
- **Torres batem forte** em quem ataca herói perto delas. Deixe as tropas tomarem os tiros primeiro.
- **Em estruturas só o ataque básico fere**, e ele soma o ataque inteiro, 60% do poder e 1,5% da vida máxima: mago, suporte e tanque também derrubam torre.
- **Habilidades em área também desgastam torres**, com 30% do dano. Disparos num alvo só passam direto por elas.

<p align="center">
  <img src="docs/torre.jpg" alt="Perseguição até o alcance da torre inimiga" />
</p>

## Heróis

Quinze heróis do folclore e do sertão, cada um com quatro habilidades (Q, W, E e a suprema no R) que evoluem conforme você sobe de nível.

| Herói | Papel | Alcance |
| --- | --- | --- |
| **Faísca** | Atiradora | À distância |
| **Trovão** | Brigão | Corpo a corpo |
| **Coruja** | Franco-atiradora | À distância |
| **Vespa** | Caçadora | Corpo a corpo |
| **Mandacaru** | Tanque | Corpo a corpo |
| **Iara** | Suporte | À distância |
| **Boitatá** | Mago | À distância |
| **Saci** | Duelista | Corpo a corpo |
| **Cuca** | Lutadora | Corpo a corpo |
| **Curupira** | Mago | À distância |
| **Boto** | Mago | À distância |
| **Caipora** | Maga | À distância |
| **Fulozinha** | Suporte | À distância |
| **Uirapuru** | Suporte | À distância |
| **Zé Pilintra** | Suporte | À distância |

O herói é **sorteado** no começo de cada partida: ninguém escolhe, mas dá pra sortear de novo duas vezes.

Antes da partida você escolhe dois **feitiços** pras teclas D e F:

| Feitiço | O que faz |
| --- | --- |
| **Fôlego** | Cura um pouco e acelera por um instante. |
| **Salto** | Some num clarão e reaparece onde o mouse aponta. |
| **Carapaça** | Um escudo forte por 2,5 segundos. |
| **Disparada** | Corre bem mais rápido por 6 segundos. |
| **Brasa** | Queima um herói inimigo com dano que ignora defesas. |
| **Laço** | Laça um herói inimigo e deixa ele bem lento. |

<p align="center">
  <img src="docs/herois.jpg" alt="Tela de escolha de herói e feitiços" />
</p>

## Loja

São **79 itens** do folclore e do sertão, em três camadas (básicos, intermediários e grandes), montados a partir das peças. Itens só dão atributos: ataque, poder, aceleração de habilidade, velocidade de ataque, crítico, roubo de vida, penetração de armadura, penetração mágica, armadura, resistência mágica e vida (e passo nas botas).

- **Roubo de vida**: o ataque básico em herói ou tropa cura uma parte do dano que entrou (com 15%, um golpe de 200 cura 30). Não vale em torre nem em habilidade.
- **Penetração**: a de armadura ignora parte da armadura do alvo no dano físico; a mágica, parte da resistência mágica no dano mágico. Somando itens, cada uma vai até 40%.

As exceções aos atributos são os itens **de usar**, nas teclas `1` a `6`: a **Carranca**, que vira estátua por 2,5 s, e três de suporte que valem pra você e pros aliados em volta (a **Água de Cheiro** cura, a **Figa de Guiné** dá escudo e o **Berrante do Vaqueiro** acelera).

Com a build fechada (seis itens) entram os **elixires**, garrafadas que não ocupam espaço e duram 3 minutos, mesmo se você cair. Só vale um por vez: comprar outro troca, e comprar o mesmo renova.

| Elixir | O que dá |
| --- | --- |
| **Garrafada de Catuaba** | +12% de ataque |
| **Garrafada de Jambu** | +12% de poder |
| **Garrafada de Arruda** | +8% de vida, armadura e resistência mágica |

| Linha | Itens grandes |
| --- | --- |
| Ataque | Garra do Lobisomem, Presa da Cobra-Grande, Borduna de Anhangá, Gume do Cangaceiro, Lança das Icamiabas, Garra da Onça-Pintada, Tacape do Bradador, Fita do Bonfim |
| Atirador | Arco da Caipora, Agouro da Acauã, Rasga-Mortalha, Assobio da Matinta, Chocalho da Cascavel, Tambor de Maracatu, Olho do Pai-do-Mato, Peixeira de Lampião |
| Roubo de vida | Presa do Chupa-cabra, Foice do Corpo-Seco, Lança do Labatut |
| Penetração | Arpão do Caboclo-d'Água e Lança do Curupaco (armadura), Fogo-corredor e Olho de Anhangá (mágica) |
| Poder | Cajado de Tupã, Cocar do Pajé, Coração da Mãe-do-Ouro, Véu da Mãe-d'Água, Carranca, Cuia da Benzedeira, Fogo da Mula sem Cabeça, Rosário da Rezadeira, Cabaça do Pajé |
| Suporte (de usar) | Água de Cheiro, Figa de Guiné, Berrante do Vaqueiro |
| Defesa | Casco de Jabuti, Manto de Jaci, Couro do Mapinguari, Armadura de Xique-xique, Raiz de Sumaúma, Tambor do Boi-Bumbá, Couraça do Tatu-Canastra, Escama do Pirarucu, Rede de Tucum, Tronco do Jequitibá, Bandeira do Divino, Cuia de Tacacá |

Em **Todos os itens**, a barra lateral filtra por atributo: marque vida e armadura e só aparecem os itens que têm os dois. Depois dá pra ordenar a lista pelo preço ou por quanto cada item dá de um atributo.

Cada herói tem **afinidade** com certos atributos (rendem 20% a mais nele). Em **Recomendados**, a loja mostra por onde começar e **três builds do herói**, montadas pelo que as habilidades dele usam (por exemplo, dano, sobrevivência ou ajudar o time). Clique no nome de uma pra loja seguir ela; a escolha fica lembrada. Os bots também usam essas builds.

<p align="center">
  <img src="docs/loja.jpg" alt="Loja com itens recomendados e árvore de montagem" />
</p>

## Controles

Todos os atalhos podem ser trocados em **Configurações**. Lá também dá pra escolher **como andar**: com o botão direito (padrão) ou com **WASD**, do jeito do LoL.

### Andando com o botão direito

| Tecla | Ação |
| --- | --- |
| Botão direito | Andar e atacar |
| `Shift` + botão direito | Ataca só heróis (sem herói no mouse, só anda) |
| Botão direito no canhão da base | Entra no canhão; depois, clique onde quer cair |
| `Q` `W` `E` `R` | Habilidades (por padrão, mira segurando e lança ao soltar) |
| `Shift` + habilidade | Evolui a habilidade ao subir de nível |
| `C` + habilidade | Só mostra o alcance: o clique esquerdo lança e o direito cancela, seja qual for o modo de lançamento |
| `D` `F` | Feitiços |
| `1` a `6` | Usa os itens do inventário |
| `A` + clique | Avança atacando o que aparecer (com `Shift`, só heróis) |
| `S` | Parar |
| `B` | Voltar pra base |
| `V` | Ping de dúvida (?) onde está o mouse, ou no ponto do minimapa sob ele. Só o seu time vê e ouve (até 3 a cada 5 s) |
| `P` | Loja |
| `Espaço` | Centraliza a câmera no herói |
| `Y` | Prende ou solta a câmera |
| `Tab` | Placar |
| `Esc` | Pausa e solta o mouse |

### Andando com WASD

As teclas andam e o mouse continua mirando. O WASD tem atalhos próprios, separados dos do botão direito.

| Tecla | Ação |
| --- | --- |
| `W` `A` `S` `D` | Andam pra cima, esquerda, baixo e direita da tela. Na beira do mapa o herói desliza junto da borda |
| Botão esquerdo | Ataca quem está no mouse (no chão, o inimigo mais perto dele). Segurando, ataca sempre que der |
| Botão esquerdo no canhão da base | Entra no canhão |
| Botão direito, `Shift`, `E`, `R` | Habilidades 1, 2, 3 e a especial |
| `Ctrl` + habilidade | Evolui a habilidade ao subir de nível |
| `Q` `F` | Feitiços |
| `H` | Parar |
| Botão do meio (segurar) | A câmera espia longe pro lado do mouse |

As demais (`C`, `1` a `6`, `B`, `V`, `P`, `Espaço`, `Y`, `Tab`, `Esc`) são iguais. Ligar o WASD prende a câmera no herói. Presa, ela espia um pouco pro lado do mouse.

Andar não cancela um ataque que já começou. Com uma tecla de andar segurada, quem manda no caminho são as teclas, e o clique de ataque vira um golpe só. Ele sai quando o alvo está ao alcance e a recarga acabou; até lá fica guardado enquanto o herói anda, e depois dele o herói volta a seguir as teclas. Segurando o botão esquerdo, o atirador bate sempre que der sem parar de andar. Pra kitar não ficar mais fácil que no botão direito, herói de distância que segura as teclas na hora do golpe espera um pouco mais por ele. A espera cresce com a velocidade de ataque, é menor pra quem não é atirador, e corpo a corpo não espera.

<p align="center">
  <img src="docs/menu.jpg" alt="Menu principal" />
</p>

## Rodando

Precisa de [Node.js](https://nodejs.org) 18 ou mais novo.

```bash
git clone https://github.com/ricardoraposo/peleja.git
cd peleja
npm install
```

### Contra bots

```bash
npm run dev
```

Abra o endereço que o Vite mostrar. No servidor de desenvolvimento também aparece o **Treino livre**, um modo sem partida pra testar heróis, itens e mecânicas (cria bonecos, bots e tropas, zera recargas, muda a velocidade do jogo).

### Online

```bash
npm run online
```

Faz o build e sobe o servidor em `http://localhost:7788`. Crie uma sala, mande o link ou o código de 4 letras pros amigos, escolham os times, completem com bots se quiser e comecem.

Pra jogar com gente de fora da sua rede, exponha a porta com `npm run tunnel` (usa o [ngrok](https://ngrok.com)).

| Variável | Padrão | Pra quê |
| --- | --- | --- |
| `PORT` | `7788` | Porta do servidor |
| `TEAM` | `5` | Tamanho padrão dos times |
| `DIFFICULTY` | `normal` | Dificuldade padrão dos bots (`facil`, `normal`, `dificil`) |

## Por dentro

- **[Three.js](https://threejs.org)** pra renderização, **[Vite](https://vite.dev)** pro build e **[ws](https://github.com/websockets/ws)** pro servidor. Nada além disso.
- **Uma simulação só** (`src/sim.js`): a mesma roda no navegador nas partidas contra bots e no servidor nas partidas online, que é autoritativo.
- **Rede enxuta** (`src/wire.js`): 30 ticks por segundo de simulação, 20 snapshots por segundo em formato binário com delta.
- **Tudo feito em código**: modelos, efeitos, ícones e sons são gerados em tempo de execução, sem arquivos de arte ou áudio.

```text
src/
  sim.js       regras do jogo e simulação
  bot.js       inteligência dos bots
  config.js    heróis, itens, feitiços e números de balanceamento
  game.js      cliente: câmera, entrada e interpolação
  models.js    modelos 3D dos heróis, tropas e estruturas
  effects.js   efeitos visuais das habilidades
  hud.js       interface da partida e loja
  net.js       transporte local e por WebSocket
  wire.js      protocolo binário
server/
  index.js     salas, saguão e servidor das partidas online
scripts/       testes de simulação, estresse e protocolo
```

Scripts de teste: `npm run sim`, `npm run stress` e `npm run wire`. Pra medir o balanceamento, `npm run balance -- 200 5` roda 200 partidas 5x5 de bots em paralelo e mostra vitória, dano, mortes, dano em torre e uso das habilidades de cada herói (troque o 5 por 3 pro 3x3).
