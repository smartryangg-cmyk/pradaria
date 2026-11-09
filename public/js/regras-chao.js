// Itens no chão (drops): regras puras, sem tela. O jogo sem internet e a sala online usam as mesmas.
// Não importe nada daqui que dependa do navegador.
//
// Um item no chão: { i, id, n, x, y, z, v: [vx, vy, vz], t (quando caiu, ms), dono (quem largou, ou ''),
//   c (quantos são coisa comprada na loja: a marca vai junto, veja trabalho.js) }
// A física (cair, quicar, boiar) é só desenho no aparelho; quem decide quem pegou é a sala (ou o próprio jogo, sem internet).
import { guardavel, ULTIMO_ITEM } from './receitas.js';

export const VIDA_CHAO = 5 * 60 * 1000;   // some depois de 5 minutos no chão
export const MAX_CHAO = 200;              // por mundo; passando disso some o mais antigo
export const ESPERA_DONO = 1500;          // quem largou só pega de volta depois disso (dá tempo de o amigo pegar)
export const ESPERA_PEGAR = 350;          // ninguém pega no mesmo instante em que caiu (dá para ver pular)
export const MAX_LARGAR = 64;             // de uma vez
export const PERTO_SALA = 7;              // a sala aceita pegar até esta distância (a posição chega atrasada)

export const podeNoChao = (id, n) => guardavel(id) && id <= ULTIMO_ITEM && Number.isInteger(n) && n >= 1 && n <= MAX_LARGAR;
const arr = (v) => Math.round(v * 100) / 100;

// guarda os itens no chão de um mundo
export class Chao {
  constructor() { this.itens = new Map(); this.prox = 1; }

  novo(id, n, x, y, z, v = [0, 0, 0], dono = '', t = Date.now(), i = null, c = 0) {
    if (!podeNoChao(id, n) || ![x, y, z].every(Number.isFinite)) return null;
    const d = { i: i ?? this.prox++, id, n, x: arr(x), y: arr(y), z: arr(z), v: v.map((c) => arr(Math.max(-9, Math.min(9, Number(c) || 0)))), t, dono: String(dono || ''), c: Math.max(0, Math.min(n, c | 0)) };
    if (i != null) this.prox = Math.max(this.prox, i + 1);
    this.itens.set(d.i, d);
    return d;
  }
  tirar(i) { const d = this.itens.get(i); if (d) this.itens.delete(i); return d || null; }
  // os vencidos e os que passam do limite (mais antigos primeiro). Devolve os que saíram.
  limpar(agora = Date.now()) {
    const fora = [];
    for (const d of this.itens.values()) if (agora - d.t > VIDA_CHAO) fora.push(d);
    for (const d of fora) this.itens.delete(d.i);
    if (this.itens.size > MAX_CHAO) {
      const velhos = [...this.itens.values()].sort((a, b) => a.t - b.t).slice(0, this.itens.size - MAX_CHAO);
      for (const d of velhos) { this.itens.delete(d.i); fora.push(d); }
    }
    return fora;
  }
  lista() { return [...this.itens.values()]; }
}

// como o item vai para os outros: com a idade em vez da hora (o relógio de cada aparelho é diferente)
export const publico = (d, agora = Date.now()) => ({ i: d.i, id: d.id, n: d.n, x: d.x, y: d.y, z: d.z, v: d.v, idade: Math.max(0, agora - d.t), dono: d.dono, c: d.c || 0 });

// pode pegar? (quem largou espera um pouco; ninguém pega no mesmo instante)
export function podePegar(d, quem, agora = Date.now()) {
  const idade = agora - d.t;
  if (idade < ESPERA_PEGAR) return false;
  if (d.dono && d.dono === quem && idade < ESPERA_DONO) return false;
  return idade <= VIDA_CHAO;
}

// a sala confere a distância com folga (o item rola um pouco e a posição do jogador chega atrasada)
export function pertoParaPegar(d, p) {
  const dx = d.x - p[0], dz = d.z - p[2];
  return dx * dx + dz * dz <= PERTO_SALA * PERTO_SALA && Math.abs(d.y - p[1]) <= 40;
}
