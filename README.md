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
- **Cura**: frutas espalhadas pela ponte, ou voltando pra base com `T` (8 segundos parado; dano ou qualquer ação cancela). Na fonte a vida volta depressa.
- **A loja só abre na base ou quando você cai**, então voltar pra comprar custa tempo de rota.
- **Torres batem forte** em quem ataca herói perto delas. Deixe as tropas tomarem os tiros primeiro.

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
| **Cuca** | Bruxa-jacaré (lutadora com Fúria) | Corpo a corpo |
| **Curupira** | Mago de fogo | À distância |
| **Boto** | Encantador | À distância |
| **Caipora** | Traquina | À distância |
| **Fulozinha** | Pegadora (suporte) | À distância |
| **Uirapuru** | Cantador (suporte) | À distância |
| **Zé Pilintra** | Malandro (suporte) | À distância |

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

São **47 itens** do folclore e do sertão, em três camadas (básicos, intermediários e grandes), montados a partir das peças. Itens só dão atributos: ataque, poder, aceleração de habilidade, velocidade de ataque, crítico, armadura, resistência mágica e vida (e passo nas botas). A única exceção é a **Carranca**, que vira estátua por 2,5 s.

| Linha | Itens grandes |
| --- | --- |
| Ataque | Garra do Lobisomem, Presa da Cobra-Grande, Borduna de Anhangá, Gume do Cangaceiro, Lança das Icamiabas |
| Atirador | Arco da Caipora, Agouro da Acauã, Rasga-Mortalha, Assobio da Matinta |
| Poder | Cajado de Tupã, Cocar do Pajé, Coração da Mãe-do-Ouro, Véu da Mãe-d'Água, Carranca, Cuia da Benzedeira |
| Defesa | Casco de Jabuti, Manto de Jaci, Couro do Mapinguari, Armadura de Xique-xique, Raiz de Sumaúma, Tambor do Boi-Bumbá |

Cada herói tem **afinidade** com certos atributos (rendem 20% a mais nele) e a loja já sugere por onde começar, a build principal na ordem e um caminho alternativo.

<p align="center">
  <img src="docs/loja.jpg" alt="Loja com itens recomendados e árvore de montagem" />
</p>

## Controles

Todos os atalhos podem ser trocados em **Configurações**.

| Tecla | Ação |
| --- | --- |
| Botão direito | Andar e atacar |
| `Shift` + botão direito | Ataca só heróis (sem herói no mouse, só anda) |
| `Q` `W` `E` `R` | Habilidades (por padrão, mira segurando e lança ao soltar) |
| `Shift` + habilidade | Evolui a habilidade ao subir de nível |
| `D` `F` | Feitiços |
| `1` a `6` | Usa os itens do inventário |
| `A` + clique | Avança atacando o que aparecer (com `Shift`, só heróis) |
| `S` | Parar |
| `T` | Voltar pra base |
| `B` | Loja |
| `Espaço` | Centraliza a câmera no herói |
| `Y` | Prende ou solta a câmera |
| `Tab` | Placar |
| `Esc` | Pausa e solta o mouse |

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

Scripts de teste: `npm run sim`, `npm run stress` e `npm run wire`.
