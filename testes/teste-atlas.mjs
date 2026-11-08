// Todo bloco opaco precisa ter textura sem furos no atlas de 16px e no de 32px.
// (Um tile vazio deixa o bloco invisível e o terreno "cheio de buracos".) URL=http://localhost:8788
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext()).newPage();
await p.goto((process.env.URL || 'http://localhost:8788') + '/#teste');
const furos = await p.evaluate(async () => {
  const B = await import('/js/blocos.js');
  const { tex } = B.criarAtlas();
  const c16 = tex.image; tex.userData.definirHD(true); const c32 = tex.image;
  const cheio = (cv, t, T) => {
    const C = cv.width / T, d = cv.getContext('2d').getImageData((t % C) * T, Math.floor(t / C) * T, T, T).data;
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] >= 128) n++;
    return n / (T * T);
  };
  const r = [];
  for (const def of Object.values(B.BLOCOS)) {
    if (!def || !def.opaco || !def.tiles) continue;
    for (const t of new Set(def.tiles)) for (const [cv, T] of [[c16, 16], [c32, 32]]) if (cheio(cv, t, T) < 0.99) r.push(`${def.id} ${def.nome} tile ${t} (${T}px)`);
  }
  return r;
});
await b.close();
if (furos.length) { console.log('FALHOU: blocos opacos com textura vazia:\n' + furos.join('\n')); process.exit(1); }
console.log('ok: todos os blocos opacos têm textura nos atlas de 16px e 32px');
