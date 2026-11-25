# Pradaria 🌼

Jogo de construir e explorar, **pacífico** (só bichinhos, nada de monstros), que roda no navegador e foi pensado para tablets fracos.

- Mundo de blocos infinito gerado na hora: campos, florestas, praias, lagos e morros.
- 22 blocos para construir (grama, pedra, tábuas, vidro, tijolo, lãs coloridas, flores, lampião…).
- **Vilas** espalhadas pelo mundo (sempre tem uma pertinho de onde se começa): casas com telhado colorido, caminha e lampião, ruas com postes, praça com poço, plantações de trigo e celeiro com feno. Quatro estilos: do campo, de tijolinho, da praia (telhado de feno) e da serra. Cada vila tem nome (ex.: "Vila do Girassol").
- **Aldeões** que passeiam, acenam quando você chega, conversam com um toque (às vezes dão um presentinho) e dormem em casa à noite.
- **Veículos**: carro conversível, jipe, esportivo, quadriciclo, moto, bicicleta, skate, trator, caminhão, ônibus, barco, submarino, avião e helicóptero, com rodas redondas e 8 cores. Não ficam num menu: a **garagem** é um lugar no mundo (junto do posto de cada vila; sem vilas, perto do começo). Lá você pega a **chave** (de graça sem o mercado; com o mercado, compra com moedas ou monta com troncos, pedras e areia da mochila). Bicicleta e skate todo mundo já tem. Com a chave, o **celular** chama o veículo de qualquer lugar, e só quem tem a chave dirige (os outros vão de passageiro). Combustível ou bateria acabam andando (sem eles o veículo vai bem devagar), batidas amassam (com dano total ele quebra e anda mancando) e no **posto** se abastece e conserta (com moedas, se o mercado estiver ligado). Guardado, o veículo é abastecido e consertado aos poucos. Na estrada anda mais rápido (jipe, quadriciclo e trator ligam menos para a grama), o avião só decola numa rua ou estrada, barco e submarino só andam na água. As vilas e o porto já têm veículos estacionados que qualquer um pode usar. Freiam sozinhos na frente dos bichos e das pessoas (ninguém se machuca). Tudo some com a opção Veículos desligada.
- Bichos: ovelha, porquinho, galinha, vaca, coelho, capivara e o Caramelo (que segue você depois de um carinho).
- Visual caprichado já no padrão: sol que faz sombra de verdade, céu com degradê, pôr do sol rosado e estrelas, água que reflete o céu e brilha, folhas e flores balançando com o vento, lampiões que iluminam a noite, névoa na cor do horizonte.
- Três níveis de gráficos (Linda, Bonita, Leve). Se o aparelho ficar lento, o jogo baixa sozinho para rodar liso.
- Quebrar é aos poucos: cada batida arranca um pedaço do bloco, que vai ficando esculpido até cair. Pedra e tijolo aguentam mais batidas que terra e folhas; flores saem de uma vez.
- Blocos com física: areia e pedrisco caem quando ficam sem apoio, folhas caem quando a árvore perde o tronco (folhas que você colocou ficam), grama coberta vira terra e terra descoberta volta a ficar verde aos poucos.
- **Mercado** (opcional, escolhido ao criar o mundo): quebrar blocos do mundo enche a mochila; na loja da vila (toque num aldeão) você vende o que coletou e compra blocos especiais (tijolo, vidro, lampião, lãs…). Dá para presentear moedas a um amigo online. Online quem guarda e confere as moedas é a sala (servidor).
- **Coletar e criar** (vem ligado nos mundos novos; desligado = blocos à vontade): começa de mão vazia, o que você quebra vai para a mochila e colocar gasta. Livro de receitas só com toques (mostra o que tem e o que falta, sem grade para decorar): tronco vira tábuas, gravetos, **Bancada** (toque nela para abrir as receitas), picaretas, machados e pás de madeira e de pedra (quebram 2x e 3x mais rápido os blocos do tipo delas), tijolo, vidro, lampião, lãs coloridas com flores e as peças de engenharia. Carinho na ovelha dá lã. É a mesma mochila do Mercado (vender sai dela e comprar traz 4 do bloco). Regras em `public/js/receitas.js`, usadas pelo jogo e pela sala.
- **Missões** (opcional): 21 desafios tranquilos (colocar blocos, fazer carinho, conversar com aldeões, plantar flores, explorar…) que aparecem de 3 em 3 e dão moedas (ou estrelas, se o mercado estiver desligado). Regras em `public/js/economia.js`, usadas pelo jogo e pela sala.
- **Nadar**: boia com a cabeça para fora, mergulha, nada para onde olha embaixo d'água e sobe na beirada andando contra ela. Embaixo d'água a visão fica azul-esverdeada com bolhas subindo e o som abafado; a barra de bolhas mostra o fôlego (sem perigo: acabou o fôlego, a água leva você para cima; com "Monstros machucam", perde meio coração por vez).
- Dia e noite (a noite é clarinha).
- **Som** (public/js/som.js): tudo sintetizado na hora com WebAudio, sem nenhum arquivo de áudio (zero download, nada de outros jogos; crédito: sons originais do Pradaria, feitos em código). Passos e blocos com o som do material (grama, terra, pedra, madeira, areia, neve, vidro, lã, metal, folhas, água), bichos com vozes próprias, motores que mudam com a velocidade e as marchas, vento (o mesmo que gira os cataventos), água por perto, passarinhos de dia, grilos de noite e eco nas cavernas. Som 3D: amigos, bichos, blocos e motores soam do lado e na distância certos. Música ambiente leve e opcional (frases curtas com silêncio entre elas). Na pausa: Sons, Música ambiente, Efeitos e Voz dos amigos, cada um com seu volume. Tablet fraco: limite de sons ao mesmo tempo (12 no gráfico Leve/celular, 22 nos outros) e o áudio para quando a aba some. Testes: testes/teste-som.mjs e testes/teste-som-online.mjs.
- Contas com login, mundos com código para jogar com amigos em tempo real e emotes.
- **Chat de texto** (botão do balão, tecla T ou Enter): palavrão vira asteriscos e telefone, link, e-mail, rede social, endereço e senha não são enviados (o filtro roda no aparelho e de novo na sala, `public/js/chat-filtro.js`); no máximo 1 mensagem a cada 1,2 s e 6 a cada 15 s por pessoa. Quem entra vê as últimas mensagens. Tocar no nome de alguém silencia essa pessoa só para você.
- **Chat de voz** (botão do microfone): áudio direto entre os aparelhos (WebRTC, `public/js/voz.js`), a sala só passa os recados. O microfone só liga enquanto você segura o botão "Segure" (ou a tecla B); botão de mudo para não ouvir ninguém e silenciar por pessoa. Sem microfone, dá para entrar só ouvindo.
- O dono do mundo liga e desliga o chat de texto e o de voz na criação ou depois, na pausa (vale na hora para todos).
- Menu de comandos 🧭 só com botões (sem digitar): marcar casa e voltar para ela, guardar lugares com desenhos, ir para o começo do mundo, ir para um lugar novo bem longe, voltar para onde estava, ir até um amigo ou chamar um amigo (o amigo precisa tocar em "Pode!") e mudar a hora do dia (online, só o dono do mundo).
- Funciona sem internet também (mundo salvo no aparelho).

