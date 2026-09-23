// Subtle scroll-reveal for cards and sections, with per-card stagger.
(function () {
  const els = document.querySelectorAll('.card, .section h2, .about-grid, .pipe-step, .gesture');
  els.forEach((el) => {
    el.classList.add('reveal');
    // stagger siblings inside the same parent
    const sibs = Array.from(el.parentElement.children).filter((s) => s.matches('.card, .pipe-step, .gesture'));
    const i = sibs.indexOf(el);
    if (i > 0) el.style.transitionDelay = `${Math.min(i, 4) * 90}ms`;
  });
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
    }),
    { threshold: 0.12 }
  );
  els.forEach((el) => io.observe(el));

  // Nav shadow once the page scrolls.
  const nav = document.querySelector('.nav');
  const onScroll = () => nav && nav.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
