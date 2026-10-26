/* 4ormop sounds - original Web Audio sounds, no audio files.
   pop()     : every checkbox / pad / step ticked on
   levelUp() : a whole thing finished (last step of a move, last pad of the day,
               last Today task, a Space reaching 5/5 or being sent)
   Sound on/off is remembered per browser (localStorage key 4orm_sound, default on). */
(function () {
  let AC = null;
  const VOL = 0.6;
  const ac = () => AC || (AC = new (window.AudioContext || window.webkitAudioContext)());
  const on = () => { try { return localStorage.getItem('4orm_sound') !== 'off'; } catch (e) { return true; } };
  function tone(f, t0, d, type, g, f2) {
    const c = ac(), o = c.createOscillator(), a = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, c.currentTime + t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, c.currentTime + t0 + d);
    a.gain.setValueAtTime(0, c.currentTime + t0);
    a.gain.linearRampToValueAtTime((g || .2) * VOL, c.currentTime + t0 + .005);
    a.gain.exponentialRampToValueAtTime(.0001, c.currentTime + t0 + d);
    o.connect(a).connect(c.destination);
    o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + d + .02);
  }
  const S = {
    pop() { if (!on()) return; tone(300, 0, .12, 'sine', .35, 900); },
    levelUp() {
      if (!on()) return;
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .09, .16, 'square', .14));
      tone(1319, .38, .45, 'square', .14); tone(1047, .38, .45, 'triangle', .1);
    },
    isOn: on,
    toggle() { try { localStorage.setItem('4orm_sound', on() ? 'off' : 'on'); } catch (e) {} return on(); }
  };
  window.FourmSound = S;
})();

/* Auto-wiring: pop when anything gets ticked on; level up when a whole group is finished.
   Groups: move steps (.stp), Today list (.exec.today), Space next steps (#todo),
   note checklists (.note), Playbook pads for today (.pad.due -> none left). */
(function () {
  const S = window.FourmSound;
  const DONE = '.task.d, .cb.on, .stp .s.d, .td.d, .pad.done, .ck.done, .ck.on';
  const GROUPS = [
    ['.stp', '.s', '.s.d'],
    ['.exec.today .tl', '.task', '.task.d, .task:has(.cb.on)'],
    ['#todo', '.td', '.td.d'],
    ['.note', '.ck', '.ck.done, .ck.on']
  ];
  const full = () => {
    const r = [];
    GROUPS.forEach(([g, all, done]) => document.querySelectorAll(g).forEach(el => {
      const a = el.querySelectorAll(all).length, d = el.querySelectorAll(done).length;
      r.push(a > 0 && a === d);
    }));
    r.push(document.querySelectorAll('.pad.due').length === 0 && document.querySelectorAll('.pad').length > 0);
    return r;
  };
  document.addEventListener('click', e => {
    if (e.target.closest('.sndtog')) return;
    const b = document.querySelectorAll(DONE).length, f0 = full(), due0 = document.querySelectorAll('.pad.due').length;
    setTimeout(() => {
      const a = document.querySelectorAll(DONE).length, f1 = full(), due1 = document.querySelectorAll('.pad.due').length;
      const ticked = a > b || due1 < due0;
      if (!ticked) return;
      const finished = f1.some((v, i) => v && !f0[i]);
      const now = Date.now();
      if (finished) { if (now - (window.__lvl || 0) < 600) return; window.__lvl = now; window.__snd = now; S.levelUp(); }
      else { if (now - (window.__snd || 0) < 250) return; window.__snd = now; S.pop(); }
    }, 60);
  }, true);
  const addToggle = () => {
    const r = document.querySelector('.top .r');
    if (!r || r.querySelector('.sndtog')) return;
    const b = document.createElement('button');
    b.className = 'tb sndtog';
    const paint = () => { b.textContent = S.isOn() ? 'Sound on' : 'Sound off'; };
    paint();
    b.onclick = () => { S.toggle(); paint(); if (S.isOn()) S.pop(); };
    r.insertBefore(b, r.querySelector('.clock'));
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', addToggle) : addToggle();
})();

/* Shadow-root walk so pop/level-up hear desks inside attachShadow. */
(function () {
  const S = window.FourmSound;
  if (!S) return;
  const DONE = '.task.d, .cb.on, .stp .s.d, .td.d, .pad.done, .ck.done, .ck.on';
  const GROUPS = [
    ['.stp', '.s', '.s.d'],
    ['.exec.today .tl', '.task', '.task.d, .task:has(.cb.on)'],
    ['#todo', '.td', '.td.d'],
    ['.note', '.ck', '.ck.done, .ck.on']
  ];
  function all(sel) {
    const out = [];
    const walk = (root) => {
      try { out.push.apply(out, root.querySelectorAll(sel)); } catch (e) {}
      try { root.querySelectorAll('*').forEach((el) => { if (el.shadowRoot) walk(el.shadowRoot); }); } catch (e) {}
    };
    walk(document);
    return out;
  }
  const full = () => {
    const r = [];
    GROUPS.forEach(([g, every, done]) => all(g).forEach(el => {
      const a = el.querySelectorAll(every).length, d = el.querySelectorAll(done).length;
      r.push(a > 0 && a === d);
    }));
    r.push(all('.pad.due').length === 0 && all('.pad').length > 0);
    return r;
  };
  document.addEventListener('click', e => {
    if (e.target.closest && e.target.closest('.sndtog')) return;
    const b = all(DONE).length, f0 = full(), due0 = all('.pad.due').length;
    setTimeout(() => {
      const a = all(DONE).length, f1 = full(), due1 = all('.pad.due').length;
      const ticked = a > b || due1 < due0;
      if (!ticked) return;
      const finished = f1.some((v, i) => v && !f0[i]);
      const now = Date.now();
      if (finished) { if (now - (window.__lvl || 0) < 600) return; window.__lvl = now; window.__snd = now; S.levelUp(); }
      else { if (now - (window.__snd || 0) < 250) return; window.__snd = now; S.pop(); }
    }, 60);
  }, true);
})();
