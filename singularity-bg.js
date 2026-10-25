import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

/* VELOX / SHORTY.MEMORY — cybernetic black-hole ambience
   Decorative background only: no app state, auth, database, or terminal hooks. */
(() => {
  "use strict";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const canvas = document.createElement("canvas");
  canvas.className = "shorty-singularity";
  canvas.setAttribute("aria-hidden", "true");
  canvas.setAttribute("role", "presentation");
  Object.assign(canvas.style, {
    position: "fixed", inset: "0", width: "100%", height: "100%",
    display: "block", pointerEvents: "none", zIndex: "0", opacity: ".72"
  });
  document.body.prepend(canvas);

  let renderer, scene, camera, disk, photonRing, stars, jetA, jetB;
  let raf = 0, width = 1, height = 1, scrollProgress = 0;
  let targetX = 0, targetY = 0, pointerX = 0, pointerY = 0;
  const clock = { elapsed: 0, last: 0 };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  try {
    renderer = new THREE.WebGLRenderer({
      canvas, alpha: true, antialias: !coarsePointer, powerPreference: "low-power"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarsePointer ? 1.25 : 1.6));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, .1, 100);
    camera.position.set(0, 0.2, 15.8);
    camera.lookAt(0, 0, 0);

    const root = new THREE.Group();
    scene.add(root);

    // Sparse stars sit behind the event horizon; deliberately subdued so text stays readable.
    const starPositions = [], starColors = [], starSizes = [];
    const starCount = coarsePointer ? 420 : 780;
    for (let i = 0; i < starCount; i++) {
      const spread = 30;
      starPositions.push((Math.random() - .5) * spread, (Math.random() - .5) * spread, -5 - Math.random() * 22);
      const tint = Math.random();
      starColors.push(tint > .82 ? .55 : .34, tint > .82 ? .88 : .66, tint > .82 ? 1 : .78);
      starSizes.push(Math.random() * 1.25 + .3);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    starGeo.setAttribute("color", new THREE.Float32BufferAttribute(starColors, 3));
    starGeo.setAttribute("size", new THREE.Float32BufferAttribute(starSizes, 1));
    const starMat = new THREE.PointsMaterial({
      size: coarsePointer ? .045 : .055, vertexColors: true, transparent: true,
      opacity: .55, depthWrite: false, sizeAttenuation: true
    });
    stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // The accretion disk is a custom shader: radial falloff + turbulent angular bands.
    const diskGeo = new THREE.RingGeometry(1.18, 4.65, 192, 8);
    const diskMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uScroll: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPos;
        void main() {
          vUv = uv;
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vPos;
        uniform float uTime;
        uniform float uScroll;
        void main() {
          vec2 p = vPos.xy;
          float r = length(p);
          float a = atan(p.y, p.x);
          float bands = sin(a * 17.0 - uTime * 1.4 + r * 5.5 + sin(a * 7.0 + uTime) * .8);
          float turbulence = sin(a * 31.0 + r * 8.0 - uTime * 2.0) * .5 + .5;
          float inner = smoothstep(1.15, 1.55, r);
          float outer = 1.0 - smoothstep(3.5, 4.7, r);
          float filament = .45 + .3 * bands + .25 * turbulence;
          float alpha = inner * outer * filament * (.43 + .12 * sin(uTime + a * 4.0));
          vec3 hot = vec3(0.38, 0.95, 1.0);
          vec3 gold = vec3(0.75, 0.98, 0.42);
          vec3 color = mix(gold, hot, smoothstep(1.45, 4.0, r) * .72);
          color *= 1.0 + .22 * bands + .14 * uScroll;
          gl_FragColor = vec4(color, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    });
    disk = new THREE.Mesh(diskGeo, diskMat);
    disk.rotation.x = 1.12;
    disk.rotation.z = -.22;
    root.add(disk);

    // Event horizon and a thin cyan photon ring.
    const hole = new THREE.Mesh(
      new THREE.SphereGeometry(1.12, 64, 48),
      new THREE.MeshBasicMaterial({ color: 0x010207 })
    );
    root.add(hole);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(1.2, .035, 10, 160),
      new THREE.MeshBasicMaterial({ color: 0x9bf6ff, transparent: true, opacity: .72 })
    );
    rim.rotation.x = 1.12;
    rim.rotation.z = -.22;
    root.add(rim);
    photonRing = rim;

    // Very faint relativistic jets, intentionally restrained for use behind UI.
    const jetMat = new THREE.MeshBasicMaterial({
      color: 0x7deeff, transparent: true, opacity: .14,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    jetA = new THREE.Mesh(new THREE.ConeGeometry(.28, 4.6, 24, 1, true), jetMat);
    jetB = new THREE.Mesh(new THREE.ConeGeometry(.28, 4.6, 24, 1, true), jetMat.clone());
    jetA.position.y = 3.55; jetB.position.y = -3.55;
    jetB.rotation.z = Math.PI;
    root.add(jetA, jetB);

    // Slow halo rings create depth without adding post-processing or a heavy render pipeline.
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x3adfff, transparent: true, opacity: .075,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const halo = new THREE.Mesh(new THREE.TorusGeometry(4.8, .012, 6, 180), haloMat);
    halo.rotation.x = 1.12;
    halo.rotation.z = -.22;
    root.add(halo);

    function resize() {
      width = window.innerWidth; height = window.innerHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.fov = width < 700 ? 50 : 42;
      camera.position.z = width < 700 ? 18.5 : 15.8;
      camera.updateProjectionMatrix();
    }
    function onScroll() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollProgress = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
      if (reduceMotion) render(performance.now());
    }
    function onPointer(e) {
      targetX = (e.clientX / Math.max(1, width) - .5) * 2;
      targetY = (e.clientY / Math.max(1, height) - .5) * 2;
      if (reduceMotion) render(performance.now());
    }
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    if (!coarsePointer) window.addEventListener("pointermove", onPointer, { passive: true });
    onScroll();

    function render(now) {
      if (!reduceMotion) raf = requestAnimationFrame(render);
      if (document.hidden) return;
      const delta = Math.min(.05, clock.last ? (now - clock.last) / 1000 : .016);
      clock.last = now;
      if (!reduceMotion) clock.elapsed += delta;
      const t = clock.elapsed;
      pointerX += (targetX - pointerX) * .035;
      pointerY += (targetY - pointerY) * .035;
      root.rotation.y = (reduceMotion ? 0 : t * .018) + pointerX * .075 + scrollProgress * .42;
      root.rotation.x = -.06 + pointerY * .045 + scrollProgress * .07;
      disk.rotation.z = -.22 + (reduceMotion ? 0 : t * .025) + scrollProgress * .75;
      disk.material.uniforms.uTime.value = t;
      disk.material.uniforms.uScroll.value = scrollProgress;
      photonRing.rotation.z = -.22 + (reduceMotion ? 0 : t * .025) + scrollProgress * .75;
      stars.rotation.z = scrollProgress * .045 + pointerX * .008;
      camera.position.x += (pointerX * .32 - camera.position.x) * .025;
      camera.position.y += ((-.12 - pointerY * .22 + scrollProgress * .38) - camera.position.y) * .025;
      camera.lookAt(0, 0, 0);
      if (jetA && !reduceMotion) {
        jetA.material.opacity = .11 + Math.sin(t * 1.4) * .025;
        jetB.material.opacity = .10 + Math.sin(t * 1.1 + 1.5) * .025;
      }
      renderer.render(scene, camera);
    }
    if (reduceMotion) {
      // Scroll and pointer still update the scene, but no perpetual animation runs.
      render(performance.now());
    } else {
      raf = requestAnimationFrame(render);
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && raf) cancelAnimationFrame(raf);
      else if (!document.hidden && !reduceMotion) { clock.last = 0; raf = requestAnimationFrame(render); }
      else if (!document.hidden && reduceMotion) render(performance.now());
    });
  } catch (error) {
    // If WebGL/CDN is unavailable, leave the existing interface fully functional.
    canvas.remove();
    console.warn("[Shorty Singularity] WebGL background unavailable; continuing without it.", error);
  }
})();
