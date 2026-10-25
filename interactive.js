/* Shorty OS — original interactive motion layer inspired by immersive 3D web craft.
   No external assets or tracking. Lightweight, touch-friendly, reduced-motion aware. */
(() => {
  "use strict";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

  // Ambient particle field: original procedural stars, not a copied site asset.
  const canvas = document.createElement("canvas");
  canvas.className = "shorty-universe";
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed", inset: "0", width: "100%", height: "100%",
    pointerEvents: "none", zIndex: "1", opacity: ".68"
  });
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d", { alpha: true });
  let w = 0, h = 0, dpr = 1, stars = [], raf = 0;
  const count = () => Math.min(150, Math.floor((w * h) / 10500));
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: count() }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() * 1.6 + .45, a: Math.random() * .52 + .16,
      phase: Math.random() * Math.PI * 2, speed: Math.random() * .006 + .002
    }));
    draw();
  }
  let tick = 0;
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    // Ambient color blooms add depth without obscuring the existing interface.
    const glow = ctx.createRadialGradient(w * .78, h * .18, 0, w * .78, h * .18, Math.max(w, h) * .62);
    glow.addColorStop(0, "rgba(122,158,65,.055)");
    glow.addColorStop(1, "rgba(122,158,65,0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    for (const s of stars) {
      const twinkle = reduceMotion ? 1 : .65 + .35 * Math.sin(tick * s.speed + s.phase);
      ctx.globalAlpha = s.a * twinkle;
      ctx.fillStyle = "#d7f6a0";
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (!reduceMotion) { tick++; raf = requestAnimationFrame(draw); }
  }
  if (ctx) {
    resize();
    window.addEventListener("resize", resize, { passive: true });
    if (reduceMotion) cancelAnimationFrame(raf);
  }

  // Cursor-following light and depth tilt on selected cards, desktop only.
  if (!coarsePointer && !reduceMotion) {
    const glow = document.createElement("div");
    glow.className = "shorty-cursor-glow";
    glow.setAttribute("aria-hidden", "true");
    document.body.append(glow);
    let mx = -300, my = -300, gx = mx, gy = my;
    Object.assign(glow.style, {
      position: "fixed", left: "0", top: "0", width: "320px", height: "320px",
      marginLeft: "-160px", marginTop: "-160px", borderRadius: "50%",
      pointerEvents: "none", zIndex: "1",
      background: "radial-gradient(circle, rgba(200,241,105,.065), rgba(200,241,105,0) 68%)",
      willChange: "transform"
    });
    function moveGlow() {
      gx += (mx - gx) * .14; gy += (my - gy) * .14;
      glow.style.transform = `translate3d(${gx}px,${gy}px,0)`;
      requestAnimationFrame(moveGlow);
    }
    window.addEventListener("pointermove", e => { mx = e.clientX; my = e.clientY; }, { passive: true });
    moveGlow();

    document.addEventListener("pointermove", e => {
      const card = e.target.closest(".terminal-window, .panel, .stat-card, .memory-item, .person-row, .movie-card");
      if (!card || card.closest(".hidden")) return;
      const rect = card.getBoundingClientRect();
      if (rect.width > 720 || rect.height > 620) return;
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      card.style.setProperty("--pointer-x", (px * 100) + "%");
      card.style.setProperty("--pointer-y", (py * 100) + "%");
      if (card.classList.contains("memory-item") || card.classList.contains("stat-card") || card.classList.contains("movie-card")) {
        card.style.transform = `perspective(900px) rotateX(${(0.5-py)*2.2}deg) rotateY(${(px-0.5)*2.2}deg) translateY(-2px)`;
      }
    }, { passive: true });
    document.addEventListener("pointerout", e => {
      const card = e.target.closest(".memory-item, .stat-card, .movie-card");
      if (card && !card.contains(e.relatedTarget)) card.style.transform = "";
    }, { passive: true });
  }

  // Scroll progress indicator; works with both the landing page and dashboard.
  const progress = document.createElement("div");
  progress.className = "shorty-scroll-progress";
  progress.setAttribute("aria-hidden", "true");
  document.body.append(progress);
  Object.assign(progress.style, {
    position: "fixed", top: "0", left: "0", height: "2px", width: "100%",
    transform: "scaleX(0)", transformOrigin: "0 50%", zIndex: "30",
    background: "linear-gradient(90deg, #8ca64b, #c8f169, #d9ffa0)",
    opacity: ".8", pointerEvents: "none"
  });
  let scrollQueued = false;
  function updateProgress() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    scrollQueued = false;
  }
  window.addEventListener("scroll", () => {
    if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(updateProgress); }
  }, { passive: true });

  // Small reveal animation for newly rendered dashboard content, including SPA view changes.
  const reveal = () => {
    const root = document.querySelector("#viewRoot");
    if (!root) return;
    root.querySelectorAll(":scope > *, .panel, .stat-card, .memory-item, .person-row").forEach((el, i) => {
      if (el.dataset.shortyReveal === "1") return;
      el.dataset.shortyReveal = "1";
      el.style.setProperty("--shorty-delay", Math.min(i * 45, 270) + "ms");
      el.classList.add("shorty-reveal");
      if (reduceMotion) el.classList.add("shorty-revealed");
    });
  };
  reveal();
  const root = document.querySelector("#viewRoot");
  if (root) new MutationObserver(() => requestAnimationFrame(reveal)).observe(root, { childList: true, subtree: true });

  // Keyboard-friendly ambient effect toggle: press "v" to reduce visual effects.
  document.addEventListener("keydown", e => {
    if (e.key.toLowerCase() !== "v" || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) return;
    document.body.classList.toggle("shorty-visuals-muted");
  });
})();