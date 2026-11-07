export interface DojoAudio {
  setEnabled(on: boolean): void;
  resume(): void;
  blip(freq: number, ms: number, type?: OscillatorType): void;
  launch(): void;
  dodge(): void;
  closeCall(): void;
  over(): void;
  saved(): void;
}

export function createAudio(): DojoAudio {
  let ctx: AudioContext | null = null;
  let enabled = false;

  function context() {
    if (!ctx) {
      const Ctx = window.AudioContext;
      ctx = new Ctx();
    }
    return ctx;
  }

  function blip(freq: number, ms: number, type: OscillatorType = "square") {
    if (!enabled) return;
    const audio = context();
    if (audio.state === "suspended") void audio.resume();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.05, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + ms / 1000);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + ms / 1000);
  }

  return {
    setEnabled(on: boolean) {
      enabled = on;
      if (on) void context().resume();
    },
    resume() {
      if (ctx && ctx.state === "suspended") void ctx.resume();
    },
    blip,
    launch() {
      blip(220, 90);
      setTimeout(() => blip(330, 90), 90);
      setTimeout(() => blip(440, 120), 180);
    },
    dodge() {
      blip(660, 50);
    },
    closeCall() {
      blip(880, 40);
      setTimeout(() => blip(990, 50), 40);
    },
    over() {
      blip(196, 180, "sawtooth");
      setTimeout(() => blip(130, 280, "sawtooth"), 160);
    },
    saved() {
      blip(523, 80);
      setTimeout(() => blip(659, 100), 80);
    },
  };
}
