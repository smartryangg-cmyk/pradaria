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
- **Linha do Tempo** (tipo de mundo escolhido ao criar): o mundo começa na Era dos Dinossauros e evolui pela história conforme ganha experiência (colocar e quebrar blocos, carinho em bicho novo, conversar, explorar, achar lugares especiais e cumprir as 4 missões de cada era). São 8 eras: Dinossauros, Gelo, Pedra, Antiga (pirâmides e templos), Medieval (castelos), Revolução Industrial (fábricas e trem), Moderna (prédios e estádio) e Futuro (foguete e cúpulas). Com a barra cheia aparece "Viajar no tempo": o chão se transforma numa onda em volta do jogador, chegam os bichos da época (braquiossauro, tricerátops, mamute, preguiça-gigante, robô-cão…), as vilas e roupas dos aldeões mudam, e o que os jogadores construíram fica. Blocos de eras futuras ficam com cadeado; máquinas chegam na Revolução Industrial e os veículos aos poucos (bicicleta e barco, depois carros). Online a experiência e a era são do mundo inteiro, guardadas pela sala. Painel: toque na barra da era no topo (tecla L). Regras em `public/js/eras-regras.js`, usadas pelo jogo e pela sala.
- Dia e noite (a noite é clarinha), sons feitos na hora.
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
| Arraste no lado direito: olhar | Mouse (clique na tela para travar) |
| Toque: colocar bloco / fazer carinho / conversar com aldeão | Botão direito |
| Segure o dedo: bater no bloco (cada batida arranca um pedaço) | Botão esquerdo (clique ou segure) |
| ⬆ pular · 🕊️ voar · ⬇ descer | Espaço · espaço duas vezes ou F · Shift |
| Barra de baixo e ＋: escolher blocos | 1–9, rodinha, E |
| 🧭: comandos (teleporte, casa, amigos, hora) | C |
| Balão: chat de texto · Microfone: entrar na voz · Segure: falar | T ou Enter · B (segurar) |
| Botão da câmera: ver o próprio boneco (olhos → de trás → de frente) | R (ou F5) |
| Barra da era no topo (Linha do Tempo): painel com missões e Viajar no tempo | L |
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

A pasta `android/` é um app pequeno (Trusted Web Activity) que abre https://pradaria.pages.dev em tela cheia, sem barra de endereço. Se o tablet não tiver Chrome, ele abre o jogo num WebView. O jogo em si continua vindo do site, então atualizações do jogo chegam sem baixar APK novo.

O `.github/workflows/apk.yml` gera o APK quando `android/` muda no `main` (ou rodando à mão em Actions) e publica em Releases:
https://github.com/smartryangg-cmyk/pradaria/releases/latest/download/pradaria.apk

Precisa dos segredos `ANDROID_KEYSTORE_B64` (a chave .jks em base64) e `ANDROID_KEYSTORE_SENHA`. A impressão digital dessa chave está em `public/.well-known/assetlinks.json`; se trocar a chave, troque lá também, senão o app mostra a barra de endereço. Guarde a chave: sem ela o tablet não aceita atualizar o app por cima.

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
