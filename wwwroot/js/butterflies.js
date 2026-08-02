(function () {
  const canvas = document.getElementById('butterflies');
  const ctx = canvas.getContext('2d');
  let W, H, dpr;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // Cursor / pointer position (also used for touch)
  let pointer = { x: W / 2, y: H / 2, active: false };
  let hasInteracted = false;

  window.addEventListener('mousemove', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    hasInteracted = true;
  });
  window.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0]) {
      pointer.x = e.touches[0].clientX;
      pointer.y = e.touches[0].clientY;
      hasInteracted = true;
    }
  }, { passive: true });

  // palette built from the requested colors, paired as (light wing tip, deep wing base)
  const COLORS = [
    ['#F0B454', '#DD8A34'],
    ['#7EA1EA', '#2B3A5C'],
    ['#F0B454', '#9B7FD6'],
    ['#E8E39D', '#2B3A5C'],
    ['#7EA1EA', '#9B7FD6'],
    ['#9B7FD6', '#DD8A34'],
    ['#E8E39D', '#7EA1EA']
  ];

  const COUNT = 7;
  const butterflies = [];

  function rand(min, max) { return Math.random() * (max - min) + min; }

  for (let i = 0; i < COUNT; i++) {
    butterflies.push({
      x: rand(0, W),
      y: rand(0, H),
      vx: rand(-1, 1),
      vy: rand(-1, 1),
      angle: rand(0, Math.PI * 2),
      wingPhase: rand(0, Math.PI * 2),
      wingSpeed: rand(0.18, 0.28),
      size: rand(14, 22),
      colorSet: COLORS[i % COLORS.length],
      // each butterfly follows the cursor with its own offset & lag,
      // so the group flows behind rather than snapping to a single point
      followOffsetX: rand(-70, 70),
      followOffsetY: rand(-50, 50),
      followDelay: rand(0.02, 0.06),
      wanderAngle: rand(0, Math.PI * 2),
      wanderSpeed: rand(0.01, 0.03),
      floatSeed: rand(0, 1000)
    });
  }

  let t = 0;

  function drawButterfly(b) {
    // asymmetric flap: quick downstroke, slower upstroke, like a real wingbeat
    const raw = Math.sin(b.wingPhase);
    const eased = raw >= 0 ? Math.pow(raw, 0.6) : -Math.pow(-raw, 1.4);
    const flap = eased * 0.5 + 0.5; // 0..1
    const wingScaleX = 0.25 + flap * 0.75;

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);

    const [c1, c2] = b.colorSet;
    const s = b.size;

    ctx.shadowColor = 'rgba(58, 63, 77, 0.25)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = s * 0.15;

    // wing drawing helper (mirrored for left/right), body runs along local Y axis
    function wing(sign) {
      ctx.save();
      // wings hinge near the body and fold toward it as they flap closed
      ctx.scale(wingScaleX * sign, 1);

      const grad = ctx.createLinearGradient(0, -s * 0.9, s * 0.75, s * 0.5);
      grad.addColorStop(0, c1);
      grad.addColorStop(0.55, c2);
      grad.addColorStop(1, c1);
      ctx.globalAlpha = 0.92;

      // forewing (upper, larger, pointed tip)
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.08);
      ctx.bezierCurveTo(s * 0.1, -s * 0.75, s * 0.55, -s * 0.95, s * 0.8, -s * 0.55);
      ctx.bezierCurveTo(s * 0.95, -s * 0.3, s * 0.7, -s * 0.05, s * 0.42, s * 0.02);
      ctx.bezierCurveTo(s * 0.22, s * 0.05, s * 0.08, 0, 0, -s * 0.08);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // forewing vein lines for texture
      ctx.strokeStyle = 'rgba(58, 63, 77, 0.35)';
      ctx.lineWidth = s * 0.02;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.06);
        ctx.quadraticCurveTo(s * 0.35 * i / 3, -s * 0.55 * i / 3 - s * 0.1, s * 0.75 * i / 3, -s * 0.3 * i / 3);
        ctx.stroke();
      }

      // hindwing (lower, rounder, smaller, with a soft tail lobe)
      ctx.beginPath();
      ctx.moveTo(0, s * 0.0);
      ctx.bezierCurveTo(s * 0.08, s * 0.35, s * 0.55, s * 0.55, s * 0.5, s * 0.2);
      ctx.bezierCurveTo(s * 0.48, s * 0.45, s * 0.3, s * 0.62, s * 0.18, s * 0.42);
      ctx.bezierCurveTo(s * 0.08, s * 0.28, s * 0.05, s * 0.12, 0, s * 0.0);
      ctx.closePath();
      const grad2 = ctx.createLinearGradient(0, 0, s * 0.5, s * 0.5);
      grad2.addColorStop(0, c2);
      grad2.addColorStop(1, c1);
      ctx.fillStyle = grad2;
      ctx.fill();

      // small eyespot / accent marking near hindwing tip
      ctx.beginPath();
      ctx.arc(s * 0.35, s * 0.28, s * 0.045, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(58, 63, 77, 0.55)';
      ctx.fill();

      // outer wing edge, slightly darker
      ctx.strokeStyle = 'rgba(58, 63, 77, 0.3)';
      ctx.lineWidth = s * 0.025;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.08);
      ctx.bezierCurveTo(s * 0.1, -s * 0.75, s * 0.55, -s * 0.95, s * 0.8, -s * 0.55);
      ctx.bezierCurveTo(s * 0.95, -s * 0.3, s * 0.7, -s * 0.05, s * 0.42, s * 0.02);
      ctx.stroke();

      ctx.restore();
    }

    wing(1);
    wing(-1);

    ctx.shadowColor = 'transparent';

    // body: head, thorax, abdomen as soft dark capsule
    const bodyGrad = ctx.createLinearGradient(0, -s * 0.4, 0, s * 0.5);
    bodyGrad.addColorStop(0, '#241B38');
    bodyGrad.addColorStop(1, '#3D3252');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, s * 0.05, s * 0.06, s * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // head
    ctx.beginPath();
    ctx.arc(0, -s * 0.42, s * 0.07, 0, Math.PI * 2);
    ctx.fill();

    // antennae
    ctx.strokeStyle = '#241B38';
    ctx.lineWidth = s * 0.02;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.46);
    ctx.quadraticCurveTo(-s * 0.12, -s * 0.62, -s * 0.18, -s * 0.72);
    ctx.moveTo(0, -s * 0.46);
    ctx.quadraticCurveTo(s * 0.12, -s * 0.62, s * 0.18, -s * 0.72);
    ctx.stroke();
    ctx.fillStyle = '#241B38';
    ctx.beginPath();
    ctx.arc(-s * 0.18, -s * 0.72, s * 0.025, 0, Math.PI * 2);
    ctx.arc(s * 0.18, -s * 0.72, s * 0.025, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function step() {
    t += 1;
    ctx.clearRect(0, 0, W, H);

    for (const b of butterflies) {
      let targetX, targetY;

      if (hasInteracted) {
        targetX = pointer.x + b.followOffsetX;
        targetY = pointer.y + b.followOffsetY;
      } else {
        b.wanderAngle += b.wanderSpeed;
        targetX = W / 2 + Math.cos(b.wanderAngle + b.floatSeed) * (W * 0.25);
        targetY = H / 2 + Math.sin(b.wanderAngle * 1.3 + b.floatSeed) * (H * 0.2);
      }

      const dx = targetX - b.x;
      const dy = targetY - b.y;

      b.vx += dx * b.followDelay * 0.02;
      b.vy += dy * b.followDelay * 0.02;

      b.vx += Math.sin(t * 0.02 + b.floatSeed) * 0.03;
      b.vy += Math.cos(t * 0.017 + b.floatSeed) * 0.03;

      b.vx *= 0.94;
      b.vy *= 0.94;

      const speed = Math.hypot(b.vx, b.vy);
      const maxSpeed = 4.2;
      if (speed > maxSpeed) {
        b.vx = (b.vx / speed) * maxSpeed;
        b.vy = (b.vy / speed) * maxSpeed;
      }

      b.x += b.vx;
      b.y += b.vy;

      if (speed > 0.05) {
        const targetAngle = Math.atan2(b.vy, b.vx) + Math.PI / 2;
        let diff = targetAngle - b.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        b.angle += diff * 0.08;
      }

      const margin = 40;
      if (b.x < -margin) b.x = W + margin;
      if (b.x > W + margin) b.x = -margin;
      if (b.y < -margin) b.y = H + margin;
      if (b.y > H + margin) b.y = -margin;

      b.wingPhase += b.wingSpeed;

      drawButterfly(b);
    }

    requestAnimationFrame(step);
  }

  step();
})();
