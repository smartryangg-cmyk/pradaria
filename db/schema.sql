-- Pradaria: contas e mundos (Cloudflare D1). Pode rodar várias vezes.
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE COLLATE NOCASE,
  hash TEXT NOT NULL,
  sal TEXT NOT NULL,
  cor INTEGER NOT NULL DEFAULT 0,
  criado_em INTEGER NOT NULL,
  skin TEXT -- personagem em JSON (public/js/skin.js); bancos antigos ganham a coluna em lib/base.js
);
CREATE TABLE IF NOT EXISTS mundos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  dono_id INTEGER NOT NULL,
  semente INTEGER NOT NULL,
  criado_em INTEGER NOT NULL,
  opcoes TEXT NOT NULL DEFAULT '{}', -- opções da criação (bichos, monstros, vilas...), ver public/js/opcoes-mundo.js
  sala TEXT -- nome fixo da sala (Durable Object); vazio = o código. Continua o mesmo quando o dono troca o código.
);
CREATE TABLE IF NOT EXISTS membros (
  mundo_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  entrou_em INTEGER NOT NULL,
  PRIMARY KEY (mundo_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS membros_usuario ON membros (usuario_id);
CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tentativas (chave TEXT PRIMARY KEY, n INTEGER NOT NULL, ate INTEGER NOT NULL);
