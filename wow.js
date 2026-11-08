/* wow.js — the interaction layer: intro, cursor, headline split, scramble, marquee,
   timeline progress, parallax, copy-to-clipboard. Each block is independent and guarded. */
(function () {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const html = document.documentElement;

  /* ---------- intro curtain (first visit per session, home page only) ---------- */
  (function intro() {
    const el = $('#intro');
    if (!el) return;
    if (!html.classList.contains('intro-lock')) { el.remove(); return; }
    const word = $('#introWord');
    const txt = 'Rachapally Pavan Kumar.';
    word.setAttribute('aria-label', 'Rachapally Pavan Kumar');
    word.innerHTML = Array.from(txt).map((c, i) =>
      '<span style="--i:' + i + '"' + (c === '.' ? ' class="dot"' : '') + ' aria-hidden="true">' + (c === ' ' ? '&nbsp;' : c) + '</span>').join('');
    setTimeout(() => { el.classList.add('done'); html.classList.remove('hero-hold'); }, 1350);
    setTimeout(() => {
      html.classList.remove('intro-lock');
      el.remove();
      try { sessionStorage.setItem('introSeen', '1'); } catch (e) { /* private mode */ }
    }, 2400);
  })();

  /* ---------- shared page chrome: every page gets the aurora, grid and scroll-progress bar ---------- */
  (function chrome() {
    if (!$('.bg-aurora')) {
      const a = document.createElement('div'); a.className = 'bg-aurora'; a.setAttribute('aria-hidden', 'true');
      a.innerHTML = '<i></i><i></i><i></i>';
      document.body.insertBefore(a, document.body.firstChild);
    }
    if (!$('#progress')) {
      const bar = document.createElement('div'); bar.className = 'progress'; bar.id = 'progress';
      document.body.insertBefore(bar, document.body.firstChild);
      const upd = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
      };
      window.addEventListener('scroll', upd, { passive: true });
      upd();
    }
  })();

  /* ---------- hero headline: split into words that rise out of a mask ---------- */
  (function splitHeadline() {
    const h1 = $('.hero h1');
    if (!h1 || reduced) return;
    h1.classList.remove('enter', 'enter-2');
    let n = 0;
    const wrap = (node) => {
      const w = document.createElement('span'); w.className = 'w';
      const wi = document.createElement('span'); wi.className = 'wi'; wi.style.setProperty('--d', n++);
      w.appendChild(wi); wi.appendChild(node); return w;
    };
    Array.from(h1.childNodes).forEach((ch) => {
      if (ch.nodeType === 3) {
        const frag = document.createDocumentFragment();
        ch.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(' '));
          else frag.appendChild(wrap(document.createTextNode(part)));
        });
        ch.replaceWith(frag);
      } else if (ch.nodeName !== 'BR') {
        const holder = document.createComment('');
        ch.replaceWith(holder);
        holder.replaceWith(wrap(ch));
      }
    });
  })();

  /* ---------- custom cursor: dot + trailing ring that reacts to what it is over ---------- */
  (function cursor() {
    if (!fine || reduced) return;
    const dot = document.createElement('div'); dot.className = 'cur-dot';
    const ring = document.createElement('div'); ring.className = 'cur-ring';
    const label = document.createElement('span'); ring.appendChild(label);
    document.body.append(dot, ring);
    let mx = -100, my = -100, rx = -100, ry = -100, shown = false;
    const setState = (t) => {
      if (!t || !t.closest) return;
      const onPop = !!t.closest('.pop');
      const onCard = onPop || !!t.closest('#projects .card, #publications .card');
      const link = !!t.closest('a, button, .mq-row span, .rail-btn, .modal-close');
      ring.classList.toggle('card', onCard && !link && !onPop);
      ring.classList.toggle('hot', link || onPop);
      label.textContent = onCard && !link && !onPop ? 'Explore' : '';
    };
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      mx = e.clientX; my = e.clientY;
      if (!shown) {
        shown = true; rx = mx; ry = my;
        html.classList.add('cc'); dot.style.opacity = '1'; ring.style.opacity = '1';
      }
      setState(e.target);
    }, { passive: true });
    // panels grow under a still pointer, so re-check what is under it now and then
    setInterval(() => { if (shown) setState(document.elementFromPoint(mx, my)); }, 140);
    document.addEventListener('mouseleave', () => { dot.style.opacity = '0'; ring.style.opacity = '0'; shown = false; html.classList.remove('cc'); });
    (function loop() {
      requestAnimationFrame(loop);
      rx += (mx - rx) * 0.2; ry += (my - ry) * 0.2;
      dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
      ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
    })();
  })();

  /* ---------- section headings "decode" into place when they scroll in ---------- */
  (function scramble() {
    if (reduced || !('IntersectionObserver' in window)) return;
    const GLYPHS = '!<>-_\\/[]{}=+*^?#01';
    const run = (el) => {
      const finalText = el.textContent;
      if (!finalText.trim()) return;
      el.setAttribute('aria-label', finalText);
      const len = finalText.length, total = 24;
      let f = 0;
      const id = setInterval(() => {
        f++;
        let out = '';
        for (let i = 0; i < len; i++) {
          const c = finalText[i];
          if (c === ' ') out += ' ';
          else if (f > (i / len) * total * 0.7 + total * 0.3) out += c;
          else out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }
        el.textContent = out;
        if (f >= total + 4) { clearInterval(id); el.textContent = finalText; }
      }, 32);
    };
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { io.unobserve(e.target); run(e.target); }
    }), { threshold: 0.8 });
    $$('.section h2, .page h2').forEach((h) => io.observe(h));
  })();

  /* ---------- tech marquee: duplicate each row so the loop is seamless ---------- */
  $$('.mq-row').forEach((row) => {
    if (reduced) return;
    Array.from(row.children).forEach((c) => { const k = c.cloneNode(true); k.setAttribute('aria-hidden', 'true'); row.appendChild(k); });
  });

  /* ---------- timeline: scroll-driven progress line + lit dots ---------- */
  (function timeline() {
    const tl = $('.timeline');
    if (!tl) return;
    const items = $$('.t-item', tl);
    const update = () => {
      const r = tl.getBoundingClientRect(), vh = window.innerHeight, mark = vh * 0.62;
      tl.style.setProperty('--tp', Math.max(0, Math.min(1, (mark - r.top) / r.height)).toFixed(4));
      items.forEach((it) => it.classList.toggle('lit', it.getBoundingClientRect().top < mark));
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  })();

  /* ---------- hero parallax: copy drifts + fades, HUD floats up slower ---------- */
  (function parallax() {
    if (reduced) return;
    const copy = $('.hero-copy'), vis = $('.hero-visual');
    if (!copy || !vis) return;
    let ticking = false;
    const apply = () => {
      ticking = false;
      const y = window.scrollY, vh = window.innerHeight;
      if (y > vh * 1.2) return;
      copy.style.translate = '0 ' + (y * 0.12).toFixed(1) + 'px';
      copy.style.opacity = Math.max(0, 1 - y / (vh * 0.85)).toFixed(3);
      vis.style.translate = '0 ' + (-y * 0.07).toFixed(1) + 'px';
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(apply); } }, { passive: true });
  })();

  /* ---------- copy email ---------- */
  (function copy() {
    const btns = $$('[data-copy]');
    if (!btns.length) return;
    const toast = document.createElement('div'); toast.className = 'toast'; toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
    let t = 0;
    btns.forEach((b) => b.addEventListener('click', () => {
      const done = (msg) => { toast.textContent = msg; toast.classList.add('show'); clearTimeout(t); t = setTimeout(() => toast.classList.remove('show'), 1900); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(b.dataset.copy).then(() => done('Email copied to clipboard'), () => done(b.dataset.copy));
      else done(b.dataset.copy);
    }));
  })();
})();
