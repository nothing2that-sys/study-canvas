/**
 * Math Canvas Pro - Web Audio API 기반 무외부 의존성 사운드 & 햅틱 엔진
 * 정답 화음(C-E-G), 오답 알림, 세션 완료 팡파르, 모바일 햅틱 피드백 지원
 */

let audioCtx = null;
let isSoundEnabled = true;

// 로컬 스토리지에서 사운드 설정 복원
if (typeof localStorage !== "undefined") {
  const saved = localStorage.getItem("math_canvas_sound_enabled");
  if (saved !== null) {
    isSoundEnabled = saved === "true";
  }
}

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isSoundMuted() {
  return !isSoundEnabled;
}

export function toggleSound() {
  isSoundEnabled = !isSoundEnabled;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("math_canvas_sound_enabled", String(isSoundEnabled));
  }
  if (isSoundEnabled) {
    playTone(523.25, 0.1, "sine"); // 켤 때 가벼운 비프음
  }
  return isSoundEnabled;
}

export function setSoundEnabled(enabled) {
  isSoundEnabled = Boolean(enabled);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("math_canvas_sound_enabled", String(isSoundEnabled));
  }
  return isSoundEnabled;
}

function playTone(freq, duration = 0.15, type = "sine", gainVal = 0.2, startTimeOffset = 0) {
  if (!isSoundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    ctx.resume().then(() => {
      _executeTone(ctx, freq, duration, type, gainVal, 0);
    }).catch(() => {});
    return;
  }

  _executeTone(ctx, freq, duration, type, gainVal, startTimeOffset);
}

function _executeTone(ctx, freq, duration, type, gainVal, startTimeOffset) {
  try {
    const now = ctx.currentTime + startTimeOffset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  } catch (e) {
    // 오디오 컨텍스트 에러 안전 무시
  }
}

// 1. 정답 채점 시: 경쾌한 C 메이저 화음 (도-미-솔: 523Hz -> 659Hz -> 784Hz)
export function playCorrectSound() {
  if (!isSoundEnabled) return;
  triggerHaptic("correct");
  playTone(523.25, 0.12, "sine", 0.22, 0.0);
  playTone(659.25, 0.12, "sine", 0.22, 0.08);
  playTone(783.99, 0.22, "sine", 0.26, 0.16);
}

// 2. 오답 채점 시: 부드러운 저음 알림 (미 -> 도: 329Hz -> 261Hz)
export function playWrongSound() {
  if (!isSoundEnabled) return;
  triggerHaptic("wrong");
  playTone(329.63, 0.14, "triangle", 0.22, 0.0);
  playTone(261.63, 0.25, "triangle", 0.25, 0.1);
}

// 3. 세션 완료 팡파르 (도-미-솔-높은도 화려한 멜로디)
export function playFanfareSound() {
  if (!isSoundEnabled) return;
  triggerHaptic("complete");
  const notes = [
    { f: 523.25, d: 0.12, o: 0.0 },
    { f: 659.25, d: 0.12, o: 0.1 },
    { f: 783.99, d: 0.14, o: 0.2 },
    { f: 1046.50, d: 0.35, o: 0.32 }
  ];
  notes.forEach((n) => {
    playTone(n.f, n.d, "triangle", 0.28, n.o);
  });
}

// 4. 가벼운 틱 클릭음
export function playClickSound() {
  if (!isSoundEnabled) return;
  playTone(800, 0.04, "sine", 0.08, 0.0);
}

// 5. 모바일/태블릿 햅틱 진동 피드백
export function triggerHaptic(type = "light") {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;

  try {
    if (type === "correct") {
      navigator.vibrate([30, 40, 30]); // 통통 2단 탭
    } else if (type === "wrong") {
      navigator.vibrate([80]); // 묵직한 1단 진동
    } else if (type === "complete") {
      navigator.vibrate([40, 50, 40, 50, 90]); // 축하 3단 탭
    } else {
      navigator.vibrate(20);
    }
  } catch (e) {
    // 햅틱 미지원 기기 안전 무시
  }
}