## Controles

| Tablet / celular | Computador |
|---|---|
| Arraste no lado esquerdo: andar | WASD ou setas |
| Toque duas vezes no joystick e segure (ou empurre até a borda): correr | Shift (no chão) ou Ctrl + andar |
| Botão de agachar (liga e desliga) | Segure Z |
| Arraste no lado direito: olhar | Mouse (clique na tela para travar) |
| Toque: colocar bloco / fazer carinho / conversar com aldeão | Botão direito |
| Segure o dedo: bater no bloco (cada batida arranca um pedaço) | Botão esquerdo (clique ou segure) |
| ⬆ pular · 🕊️ voar · ⬇ descer (voando/nadando) | Espaço · espaço duas vezes ou F · Shift (voando/nadando) |
| Na água: ⬆ nada para cima · ⬇ mergulha · olhar para baixo e andar mergulha para frente · andar contra a beirada sobe para a terra | Espaço · Shift · W olhando para baixo |
| Barra de baixo e ＋: escolher blocos | 1–9, rodinha, E |
| 🧭: comandos (teleporte, casa, amigos, hora) | C |
| Balão: chat de texto · Microfone: entrar na voz · Segure: falar | T ou Enter · B (segurar) |
| Botão da câmera: ver o próprio boneco (olhos → de trás → de frente) | R (ou F5) |
| Celular (chamar veículo) · Garagem (no posto) · toque no veículo ou "Entrar" · Descer · buzina | G · G · V · V · H |
| No veículo: joystick dirige; ⬆ ⬇ sobem e descem avião/helicóptero/submarino; no posto, Abastecer e Consertar | WASD; Espaço/Shift |

