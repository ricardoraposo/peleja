# Como desenvolver no Peleja

Guia pra quem (pessoa ou agente) for mexer no código. O README explica o jogo; aqui ficam os padrões do projeto.

## Rodando e testando

```bash
npm install
npm run dev      # contra bots, com o Treino livre no menu
npm run online   # build + servidor em http://localhost:7788
npm run sim      # partidas só de bots, sem navegador (node scripts/simtest.js N normal)
npm run wire     # confere que o protocolo binário entrega igual ao JSON
npm run stress   # carga no servidor
npm run build    # tem que passar antes de subir
```

Antes de subir qualquer mudança de regra: `npm run wire`, `npm run build` e algumas partidas de bots (`node scripts/simtest.js 10 normal`). Olhe o `resumo:` no fim: partida que bate em `40.0m` terminou por tempo, e várias assim indicam que a mudança emperrou o jogo.

Mudança visual se confere no **Treino livre** (`npm run dev`, botão no menu): troca de herói, nível, bonecos, tropas e recargas pelo painel de depuração (`src/debug.js`).

## Arquitetura

| Arquivo | Papel |
| --- | --- |
| `src/config.js` | Todos os números: heróis, habilidades, itens, feitiços, mapa, torres. |
| `src/sim.js` | A simulação. Roda igual no navegador (contra bots) e no servidor (online), que é autoritativo. |
| `src/bot.js` | Decisões dos bots. Chama os mesmos métodos da simulação que um jogador. |
| `src/wire.js` | Protocolo binário: uma tabela de campos por mensagem. |
| `src/game.js` | Cliente: entrada, câmera, interpolação, despacho dos eventos da simulação. |
| `src/models.js`, `src/effects.js`, `src/fxstyle.js` | Modelos 3D, efeitos e o estilo visual e sonoro de cada herói. |
| `src/hud.js`, `src/overlay.js`, `src/main.js` | Interface da partida, barras e avisos sobre os heróis, menus e tela de escolha. |
| `server/index.js` | Salas e partidas online. |

Regras que não se quebram:

- **Regra de jogo mora em `sim.js`; número mora em `config.js`.** O cliente só desenha o que a simulação manda. Nada em `fxstyle.js`, `effects.js` ou `models.js` pode mudar o resultado de uma partida.
- **A simulação não conhece o navegador.** Ela roda no Node: nada de `window`, `document` ou Three.js em `sim.js`, `bot.js`, `config.js`, `geo.js` e `wire.js`.
- **Mensagem nova entra na tabela do `wire.js`** (eventos em `EVENTS`, comandos em `COMMANDS`). Fora da tabela ela ainda chega, como JSON, mas o `npm run wire` acusa. Campo opcional leva `?`.
- **Estado do herói que o cliente precisa ver vai nas flags** (`F` em `sim.js`, um bit por estado) ou no `meState`, não em evento solto.
- **Estado novo no herói precisa ser zerado** nos mesmos lugares em que os outros são (procure por `charmT = 0` em `sim.js`: são três pontos, incluindo morte e renascimento).
- **Sem dependência nova e sem arquivo de arte ou som.** Só Three.js, Vite e ws; modelos, ícones, efeitos e sons são gerados em código.

## Habilidades

Uma habilidade é um objeto em `config.js` com um `kind` (`proj`, `aoe`, `nova`, `cone`, `dash`, `blink`, `target`, `self`, `ally`, `zone`) e campos opcionais que ligam mecânicas (`fx`, `bolts`, `charges`, `recast`, `hover`, `trap`, `steal`, `ret`, `fetch`...). Os comentários acima de `HEROES` em `config.js` documentam cada campo: **mecânica nova ganha uma linha ali**.

- Prefira compor com o que já existe. Mecânica nova entra como campo genérico na simulação (`if (ab.campo)`), nunca como `if (h.heroId === '...')`.
- Dano, cura e escudo usam `{ b, l, ad, ap, hp }` (base, por nível, × ataque, × poder, × vida máxima) e passam por `this.val(...)`.
- Controle novo (algo que impede o herói de agir) entra no getter `cc` da unidade e cancela conjuração em `applyFx`.
- Toda mecânica aparece no tooltip: `fxText` e `abilityTip` em `hud.js`.
- Se um bot não souber usar a habilidade, ele fica com ela parada: acrescente a regra em `bot.js`.

## Herói novo: lista de passos

1. `config.js`: entrada em `HEROES` (nome, `title`, `role`, cor, `look`, atributos, quatro habilidades) e o id em `HERO_ORDER`. O `role` define afinidade e build (`atirador`, `lutador`, `assassino`, `tanque`, `mago`, `suporte`).
2. `sim.js`: só se precisar de mecânica nova.
3. `fxstyle.js`: entrada em `HERO_FX` (elemento, forma do tiro básico e dos projéteis, sons).
4. `effects.js`: formas novas de projétil em `buildProj` (e, se quiser, rastro e fim em `projTrail` e `endProj`).
5. `models.js`: chapéu, arma e acessório novos, se o `look` pedir. O jogo é visto de cima: o que identifica o herói é o topo da cabeça, então ponha cor ali (cabelo ou chapéu escuro vira um borrão).
6. `hud.js`: ícones novos em `ICONS` e linhas de tooltip pras mecânicas novas.
7. `bot.js`: regra de uso, se o `kind` e os campos não forem cobertos.
8. `README.md`: contagem de heróis e a linha na tabela (coluna de papel só com o papel: Mago, Suporte, Tanque...).
9. Testes: um script no Node exercitando as quatro habilidades no modo treino, `npm run wire`, `npm run build`, partidas de bots pra comparar dano e mortes com os outros heróis, e uma olhada no Treino livre e na tela de escolha.

Números de herói novo partem de um herói parecido que já existe (a Iara pra suporte, o Boitatá pra mago) e se ajustam depois de jogar.

## Conteúdo

- Tudo em **português do Brasil**: nomes, descrições, comentários do código e mensagens de commit.
- Heróis e itens vêm do **folclore e da cultura brasileira**. Mecânicas podem se inspirar em outros jogos; nomes, visual e personagens são sempre nossos.
- Texto de interface curto e direto, falando com o jogador ("Joga um coquinho que fere mais quanto mais longe voar").

## Código

- JavaScript puro em módulos ES, sem TypeScript, sem framework, sem linter configurado: siga o estilo do arquivo em que estiver mexendo (dois espaços, aspas simples, ponto e vírgula).
- Comentário explica o porquê ou a regra do jogo, em uma linha, em português. Não comente o óbvio.
- Posições trafegam com uma casa decimal (`r1`), direções com duas (`r2`).
- Tecla nova entra em `ACTIONS` (`src/keys.js`), pra aparecer em Configurações e poder ser trocada. Não deixe tecla fixa em texto de interface: use a tecla configurada.

## Git

- A `main` é protegida: sem force-push e sem apagar. Colaboradores sobem direto ou por PR.
- **Um ajuste por commit**, com mensagem em português dizendo o que mudou pro jogador ("Coquinho da Caipora fica 2 s parado no ar esperando a rebatida").
- Antes de subir: `git pull --rebase`. Se o rebase trouxer mudança dos outros, **rode os testes de novo depois dele**: rebase sem conflito ainda pode quebrar a simulação.
- Mudou regra, herói, controle ou tecla? Atualize o README no mesmo commit.
