// Controles: teclado + mouse no computador, joystick e toques no tablet/celular.
export class Controles {
  constructor(canvas, cam, cb) {
    this.canvas = canvas; this.cam = cam; this.cb = cb;
    this.teclas = new Set();
    this.estado = { frente: 0, lado: 0, pular: false, correr: false };
    this.toque = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.travado = false;
    this.joy = null; // {id, x0, y0, dx, dy}
    this.olhar = null; // {id, x, y, t0, x0, y0, moveu}
    this.botaoPular = false;
    this.sensToque = 0.0055;
    this.ativo = true;
    this.teclado(); this.mouse(); this.toques();
  }

  teclado() {
    addEventListener('keydown', (e) => {
      if (!this.ativo || e.target.tagName === 'INPUT') return;
      const k = e.code;
      if (k === 'Space') e.preventDefault();
      if (!e.repeat && (k === 'KeyE' || k === 'KeyF')) this.cb.entrarSair();
      if (!e.repeat && k === 'KeyH') this.cb.buzina();
      this.teclas.add(k);
    });
    addEventListener('keyup', (e) => this.teclas.delete(e.code));
    addEventListener('blur', () => this.teclas.clear());
  }

  mouse() {
    const c = this.canvas;
    c.addEventListener('mousedown', (e) => {
      if (this.toque || !this.ativo) return;
      if (!this.travado) { c.requestPointerLock && c.requestPointerLock(); return; }
      if (e.button === 0 || e.button === 2) this.cb.usar(null);
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.travado = document.pointerLockElement === c;
      this.cb.travaMudou && this.cb.travaMudou(this.travado);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.travado) return;
      this.girar(e.movementX * 0.003, e.movementY * 0.003);
    });
    addEventListener('wheel', (e) => { if (this.ativo) this.cb.zoom(Math.sign(e.deltaY)); }, { passive: true });
  }

  girar(dx, dy) {
    this.cam.yaw -= dx;
    this.cam.pitch = Math.max(-0.25, Math.min(1.25, this.cam.pitch + dy));
  }

  toques() {
    const c = this.canvas;
    const joyEl = document.getElementById('joy'), pino = document.getElementById('joy-pino');
    const RAIO = 55;
    c.addEventListener('touchstart', (e) => {
      if (!this.ativo) return;
      e.preventDefault();
      this.cb.primeiroToque && this.cb.primeiroToque();
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.42 && !this.joy) {
          this.joy = { id: t.identifier, x0: t.clientX, y0: t.clientY, dx: 0, dy: 0 };
          joyEl.style.display = 'block';
          joyEl.style.left = t.clientX + 'px'; joyEl.style.top = t.clientY + 'px';
          pino.style.transform = 'translate(-50%,-50%)';
        } else if (!this.olhar) {
          this.olhar = { id: t.identifier, x: t.clientX, y: t.clientY, x0: t.clientX, y0: t.clientY, t0: performance.now(), moveu: false, quebrando: false };
        }
      }
    }, { passive: false });
    c.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this.joy && t.identifier === this.joy.id) {
          let dx = t.clientX - this.joy.x0, dy = t.clientY - this.joy.y0;
          const d = Math.hypot(dx, dy);
          if (d > RAIO) { dx *= RAIO / d; dy *= RAIO / d; }
          this.joy.dx = dx / RAIO; this.joy.dy = dy / RAIO;
          pino.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        } else if (this.olhar && t.identifier === this.olhar.id) {
          const o = this.olhar;
          const dx = t.clientX - o.x, dy = t.clientY - o.y;
          o.x = t.clientX; o.y = t.clientY;
          if (Math.hypot(o.x - o.x0, o.y - o.y0) > 12) o.moveu = true;
          this.girar(dx * this.sensToque, dy * this.sensToque);
        }
      }
    }, { passive: false });
    const fim = (e) => {
      for (const t of e.changedTouches) {
        if (this.joy && t.identifier === this.joy.id) { this.joy = null; joyEl.style.display = 'none'; }
        else if (this.olhar && t.identifier === this.olhar.id) {
          const o = this.olhar;
          if (!o.moveu && performance.now() - o.t0 < 400) this.cb.usar({ x: o.x, y: o.y });
          this.olhar = null;
        }
      }
    };
    c.addEventListener('touchend', fim);
    c.addEventListener('touchcancel', fim);

    // botões
    const segurarBotao = (id, campo) => {
      const el = document.getElementById(id);
      if (!el) return;
      const on = (e) => { e.preventDefault(); e.stopPropagation(); this[campo] = true; el.classList.add('ativo'); };
      const off = (e) => { e.preventDefault(); this[campo] = false; el.classList.remove('ativo'); };
      el.addEventListener('touchstart', on, { passive: false });
      el.addEventListener('touchend', off); el.addEventListener('touchcancel', off);
      el.addEventListener('mousedown', on); el.addEventListener('mouseup', off); el.addEventListener('mouseleave', off);
    };
    segurarBotao('bt-pular', 'botaoPular');
    
  }

  atualizar() {
    const t = this.teclas, s = this.estado;
    let f = 0, l = 0;
    if (t.has('KeyW') || t.has('ArrowUp')) f += 1;
    if (t.has('KeyS') || t.has('ArrowDown')) f -= 1;
    if (t.has('KeyD') || t.has('ArrowRight')) l += 1;
    if (t.has('KeyA') || t.has('ArrowLeft')) l -= 1;
    if (this.joy) { f -= this.joy.dy; l += this.joy.dx; }
    s.frente = f; s.lado = l;
    s.pular = t.has('Space') || this.botaoPular;
    s.correr = t.has('ShiftLeft') || t.has('ShiftRight') || (this.joy && Math.hypot(this.joy.dx, this.joy.dy) > 0.95);
    return s;
  }
}
