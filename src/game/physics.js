export const GRAVITY = 0.42;
export const MAX_FALL = 9;

const ov = (e, s) => e.x < s.x + s.w && e.x + e.w > s.x && e.y < s.y + s.h && e.y + e.h > s.y;

// Move um corpo com colisão contra blocos sólidos e plataformas de mão única.
export function moveBody(e, map, gravity = true) {
  if (gravity) e.vy = Math.min(MAX_FALL, e.vy + GRAVITY);

  e.x += e.vx;
  e.hitWall = 0;
  if (e.x < 0) { e.x = 0; e.hitWall = -1; }
  else if (e.x + e.w > map.width) { e.x = map.width - e.w; e.hitWall = 1; }
  for (const s of map.solids) {
    if (!ov(e, s)) continue;
    if (e.vx > 0) { e.x = s.x - e.w; e.hitWall = 1; }
    else if (e.vx < 0) { e.x = s.x + s.w; e.hitWall = -1; }
  }

  const prevBottom = e.y + e.h;
  e.y += e.vy;
  e.onGround = false;
  for (const s of map.solids) {
    if (!ov(e, s)) continue;
    if (e.vy > 0) { e.y = s.y - e.h; e.onGround = true; }
    else if (e.vy < 0) { e.y = s.y + s.h; }
    e.vy = 0;
  }
  if (e.vy >= 0 && !(e.dropTimer > 0)) {
    for (const p of map.platforms) {
      if (e.x + e.w > p.x && e.x < p.x + p.w && prevBottom <= p.y + 0.5 && e.y + e.h >= p.y) {
        e.y = p.y - e.h; e.vy = 0; e.onGround = true;
      }
    }
  }
}

// Existe chão sob o ponto (x, y)? Usado para inimigos não caírem de beiradas.
export function groundAt(map, x, y) {
  for (const s of map.solids) if (x >= s.x && x <= s.x + s.w && y >= s.y - 2 && y <= s.y + 6) return true;
  for (const p of map.platforms) if (x >= p.x && x <= p.x + p.w && y >= p.y - 2 && y <= p.y + 6) return true;
  return false;
}

export function onPlatformOnly(e, map) {
  const by = e.y + e.h;
  return map.platforms.some((p) => e.x + e.w > p.x && e.x < p.x + p.w && Math.abs(by - p.y) < 1);
}

export function groundYBelow(map, x, fromY = 0) {
  let best = Infinity;
  for (const s of map.solids) if (x >= s.x && x <= s.x + s.w && s.y >= fromY) best = Math.min(best, s.y);
  return best === Infinity ? 300 : best;
}
