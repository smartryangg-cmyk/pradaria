// Controles: teclado + mouse no computador, joystick e toques no tablet/celular.
export class Controles {
  constructor(canvas, jog, cb) {
    this.canvas = canvas; this.jog = jog; this.cb = cb;
    this.teclas = new Set();
    this.estado = { frente: 0, lado: 0, pular: false, descer: false, correr: false };
    this.toque = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.travado = false;
    this.joy = null; // {id, x0, y0, dx, dy}
    this.olhar = null; // {id, x, y, t0, x0, y0, moveu}
    this.botaoPular = false; this.botaoDescer = false;
    this.ultimoEspaco = 0;
    this.sensToque = 0.0055;
    this.ativo = true;
    this.teclado(); this.mouse(); this.toques();
  }

  teclado() {
    addEventListener('keydown', (e) => {
      if (!this.ativo || e.target.tagName === 'INPUT') return;
      const k = e.code;
      if (k === 'Space') {
        e.preventDefault();
        if (!e.repeat) {
          const ag = performance.now();
          // na água o espaço é para nadar para cima (apertar várias vezes não liga o voo)
          if (ag - this.ultimoEspaco < 300 && !(this.jog && this.jog.naAgua)) this.cb.alternarVoo();
          this.ultimoEspaco = ag;
        }
      }
      if (/^Digit[1-9]$/.test(k)) this.cb.slot(+k.slice(5) - 1);
      if (k === 'KeyE') this.cb.inventario();
      if (k === 'KeyF') this.cb.alternarVoo();
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
      if (e.button === 0) {
        // cada clique arranca um pedaço; segurando, continua batendo
        this.cb.quebrar(null);
        clearInterval(this.timerMouse);
        this.timerMouse = setInterval(() => this.travado && this.ativo && this.cb.quebrar(null), 260);
      }
      if (e.button === 2) this.cb.usar(null);
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) clearInterval(this.timerMouse); });
    addEventListener('blur', () => clearInterval(this.timerMouse));
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      clearInterval(this.timerMouse);
      this.travado = document.pointerLockElement === c;
      this.cb.travaMudou && this.cb.travaMudou(this.travado);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.travado) return;
      this.girar(e.movementX * 0.0024, e.movementY * 0.0024);
    });
    addEventListener('wheel', (e) => { if (this.travado) this.cb.rolar(Math.sign(e.deltaY)); }, { passive: true });
  }

  girar(dx, dy) {
    this.jog.yaw -= dx;
    this.jog.pitch = Math.max(-1.55, Math.min(1.55, this.jog.pitch - dy));
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
          clearTimeout(this.timerSegurar);
          this.timerSegurar = setTimeout(() => this.segurar(), 380);
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
          if (Math.hypot(o.x - o.x0, o.y - o.y0) > 12) { o.moveu = true; if (!o.quebrando) clearTimeout(this.timerSegurar); }
          if (!o.quebrando) this.girar(dx * this.sensToque, dy * this.sensToque);
        }
      }
    }, { passive: false });
    const fim = (e) => {
      for (const t of e.changedTouches) {
        if (this.joy && t.identifier === this.joy.id) { this.joy = null; joyEl.style.display = 'none'; }
        else if (this.olhar && t.identifier === this.olhar.id) {
          const o = this.olhar;
          clearTimeout(this.timerSegurar); clearInterval(this.timerQuebra);
          if (!o.moveu && !o.quebrando && performance.now() - o.t0 < 380) this.cb.usar({ x: o.x, y: o.y });
          this.olhar = null;
          this.cb.mira && this.cb.mira(null);
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
    segurarBotao('bt-descer', 'botaoDescer');
  }

  // segurar o dedo parado = quebrar bloco (repete enquanto segura)
  segurar() {
    const o = this.olhar;
    if (!o || o.moveu) return;
    o.quebrando = true;
    const q = () => this.olhar === o && this.cb.quebrar({ x: o.x, y: o.y });
    this.cb.mira && this.cb.mira({ x: o.x, y: o.y });
    q();
    this.timerQuebra = setInterval(q, 260);
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
    s.descer = t.has('ShiftLeft') || t.has('ShiftRight') || this.botaoDescer;
    s.correr = t.has('ControlLeft') || (this.joy && Math.hypot(this.joy.dx, this.joy.dy) > 0.97);
    return s;
  }
}
