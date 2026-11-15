# Jogadores-robô

Times de "jogadores" que jogam o Pradaria como pessoas: cada um é um Chromium de verdade (WebGL), num aparelho
(PC, tablet, celular, celular deitado, tablet lento com processador 6x mais lento e internet 3G), e joga só pela
tela: teclado e mouse no PC, dedos no tablet e no celular (vários dedos ao mesmo tempo: joystick + pular).
O estado do jogo (`window.__jogo`, só com `/#teste`) é usado apenas para olhar onde as coisas estão e conferir o
resultado, nunca para fazer a ação.

Quando algo dá errado o jogador registra um bug com o passo a passo, o print e o console em `SAIDA/bugs.md`.
Bugs do tipo **clássico** são diferenças com a mecânica, a física, a interface ou o objetivo do jogo clássico de
blocos (o pedido do Ryan é tratar toda diferença como bug).

## Roteiros

| Roteiro | Aparelhos | O que faz |
|---|---|---|
| `sobrevivente` | pc, tablet | primeiro dia do clássico: soca árvore, tábuas na grade 2x2, bancada, gravetos, bancada 3x3, picareta, pedra |
| `fisica` | pc, tablet | velocidade de andar/correr, altura do pulo, pilar pulando, dano de queda, teclas do clássico (Shift, Ctrl, W W, T, Q, F5, roda) |
| `online` | PC + tablet | Ana cria o mundo e passa o código; Beto entra, se veem, bloco quebrado aparece, chat, Beto sem internet, recarregar |
| `caos` | tablet lento, celular | centenas de ações ao acaso (botões, menus, sem internet, outro aplicativo, girar a tela); confere que nunca trava |
| `tabuleiros` | PC, tablet, celular | Xadrez e Dama com lances ao acaso contra o computador, Truco com cartas ao acaso |

## Rodar

Com os servidores locais ligados (veja `.github/workflows/testes.yml`):

```
node testes/jogadores/rodada.mjs                         # todos os roteiros nos aparelhos padrão
node testes/jogadores/rodada.mjs sobrevivente:pc,celular caos:tablet-lento
BASE=https://pradaria.pages.dev node testes/jogadores/rodada.mjs caos   # no site no ar (precisa do proxy)
```

Variáveis: `SAIDA` (pasta dos prints e do relatório), `JUNTOS` (quantos roteiros ao mesmo tempo), `SEMENTE`
(repete a mesma bagunça do caos), `ACOES` (quantas ações no caos), `VERBOSO=1` (mostra cada passo).

Observação: o Chromium sem tela não gera o movimento do mouse travado (pointer lock); no PC o robô manda o mesmo
evento `mousemove` que o mouse mandaria. Sem placa de vídeo o jogo roda a poucos quadros por segundo, então as
medidas de tempo usam o tempo do jogo sempre que possível.
