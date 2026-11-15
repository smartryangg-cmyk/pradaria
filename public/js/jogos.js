// Lista de jogos da plataforma (tela "Escolha um jogo", hub.js).
// pronto: false = aparece como "Em breve". idade16: pede "16 anos ou mais?" antes de abrir (idade.js).
// abrir: 'pradaria' = a tela de mundos deste mesmo site; uma página (ex.: '/xadrez', o Pages tira o .html) = o jogo em outra página.
export const JOGOS = [
  { id: 'pradaria', nome: 'Pradaria', desc: 'Construa, explore e cuide dos bichos', icone: 'bloco', cor: '#5cbf4a', cor2: '#3a8a2c', pronto: true, abrir: 'pradaria', selos: ['Online', 'Sem internet'] },
  { id: 'xadrez', nome: 'Xadrez', desc: 'Contra um amigo ou contra o computador', icone: 'xadrez', cor: '#7b6cf0', cor2: '#4d3fbf', pronto: true, abrir: '/xadrez', selos: ['Online', 'Computador'] },
  { id: 'dama', nome: 'Dama', desc: 'Pule as peças do outro e vire dama', icone: 'dama', cor: '#e0525a', cor2: '#a8303a', pronto: true, abrir: '/dama', selos: ['Online', 'Computador'] },
  { id: 'truco', nome: 'Truco', desc: 'Truco paulista em dupla ou contra o computador', icone: 'carta', cor: '#3f9b5c', cor2: '#256b3c', pronto: true, abrir: '/truco', selos: ['Online'] },
  { id: 'arena', nome: 'Arena', desc: 'Tiro em equipe em mapas pequenos', icone: 'mira', cor: '#f07a3c', cor2: '#b9501c', pronto: false, abrir: '/arena', idade16: true, selos: ['Online'] },
  { id: 'ilha', nome: 'Última Ilha', desc: 'Todos contra todos até sobrar um', icone: 'ilha', cor: '#2fb3c4', cor2: '#1c7f8c', pronto: false, abrir: '/ultima-ilha', idade16: true, selos: ['Online'] },
];
export const jogo = (id) => JOGOS.find((j) => j.id === id) || null;
