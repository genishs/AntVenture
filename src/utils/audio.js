// --- Web Audio API (남극탐험 BGM 구현) ---
let audioCtx;
let nextNoteTime = 0;
let beatCount = 0;
let schedulerTimer;
let isPlaying = false;

const tempo = 150;
const secondsPer16th = 15.0 / tempo;

const NOTES = {
    'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
    'C3': 130.81,
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77
};

const introMelody = [
    'G4', 'A4', 'B4', 'C5', null, null, null, null,
    null, null, null, null, null, null, null, null
];

const mainMelody = [
    'E5', null, null, null, null, null, null, null, 'G5', null, null, null,
    'E5', null, null, null, 'D5', null, null, null, 'C5', null, null, null,
    'C5', null, null, null, null, null, null, null, 'D5', null, null, null,
    'E5', null, null, null, 'D5', null, null, null, null, null, null, null,
    'E5', null, null, null, null, null, null, null, 'G5', null, null, null,
    'E5', null, null, null, 'D5', null, null, null, 'C5', null, null, null,
    'C5', null, null, null, null, null, null, null, 'E5', null, null, null,
    'D5', null, null, null, null, null, null, null, null, null, null, null,
    'D5', null, null, null, null, null, null, null, 'E5', null, null, null,
    'F5', null, null, null, 'E5', null, null, null, 'D5', null, null, null,
    'D5', null, null, null, null, null, null, null, 'E5', null, null, null,
    'F5', null, null, null, null, null, null, null, null, null, null, null,
    'E5', null, null, null, null, null, null, null, 'F5', null, null, null,
    'G5', null, null, null, 'F5', null, null, null, 'E5', null, null, null,
    'E5', null, null, null, null, null, null, null, 'D5', null, null, null,
    'C5', null, null, null, null, null, null, null, null, null, null, null
];

export function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

export function playTone(freq, type, duration, time, vol = 0.1) {
    if (!audioCtx) initAudio();
    if (!freq) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(time);
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.8);
    osc.stop(time + duration);
}

function scheduleNote(time) {
    if (beatCount < introMelody.length) {
        const note = introMelody[beatCount];
        if (note && NOTES[note]) playTone(NOTES[note], 'square', 0.1, time, 0.15);
        if (beatCount === 3) playTone(NOTES['C3'], 'triangle', 0.5, time, 0.2);
    } else {
        const loopTick = beatCount - introMelody.length;
        const currentLoopTick = loopTick % mainMelody.length;
        const melodyNote = mainMelody[currentLoopTick];
        if (melodyNote && NOTES[melodyNote]) playTone(NOTES[melodyNote], 'square', secondsPer16th * 3, time, 0.15);

        const measureTick = currentLoopTick % 12;
        const measureIndex = Math.floor(currentLoopTick / 12);
        const chordProgression = ['C', 'C', 'C', 'G', 'C', 'C', 'C', 'G', 'G', 'G', 'G', 'G', 'C', 'C', 'G', 'C'];
        const currentChord = chordProgression[measureIndex % 16] || 'C';
        let rootFreq = NOTES['C3'];
        let chordFreqs = [NOTES['E4'], NOTES['G4']];
        if (currentChord === 'G') {
            rootFreq = NOTES['G3'];
            chordFreqs = [NOTES['B3'], NOTES['D4'], NOTES['F4']];
        }
        if (measureTick === 0) playTone(rootFreq, 'triangle', 0.3, time, 0.2);
        else if (measureTick === 4 || measureTick === 8) chordFreqs.forEach(f => playTone(f, 'sawtooth', 0.1, time, 0.05));
    }
    beatCount++;
}

function audioScheduler() {
    if (!isPlaying) return;
    
    // audioCtx가 없거나 닫혀있으면 중단
    if (!audioCtx || audioCtx.state === 'closed') return;

    while (nextNoteTime < audioCtx.currentTime + 0.1) {
        scheduleNote(nextNoteTime);
        nextNoteTime += secondsPer16th;
    }
    schedulerTimer = requestAnimationFrame(audioScheduler);
}

export function startBgm() {
    initAudio();
    isPlaying = true;
    nextNoteTime = audioCtx.currentTime + 0.1;
    beatCount = 0;
    audioScheduler();
}

export function stopBgm() {
    isPlaying = false;
    if (schedulerTimer) cancelAnimationFrame(schedulerTimer);
    
    // 게임 오버 사운드
    if(audioCtx) {
        playTone(NOTES['G4'], 'sawtooth', 0.1, audioCtx.currentTime, 0.2);
        playTone(NOTES['E4'], 'sawtooth', 0.1, audioCtx.currentTime + 0.1, 0.2);
        playTone(NOTES['C4'], 'sawtooth', 0.4, audioCtx.currentTime + 0.2, 0.2);
    }
}

export function playJumpSound() {
    if(audioCtx) playTone(600, 'sine', 0.1, audioCtx.currentTime, 0.1);
}

export function getAudioContext() {
    return audioCtx;
}