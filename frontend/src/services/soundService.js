// soundService.js — Gera sons via Web Audio API sem depender de URLs externas
// Funciona em todos os navegadores modernos e PWAs.

let globalAudioCtx = null;
let customAudios = {
  ding: null,
  cash: null,
  cancel: null
};

export const initAudio = () => {
  if (!globalAudioCtx) {
    try {
      globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('AudioContext not supported');
    }
  }
  if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume();
  }
};

export const loadCustomAudios = (urls) => {
  if (urls?.dingUrl) customAudios.ding = new Audio(urls.dingUrl);
  if (urls?.cashUrl) customAudios.cash = new Audio(urls.cashUrl);
  if (urls?.cancelUrl) customAudios.cancel = new Audio(urls.cancelUrl);
};

const getAudioContext = () => {
  initAudio();
  return globalAudioCtx;
};

/**
 * Som de "Ding" — toque suave de sino
 * Usado quando a pessoa gera o QR Code / reserva os números
 */
export const playDing = () => {
  if (customAudios.ding) {
    customAudios.ding.currentTime = 0;
    customAudios.ding.play().catch(e => console.warn('Audio play failed:', e));
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  const frequencies = [880, 1100, 1320];
  frequencies.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    const start = ctx.currentTime + i * 0.12;
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, start + 0.4);

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.35, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);

    osc.start(start);
    osc.stop(start + 0.5);
  });
};

/**
 * Som de "Ka-ching!" — caixa registradora
 * Usado quando o pagamento é confirmado
 */
export const playCashRegister = () => {
  if (customAudios.cash) {
    customAudios.cash.currentTime = 0;
    customAudios.cash.play().catch(e => console.warn('Audio play failed:', e));
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  // Click metálico inicial
  const bufferSize = ctx.sampleRate * 0.05;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.4, ctx.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
  noise.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(ctx.currentTime);

  // Sequência de tons ascendentes (Ka-ching!)
  const notes = [
    { freq: 600, start: 0.05, dur: 0.1 },
    { freq: 900, start: 0.15, dur: 0.12 },
    { freq: 1400, start: 0.28, dur: 0.25 },
  ];

  notes.forEach(({ freq, start, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    const t = ctx.currentTime + start;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  });
};

export const playCancel = () => {
  if (customAudios.cancel) {
    customAudios.cancel.currentTime = 0;
    customAudios.cancel.play().catch(e => console.warn('Audio play failed:', e));
    return;
  }
  
  const ctx = getAudioContext();
  if (!ctx) return;
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.5);
  
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.5);
};
