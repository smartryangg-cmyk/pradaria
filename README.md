# Pradaria 🚗🏡🐶

Mundo aberto 3D **pacífico** (sem armas, sem violência) que roda no navegador e foi pensado para tablets fracos.

- Uma cidade com ruas, faixas, semáforos, prédios, casas com quintal e praças com chafariz.
- Carros estacionados pela cidade: entre em qualquer um e dirija (buzina, velocímetro, cinco modelos).
- Estradas que saem da cidade para o campo: florestas, pinheirais, praias, lagos e morros.
- Bichos: ovelha, porquinho, galinha, vaca, coelho, capivara, o Caramelo e o Gatinho (os dois seguem você depois de um carinho).
- Dia e noite (a noite é clarinha), nuvens, sons feitos na hora.
- Contas com login, mundos com código para jogar com amigos em tempo real (você vê o carro do amigo andando) e emotes, sem chat aberto.
- Funciona sem internet também (posição salva no aparelho).

## Controles

| Tablet / celular | Computador |
|---|---|
| Arraste no lado esquerdo: andar / dirigir | WASD ou setas |
| Arraste no lado direito: girar a câmera | Mouse (clique na tela para travar) |
| Toque num carro ou botão 🚗 Entrar | E ou F |
| Botão 📯 buzina | H |
| Toque num bicho: carinho | Clique |
| ⬆ pular | Espaço · Shift corre |

## Como funciona (arquitetura)

| Parte | Onde roda | O quê |
|---|---|---|
| `public/` | Cloudflare Pages | O jogo: HTML/CSS/JS puros + Three.js (sem build) |
| `functions/api/` | Pages Functions | Contas (`/api/cadastrar`, `/api/entrar`), mundos (`/api/mundos`) |
| `lib/base.js` | Pages Functions | Senhas (PBKDF2), sessões assinadas (HMAC), limite de tentativas |
| `db/schema.sql` | Cloudflare D1 (`pradaria-db`) | Usuários, mundos, membros |
| `sala-worker/` | Worker `pradaria-sala` + Durable Object | Uma sala por mundo: repassa posições, carros e emotes por WebSocket |

O mundo é gerado a partir de uma semente (`terreno.js`, `cidade.js`), então o servidor só guarda onde cada jogador parou.

## Publicação

Todo push no `main` publica sozinho pelo GitHub Actions (`.github/workflows/publicar.yml`): cria o D1 se não existir, aplica o schema, publica a sala e o site.
Precisa dos segredos do repositório `CLOUDFLARE_API_TOKEN` (permissões: Pages, Workers Scripts, D1 — edição) e `CLOUDFLARE_ACCOUNT_ID`.

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
