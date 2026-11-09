// Worker que pinta uma parte do atlas de texturas (os tiles da lista) fora da tela.
import { pintarAtlas } from './texturas.js';

self.onmessage = (e) => {
  const { id, T, lista } = e.data;
  const dados = pintarAtlas(T, lista);
  self.postMessage({ id, T, lista, dados }, [dados.buffer]);
};
