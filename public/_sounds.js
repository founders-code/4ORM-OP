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
    pop() { window.__snd = Date.now(); if (!on()) return; tone(300, 0, .12, 'sine', .35, 900); },
    levelUp() {
      window.__snd = window.__lvl = Date.now();
      if (!on()) return;
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .09, .16, 'square', .14));
      tone(1319, .38, .45, 'square', .14); tone(1047, .38, .45, 'triangle', .1);
    },
    isOn: on,
    toggle() { try { localStorage.setItem('4orm_sound', on() ? 'off' : 'on'); } catch (e) {} return on(); }
  };
  window.FourmSound = S;
})();

/* Sound on / off toggle in the top bar. Clicks go through desk-actions.js
   'sound-toggle' (data-action), so it is never stamped "coming soon". */
(function () {
  const S = window.FourmSound;
  const addToggle = () => {
    const r = document.querySelector('.top .r');
    if (!r || r.querySelector('.sndtog')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tb sndtog';
    b.setAttribute('data-action', 'sound-toggle');
    b.textContent = S.isOn() ? 'Sound on' : 'Sound off';
    r.insertBefore(b, r.querySelector('.clock'));
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', addToggle) : addToggle();
})();

/* The one click watcher (walks shadow roots). Real handlers also call
   FourmSound.pop()/levelUp() directly; those stamp window.__snd so this
   fallback stays quiet instead of playing a second sound. */
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
    const t0 = Date.now();
    setTimeout(() => {
      if ((window.__snd || 0) >= t0) return;
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
