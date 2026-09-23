// Subtle scroll-reveal for cards and sections.
(function () {
  const els = document.querySelectorAll('.card, .section h2, .about-grid, .pipe-step, .gesture');
  els.forEach((el) => el.classList.add('reveal'));
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
    }),
    { threshold: 0.12 }
  );
  els.forEach((el) => io.observe(el));
})();
