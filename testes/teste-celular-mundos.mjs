// Tela "Escolha um mundo" (logado) no celular: a caixa não pode passar da largura da tela.
// Simula a conta e a lista de mundos (com todos os ícones de opções ligados, como no print do Ryan).
// Larguras 240/280 = celular de 360 com letra/zoom grande do Android. SAIDA=pasta das fotos.
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const SAIDA = process.env.SAIDA || '/tmp';
const URL = process.env.URL || 'http://localhost:8788';
const ops = { tipo: 'normal', estilo: 'blocos', tamanho: 'medio', sobrevivencia: true, animais: true, vilas: true, veiculos: true, maquinas: true, aguaCorre: true, cicloDia: true, mercado: true, objetivos: true, chatTexto: true, chatVoz: true, selvagens: true, construcao: true };
const mundos = [
  { id: 1, nome: 'Mundo 08', codigo: 'SCCJP5BS', dono: true, opcoes: { ...ops, tamanho: 'grande' } },
  { id: 2, nome: 'Mundo 04', codigo: 'RQDA7N9E', dono: true, opcoes: { ...ops, tipo: 'guerra', estilo: 'natural', armas: true } },
  { id: 3, nome: 'Mundo com um nome bem comprido mesmo', codigo: '8SZFBSER', dono: true, opcoes: ops },
  { id: 4, nome: 'Mundo da Ana', nome_dono: 'ana', dono: false, opcoes: { ...ops, tipo: 'ilha' } },
];
const TAM = { 'w240': [240, 533, 4.5], 'w280': [280, 622, 3.85], 'w320': [320, 711, 3.375], 'w360': [360, 800, 3], 'w412': [412, 915, 2.625], 'deitado': [800, 360, 3] };
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhou = 0;
for (const [nome, [w, h, dpr]] of Object.entries(TAM)) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); const erros = []; p.on('pageerror', (e) => erros.push(e.message));
  await p.route('**/api/eu', (r) => r.fulfill({ json: { usuario: { id: 1, nome: 'ryankrano', idade16: true, temNascimento: true } } }));
  await p.route('**/api/mundos', (r) => r.fulfill({ json: { mundos } }));
  await p.goto(URL + '/'); await p.evaluate(() => localStorage.setItem('pradaria.token', 'teste')); await p.reload();
  await p.waitForTimeout(800);
  if (await p.isVisible('#m-jogos')) await p.tap('.jogo[data-jogo=pradaria]');
  else if (!(await p.isVisible('#m-mundos'))) await p.tap('#bt-entrar');
  await p.waitForSelector('#m-mundos', { state: 'visible', timeout: 10000 });
  await p.waitForTimeout(400);
  const fora = await p.evaluate(() => {
    const W = innerWidth, out = [];
    const sw = document.documentElement.scrollWidth; if (sw > W + 1) out.push('pagina rola de lado ' + sw);
    for (const e of document.querySelectorAll('#m-mundos, #m-mundos *')) { const r = e.getBoundingClientRect(); if (!r.width) continue; if (r.left < -1 || r.right > W + 1) out.push((e.id || e.className.baseVal || e.className || e.tagName) + ' ' + Math.round(r.left) + '..' + Math.round(r.right)); }
    const m = document.querySelector('#menu'); if (m.scrollWidth > m.clientWidth + 1) out.push('menu rola de lado ' + m.scrollWidth + '>' + m.clientWidth);
    return [...new Set(out)].slice(0, 12);
  });
  await p.screenshot({ path: `${SAIDA}/mundos-${nome}.png` });
  await p.evaluate(() => document.querySelector('#menu').scrollTop = 1e5); await p.waitForTimeout(200);
  await p.screenshot({ path: `${SAIDA}/mundos-${nome}-fim.png` });
  if (fora.length || erros.length) falhou++;
  console.log(nome, fora.length ? JSON.stringify(fora) : 'cabe', erros.join(' | ') || 'sem erros');
  await ctx.close();
}
await b.close();
console.log(falhou ? 'FALHOU em ' + falhou : 'OK');
