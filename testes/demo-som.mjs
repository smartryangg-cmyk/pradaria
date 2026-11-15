// Grava uma amostra para ouvir (não é teste): passos, blocos, bichos, motor, convite, xadrez e música.
// Precisa do `npm run dev` rodando. Saída: $SAIDA/demo-som.webm
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import { writeFileSync } from 'fs';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.goto((process.env.BASE || 'http://localhost:8788') + '/xadrez.html');
const b64 = await p.evaluate(async () => {
  const { Som } = await import('/js/som.js');
  const s = new Som(); s.iniciar(); s.configurar({ musica: 0.8, efeitos: 1 });
  const dest = s.ctx.createMediaStreamDestination(); s.comp.connect(dest);
  const rec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus' }); const partes = []; rec.ondataavailable = (e) => partes.push(e.data); rec.start(500);
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  s.ouvinte(0, 0, 0, 0);
  for (const m of ['grama', 'terra', 'pedra', 'madeira', 'areia', 'neve', 'agua']) { for (let i = 0; i < 4; i++) { s.passo(m); await espera(330); } await espera(250); }
  for (const m of ['terra', 'pedra', 'madeira', 'vidro', 'folhas', 'metal', 'tecido']) { s.bater(m); await espera(350); s.quebrar(m); await espera(550); s.colocar(m); await espera(500); }
  for (const t of ['muu', 'bee', 'oinc', 'cocó', 'auau', 'pi', 'veado', 'urso']) { s.em({ x: Math.random() * 10 - 5, y: 0, z: -4 }, () => s.bicho(t)); await espera(1200); }
  s.em({ x: -20, y: 0, z: -10 }, () => s.bicho('uivo'), 90); await espera(2600);
  for (let i = 0; i <= 60; i++) { s.motor(Math.min(1, i / 45), 1, 'motor'); await espera(100); }
  for (let i = 60; i >= 0; i--) { s.motor(i / 60, 1, 'motor'); await espera(40); }
  s.motor(null); await espera(400);
  s.splash(0.7); await espera(900); s.abrir(); await espera(500); s.fechar(); await espera(500); s.convite(); await espera(1300);
  s.peca(); await espera(500); s.peca(true); await espera(500); s.xeque(); await espera(600); s.fim('ganhou'); await espera(1400);
  for (let k = 0; k < 2; k++) { s.passarinho(); await espera(700); }
  s.mus = { prox: s.ctx.currentTime, compasso: 0, frase: 0, nota: 2 };
  const t0 = performance.now();
  while (performance.now() - t0 < 12000) { s.ambiente({ dt: 0.1, dia: 1, vento: 0.8, agua: 0.4, arvores: 0.6, coberto: false, altura: 50, pausado: false }); await espera(100); }
  await new Promise((ok) => { rec.onstop = ok; rec.stop(); });
  const ab = await new Blob(partes).arrayBuffer(); let str = ''; const u = new Uint8Array(ab); for (let i = 0; i < u.length; i++) str += String.fromCharCode(u[i]); return btoa(str);
});
writeFileSync(`${SAIDA}/demo-som.webm`, Buffer.from(b64, 'base64'));
console.log('ok', Math.round(b64.length * 0.75 / 1024), 'KB');
await b.close();
