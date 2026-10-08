// Sonido procedural con WebAudio: sin archivos, todo sintetizado.
let ctx = null;
let master = null;

export function ensureAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch { /* sin audio */ }
}

function noiseBuffer(seconds = 1) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

let _noise = null;
function playNoise({ dur = 0.3, from = 2000, to = 400, vol = 0.4, attack = 0.005 }) {
  if (!ctx) return;
  _noise ??= noiseBuffer(1);
  const src = ctx.createBufferSource();
  src.buffer = _noise;
  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.setValueAtTime(from, ctx.currentTime);
  filt.frequency.exponentialRampToValueAtTime(Math.max(40, to), ctx.currentTime + dur);
  filt.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(vol, ctx.currentTime + attack);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  src.connect(filt).connect(g).connect(master);
  src.start();
  src.stop(ctx.currentTime + dur + 0.05);
}

function playTone({ freq = 200, to = null, dur = 0.2, type = 'sine', vol = 0.3 }) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(30, to), ctx.currentTime + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g).connect(master);
  o.start();
  o.stop(ctx.currentTime + dur + 0.05);
}

export const sfx = {
  slash()      { playNoise({ dur: 0.16, from: 5000, to: 1200, vol: 0.5 }); },
  slashHit()   { playNoise({ dur: 0.22, from: 3000, to: 300, vol: 0.6 });
                 playTone({ freq: 180, to: 60, dur: 0.18, type: 'square', vol: 0.25 }); },
  kill()       { playNoise({ dur: 0.8, from: 1200, to: 80, vol: 0.7 });
                 playTone({ freq: 90, to: 35, dur: 0.7, type: 'sawtooth', vol: 0.4 }); },
  hook()       { playNoise({ dur: 0.25, from: 900, to: 4500, vol: 0.45 });
                 playTone({ freq: 700, to: 1800, dur: 0.12, type: 'triangle', vol: 0.2 }); },
  gasJet()     { playNoise({ dur: 0.45, from: 600, to: 1500, vol: 0.35 }); },
  dash()       { playNoise({ dur: 0.3, from: 400, to: 2400, vol: 0.45 }); },
  roar()       { playTone({ freq: 70, to: 45, dur: 1.1, type: 'sawtooth', vol: 0.5 });
                 playTone({ freq: 110, to: 60, dur: 0.9, type: 'square', vol: 0.25 });
                 playNoise({ dur: 1.0, from: 300, to: 100, vol: 0.3 }); },
  thud()       { playTone({ freq: 70, to: 30, dur: 0.35, type: 'sine', vol: 0.6 });
                 playNoise({ dur: 0.25, from: 200, to: 60, vol: 0.4 }); },
  bigThud()    { playTone({ freq: 55, to: 22, dur: 0.9, type: 'sine', vol: 0.9 });
                 playNoise({ dur: 0.7, from: 150, to: 40, vol: 0.6 }); },
  hurt()       { playTone({ freq: 300, to: 90, dur: 0.3, type: 'square', vol: 0.4 }); },
  grab()       { playTone({ freq: 150, to: 280, dur: 0.5, type: 'sawtooth', vol: 0.4 }); },
  pickup()     { playTone({ freq: 600, to: 1200, dur: 0.18, type: 'triangle', vol: 0.3 });
                 playTone({ freq: 900, to: 1800, dur: 0.22, type: 'sine', vol: 0.2 }); },
  alarm()      { playTone({ freq: 520, dur: 0.4, type: 'square', vol: 0.25 });
                 setTimeout(() => playTone({ freq: 440, dur: 0.5, type: 'square', vol: 0.25 }), 280); },
  ui()         { playTone({ freq: 440, to: 660, dur: 0.08, type: 'triangle', vol: 0.15 }); },
};

let _stepCd = 0;
export function stepSound(dt, speed) {
  if (!ctx) return;
  _stepCd -= dt * speed;
  if (_stepCd <= 0) {
    _stepCd = 3.2;
    playNoise({ dur: 0.07, from: 300, to: 120, vol: 0.12 });
  }
}
