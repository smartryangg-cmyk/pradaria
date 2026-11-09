// Todo bloco opaco precisa ter textura sem furos nos atlas de 16px, 32px e 64px.
// (Um tile vazio deixa o bloco invisível e o terreno "cheio de buracos".) URL=http://localhost:8788
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext()).newPage();
await p.goto((process.env.URL || 'http://localhost:8788') + '/#teste');
const furos = await p.evaluate(async () => {
  const B = await import('/js/blocos.js');
  const { tex } = B.criarAtlas();
  const c16 = tex.image; tex.userData.definirResolucao(32); const c32 = tex.image;
  tex.userData.definirResolucao(64); // o de 64px é pintado em workers: espera ficar pronto
  for (let k = 0; k < 200 && tex.userData.resolucao !== 64; k++) await new Promise((ok) => setTimeout(ok, 50));
  const c64 = tex.image;
  if (tex.userData.resolucao !== 64) return ['atlas de 64px não ficou pronto'];
  const cheio = (cv, t, T) => {
    const C = cv.width / T, d = cv.getContext('2d').getImageData((t % C) * T, Math.floor(t / C) * T, T, T).data;
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] >= 128) n++;
    return n / (T * T);
  };
  const r = [];
  for (const def of Object.values(B.BLOCOS)) {
    if (!def || !def.opaco || !def.tiles) continue;
    for (const t of new Set(def.tiles)) for (const [cv, T] of [[c16, 16], [c32, 32], [c64, 64]]) if (cheio(cv, t, T) < 0.99) r.push(`${def.id} ${def.nome} tile ${t} (${T}px)`);
  }
  return r;
});
await b.close();
if (furos.length) { console.log('FALHOU: blocos opacos com textura vazia:\n' + furos.join('\n')); process.exit(1); }
console.log('ok: todos os blocos opacos têm textura nos atlas de 16px, 32px e 64px');
