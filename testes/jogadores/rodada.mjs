// Rodada de jogadores-robô: cada roteiro roda em cada aparelho pedido, vários ao mesmo tempo.
// Uso: node testes/jogadores/rodada.mjs [roteiro[:aparelho,aparelho]] ...
//   ex.: node testes/jogadores/rodada.mjs sobrevivente:pc,tablet caos:tablet-lento online
// Variáveis: BASE (site; padrão localhost:8788), SAIDA (pasta dos prints e do bugs.md), JUNTOS (quantos ao mesmo
// tempo, padrão 2), SEMENTE (repete a mesma bagunça do caos), ESTADO (pasta --persist-to do servidor local).
import { Jogador, fecharNavegador, salvarRelatorio, bugsAchados, SAIDA } from './base.mjs';
import fs from 'fs';
import { execSync } from 'child_process';
const PADRAO = { sobrevivente: ['pc', 'tablet'], fisica: ['pc', 'tablet'], online: ['multi'], caos: ['tablet-lento', 'celular'], tabuleiros: ['multi'] };
const pedidos = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(PADRAO);
const tarefas = [];
for (const ped of pedidos) {
  const [nome, ap] = ped.split(':');
  const aparelhos = ap ? ap.split(',') : PADRAO[nome] || ['pc'];
  const mod = (await import(`./roteiros/${nome}.mjs`)).default;
  for (const a of aparelhos) tarefas.push({ nome, a, mod });
}
const JUNTOS = +process.env.JUNTOS || 2;
let i = 0, nomes = ['Ana', 'Beto', 'Caio', 'Duda', 'Edu', 'Fabi', 'Gui', 'Hana', 'Ivo', 'Juca'];
async function trabalhador() {
  while (i < tarefas.length) {
    const t = tarefas[i++];
    const quem = nomes[i % nomes.length] + i;
    const ini = Date.now();
    // servidor local: zera o limite de contas por hora (como o rodar-todos.sh), senão os jogadores não criam conta
    if (process.env.ESTADO) try { execSync(`npx wrangler d1 execute pradaria-db --local --persist-to ${process.env.ESTADO} --command "DELETE FROM tentativas"`, { stdio: 'ignore' }); } catch {}
    console.log(`>>> ${t.nome} no ${t.a} (${quem})`);
    let j = null;
    try {
      if (t.a === 'multi') await t.mod(quem); // roteiro que abre seus próprios jogadores
      else { j = await new Jogador(quem, t.a, t.nome).abrir(); await t.mod(j); await j.semErros('no fim do roteiro'); }
    } catch (e) {
      console.log(`!!! ${t.nome}/${t.a} parou: ${e.message.split('\n')[0]}`);
      if (j) await j.bug(`o roteiro ${t.nome} travou: ${e.message.split('\n')[0].slice(0, 160)}`, { tipo: 'travou' });
    }
    if (j) await j.fechar();
    console.log(`<<< ${t.nome} no ${t.a} em ${Math.round((Date.now() - ini) / 1000)} s`);
  }
}
await Promise.all(Array.from({ length: JUNTOS }, trabalhador));
await fecharNavegador();
const md = salvarRelatorio(pedidos.join(' '));
console.log(`\n${bugsAchados().length} bugs. Relatório: ${SAIDA}/bugs.md`);
fs.writeFileSync(SAIDA + '/resumo.txt', md);
process.exit(0);
