// Sem internet o jogo abre pela cópia do service worker (public/sw.js). Se um arquivo que o jogo importa
// faltar na lista BASICO, o jogo inteiro não abre sem internet. Confere todos os imports a partir de main.js.
// Uso: node testes/teste-cache-offline.mjs
import { readFileSync, existsSync } from 'fs';
import { join, dirname, normalize } from 'path';
const PUB = new URL('../public/', import.meta.url).pathname;
const sw = readFileSync(join(PUB, 'sw.js'), 'utf8');
const basico = new Set([...sw.matchAll(/'(\/[^']+)'/g)].map((m) => m[1]));
const vistos = new Set(), faltam = [];
function seguir(rel) {
  if (vistos.has(rel)) return;
  vistos.add(rel);
  if (!basico.has(rel)) faltam.push(rel);
  const caminho = join(PUB, rel);
  if (!existsSync(caminho) || !rel.endsWith('.js')) return;
  const txt = readFileSync(caminho, 'utf8');
  // import ... from './x.js', import('./x.js') e new Worker(new URL('./x.js', import.meta.url))
  for (const m of txt.matchAll(/(?:from\s+|import\s*\(\s*|new URL\(\s*)'(\.{1,2}\/[^']+\.js)'/g)) seguir(normalize(join(dirname(rel), m[1])));
}
seguir('/js/main.js');
if (faltam.length) { console.log('FALHA: o jogo importa e o service worker não guarda (sem internet não abre):\n' + faltam.join('\n')); process.exit(1); }
console.log(`ok: os ${vistos.size} arquivos que o jogo importa estão na cópia sem internet`);
