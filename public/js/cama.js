// Deitar na cama (tocar nela): de noite, a tela escurece e o dia amanhece.
// Sozinho, amanhece na hora; online, só quando todo mundo do mundo está dormindo (a sala conta).
// Andar ou pular levanta da cama.
import { podeDormir, ACORDA, ehCama } from './dormir-regras.js';

const por = (jog, x, y, z) => { jog.pos.x = x; jog.pos.y = y; jog.pos.z = z; jog.vel.x = jog.vel.y = jog.vel.z = 0; };

export function criarCama(j) {
  // j: { jog, aviso, som, dia(), definirDia(v), cicloDia(), sala(), mundo(), comIcone }
  const tela = document.getElementById('sono'), txt = document.getElementById('sono-txt');
  let deitado = null, timer = 0;

  function mostrar(sim, texto) {
    tela.hidden = false;
    if (texto != null) txt.innerHTML = texto;
    requestAnimationFrame(() => tela.classList.toggle('mostra', sim));
    if (!sim) setTimeout(() => { if (!deitado) tela.hidden = true; }, 900);
  }

  function deitar(h) {
    if (deitado) return true;
    if (!j.cicloDia()) { j.aviso('Neste mundo é sempre dia: não precisa dormir', 2200, 'sol'); return true; }
    if (!podeDormir(j.dia())) { j.aviso('Só dá para dormir de noite (depois do pôr do sol)', 2200, 'lua'); return true; }
    const jog = j.jog();
    deitado = { x: h.x, y: h.y, z: h.z, ate: 0 };
    por(jog, h.x + 0.5, h.y + 0.6, h.z + 0.5);
    mostrar(true, j.comIcone('lua', 'Dormindo...'));
    const sala = j.sala();
    if (sala) sala.enviar({ t: 'dormir', b: [h.x, h.y, h.z] });
    else timer = 2.6; // sozinho: amanhece depois que a tela escurece
    return true;
  }

  function levantar(aviso) {
    if (!deitado) return;
    const jog = j.jog(), d = deitado;
    deitado = null; timer = 0;
    por(jog, d.x + 0.5, d.y + 1.02, d.z + 0.5);
    mostrar(false);
    if (aviso) j.aviso(aviso, 2000, 'sol');
  }

  function bomDia() {
    j.definirDia(ACORDA);
    levantar('Bom dia!');
  }

  return {
    get deitado() { return !!deitado; },
    deitar,
    // a cada quadro: deitado, o jogador fica parado na cama; andar/pular levanta. true = não mexer o jogador
    quadro(dt, ent) {
      if (!deitado) return false;
      if ((ent && (ent.frente || ent.lado || ent.pular)) || !ehCama(j.mundo().bloco(deitado.x, deitado.y, deitado.z))) {
        const sala = j.sala();
        levantar();
        if (sala) sala.enviar({ t: 'acordar' });
        return false;
      }
      const jog = j.jog();
      por(jog, deitado.x + 0.5, deitado.y + 0.6, deitado.z + 0.5);
      if (timer > 0 && (timer -= dt) <= 0) bomDia();
      return true;
    },
    sair() { deitado = null; timer = 0; tela.classList.remove('mostra'); tela.hidden = true; },
    rede: {
      sono: (m) => {
        const falta = m.total - m.n;
        if (deitado) txt.innerHTML = j.comIcone('lua', falta > 0 ? `Dormindo... esperando ${falta === 1 ? 'mais 1 pessoa' : `mais ${falta} pessoas`} deitar (${m.n} de ${m.total})` : 'Dormindo...');
        else if (m.nome && m.deitou) j.aviso(`${m.nome} foi dormir (${m.n} de ${m.total}). Deite numa cama para a noite passar`, 2600, 'lua');
      },
      'sono-erro': (m) => { levantar(); j.aviso(m.msg || 'Não deu para dormir', 2200, 'lua'); },
    },
    // a sala mudou a hora porque todo mundo dormiu
    dormiram() { if (deitado) levantar('Bom dia!'); else j.aviso('Todo mundo dormiu: bom dia!', 2000, 'sol'); },
  };
}
