/**
 * Math Canvas Pro - 순수 HTML5 캔버스 기반 60fps 축하 컨페티(Confetti) 파티클 엔진
 * 세션 완료 및 고득점 달성 시 화려한 리본 파티클 시뮬레이션
 */

const COLORS = ["#e47b4f", "#173f35", "#f0c95f", "#2e7d32", "#3b82f6", "#ec4899", "#8b5cf6"];

export function launchConfetti(canvasElement, options = {}) {
  if (!canvasElement) return () => {};

  const ctx = canvasElement.getContext("2d");
  if (!ctx) return () => {};

  const particleCount = options.particleCount || 100;
  const durationMs = options.durationMs || 3500;

  // 캔버스 크기 맞춤
  const rect = canvasElement.getBoundingClientRect();
  const width = rect.width || window.innerWidth;
  const height = rect.height || window.innerHeight;
  canvasElement.width = width;
  canvasElement.height = height;

  const particles = [];
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: width * 0.5 + (Math.random() - 0.5) * 120,
      y: height * 0.35 + (Math.random() - 0.5) * 60,
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.8) * 14,
      size: Math.random() * 8 + 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      opacity: 1,
      gravity: 0.38,
      drag: 0.96
    });
  }

  let animationFrameId = null;
  const startTime = Date.now();

  function render() {
    const elapsed = Date.now() - startTime;
    if (elapsed > durationMs) {
      ctx.clearRect(0, 0, width, height);
      return;
    }

    ctx.clearRect(0, 0, width, height);

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.rotation += p.rotationSpeed;

      if (elapsed > durationMs * 0.65) {
        p.opacity = Math.max(0, 1 - (elapsed - durationMs * 0.65) / (durationMs * 0.35));
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    });

    if (typeof requestAnimationFrame === "function") {
      animationFrameId = requestAnimationFrame(render);
    } else {
      animationFrameId = setTimeout(render, 16);
    }
  }

  render();

  return () => {
    if (animationFrameId) {
      if (typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(animationFrameId);
      } else {
        clearTimeout(animationFrameId);
      }
    }
    ctx.clearRect(0, 0, width, height);
  };
}
