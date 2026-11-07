# Pradaria 🌼

Jogo de construir e explorar, **pacífico** (só bichinhos, nada de monstros), que roda no navegador e foi pensado para tablets fracos.

- Mundo de blocos infinito gerado na hora: campos, florestas, praias, lagos e morros.
- 22 blocos para construir (grama, pedra, tábuas, vidro, tijolo, lãs coloridas, flores, lampião…).
- Bichos: ovelha, porquinho, galinha, vaca, coelho, capivara e o Caramelo (que segue você depois de um carinho).
- Dia e noite (a noite é clarinha), nuvens, sons feitos na hora.
- Contas com login, mundos com código para jogar com amigos em tempo real e emotes (sem chat aberto, mais seguro para crianças).
- Funciona sem internet também (mundo salvo no aparelho).

## Controles

| Tablet / celular | Computador |
|---|---|
| Arraste no lado esquerdo: andar | WASD ou setas |
| Arraste no lado direito: olhar | Mouse (clique na tela para travar) |
| Toque: colocar bloco / fazer carinho | Botão direito |
| Segure o dedo: quebrar | Botão esquerdo |
| ⬆ pular · 🕊️ voar · ⬇ descer | Espaço · espaço duas vezes ou F · Shift |
| Barra de baixo e ＋: escolher blocos | 1–9, rodinha, E |

## Como funciona (arquitetura)

| Parte | Onde roda | O quê |
|---|---|---|
| `public/` | Cloudflare Pages | O jogo: HTML/CSS/JS puros + Three.js (sem build) |
| `functions/api/` | Pages Functions | Contas (`/api/cadastrar`, `/api/entrar`), mundos (`/api/mundos`) |
| `lib/base.js` | Pages Functions | Senhas (PBKDF2), sessões assinadas (HMAC), limite de tentativas |
| `db/schema.sql` | Cloudflare D1 (`pradaria-db`) | Usuários, mundos, membros |
| `sala-worker/` | Worker `pradaria-sala` + Durable Object | Uma sala por mundo: guarda as edições de blocos e repassa posições/emotes por WebSocket |

O terreno é gerado a partir de uma semente, então o servidor só guarda **o que os jogadores mudaram**.

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
