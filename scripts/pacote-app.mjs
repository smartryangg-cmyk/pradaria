// Lista dos arquivos do jogo para o app Android (public/app-pacote.json): número da versão e sha256 de cada arquivo.
// O app leva o jogo dentro do APK e, com internet, compara com esta lista no site para baixar só o que mudou
// (android/pacote/.../Pacote.java). Rodar depois de gerar public/js/versao.js (publicar.yml e apk.yml).
//   node scripts/pacote-app.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { createHash } from 'crypto';
import { join, relative, sep } from 'path';

const PUBLICO = new URL('../public/', import.meta.url).pathname;
// o que não vai para o app: configurações do Cloudflare, o service worker (o app não usa) e a própria lista
const FORA = (r) => r.startsWith('.well-known/') || ['_headers', '_redirects', 'sw.js', 'app-pacote.json'].includes(r);

const arquivos = {};
(function andar(dir) {
  for (const n of readdirSync(dir).sort()) {
    const c = join(dir, n);
    const r = relative(PUBLICO, c).split(sep).join('/');
    if (statSync(c).isDirectory()) { if (!FORA(r + '/')) andar(c); continue; }
    if (FORA(r)) continue;
    const d = readFileSync(c);
    arquivos[r] = { sha256: createHash('sha256').update(d).digest('hex'), tam: d.length };
  }
})(PUBLICO);

const v = readFileSync(join(PUBLICO, 'js/versao.js'), 'utf8');
const numero = (v.match(/numero:\s*'([^']*)'/) || [])[1] || 'teste';
const hash = (v.match(/hash:\s*'([^']*)'/) || [])[1] || '';
writeFileSync(join(PUBLICO, 'app-pacote.json'), JSON.stringify({ numero, hash, arquivos }));
console.log(`app-pacote.json: versão ${numero} ${hash}, ${Object.keys(arquivos).length} arquivos, ${(Object.values(arquivos).reduce((s, a) => s + a.tam, 0) / 1e6).toFixed(1)} MB`);