## Como funciona (arquitetura)

| Parte | Onde roda | O quê |
|---|---|---|
| `public/` | Cloudflare Pages | O jogo: HTML/CSS/JS puros + Three.js (sem build). `graficos.js` tem o céu, a água, as sombras e os níveis de qualidade |
| `functions/api/` | Pages Functions | Contas (`/api/cadastrar`, `/api/entrar`), mundos (`/api/mundos`) |
| `lib/base.js` | Pages Functions | Senhas (PBKDF2), sessões assinadas (HMAC), limite de tentativas |
| `db/schema.sql` | Cloudflare D1 (`pradaria-db`) | Usuários, mundos, membros |
| `sala-worker/` | Worker `pradaria-sala` + Durable Object | Uma sala por mundo: guarda as edições de blocos e repassa posições/emotes por WebSocket |

O terreno é gerado a partir de uma semente, então o servidor só guarda **o que os jogadores mudaram**.

## Publicação

Todo push no `main` publica sozinho pelo GitHub Actions (`.github/workflows/publicar.yml`): cria o D1 se não existir, aplica o schema, publica a sala e o site.
Precisa dos segredos do repositório `CLOUDFLARE_API_TOKEN` (permissões: Pages, Workers Scripts, D1 — edição) e `CLOUDFLARE_ACCOUNT_ID`.

## App Android (APK)

A pasta `android/` tem dois apps, os dois com o **jogo inteiro dentro** (módulo `android/pacote`, que leva a pasta `public/` para o APK):

- `app/` (pacote `dev.pradaria.jogo`, tablet e celular): abre em tela cheia num WebView, **funciona sem internet** (mundo sem conta salvo no aparelho) e, com internet, entra na conta e joga online como no site. Segurar o dedo não abre menu de copiar, o Voltar do Android pausa o jogo ou volta de tela (`window.pradariaVoltar` no `main.js`), o microfone do chat de voz pede a permissão do Android e "Baixar arquivo do mundo" pergunta onde guardar.
- `tv/` (pacote `dev.pradaria.tv`, Android TV / TV Box): a versão da TV (`/tv`), também com o jogo dentro.

Como funciona: o WebView continua no endereço `https://pradaria.pages.dev` (login, mundo salvo e online iguais ao navegador), mas cada arquivo do jogo sai de dentro do app (`Pacote.java`); só `/api/` (contas, mundos, salas) vai para a internet. O app se apresenta como `PradariaApp/1.0.N` no user agent e não usa o service worker.

Atualização sozinha: a cada publicação o `publicar.yml` gera `public/app-pacote.json` (número da versão e sha256 de cada arquivo, `scripts/pacote-app.mjs`). Com internet, o app compara com o jogo que tem; se o do site for mais novo, baixa só o que mudou, confere cada arquivo e passa a usar na próxima vez que abrir. Se algo falhar, continua com o que tinha.

O `.github/workflows/apk.yml` gera os APKs quando `android/` muda no `main` (ou rodando à mão em Actions) e publica em Releases:
https://github.com/smartryangg-cmyk/pradaria/releases/latest/download/pradaria.apk

Testes de verdade no mesmo workflow: `teste-app` (emulador de tablet: abre, entra na conta, se atualiza, liga o modo avião e joga sem internet; `testes/teste-app-apk.mjs`) e `teste-tv` (emulador de Android TV).

Precisa dos segredos `ANDROID_KEYSTORE_B64` (a chave .jks em base64) e `ANDROID_KEYSTORE_SENHA`. Guarde a chave: sem ela o tablet não aceita atualizar o app por cima. A impressão digital dela está em `public/.well-known/assetlinks.json` (links do Pradaria abrem direto no app).

## Rodar no computador

```bash
npm install
npm run dev:sala   # num terminal (sala multijogador, porta 8790)
npm run dev        # em outro (site + API, porta 8788)
```
Testes com navegador: `node testes/teste-online.mjs` (precisa do Playwright).

## Próximas fases (ideias)

1. **Mais vida no mundo:** bichos sincronizados entre jogadores, fazendinha (plantar e colher), pescar, alimentar os bichos.
2. **Modo aventura leve:** coletar materiais, baú, mesa de criar coisas, sem perigo.
3. **Personalização:** escolher roupa/cabelo do bonequinho, dar nome aos bichos.
4. **Mais biomas:** neve, deserto com cactos, ilhas, cavernas iluminadas.
5. **Desempenho:** montagem das malhas num Web Worker e malhas mais enxutas (greedy meshing).
