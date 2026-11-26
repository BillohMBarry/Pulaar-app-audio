export const TARGET_SAMPLE_RATE = 16_000;
export const TARGET_CHANNELS = 1;

const RMS_WINDOW_MS = 10;
const RMS_WINDOW_SAMPLES = (RMS_WINDOW_MS / 1000) * TARGET_SAMPLE_RATE; // 160 samples
const SAFETY_BUFFER_SECONDS = 0.3;
const SAFETY_BUFFER_SAMPLES = Math.round(
  SAFETY_BUFFER_SECONDS * TARGET_SAMPLE_RATE
); // 4,800 samples
const FADE_DURATION_SECONDS = 0.005;
const FADE_SAMPLES = Math.round(FADE_DURATION_SECONDS * TARGET_SAMPLE_RATE); // 80 samples
const MIN_TRIMMED_DURATION_SECONDS = 0.5;
const MIN_TRIMMED_SAMPLES = Math.round(
  MIN_TRIMMED_DURATION_SECONDS * TARGET_SAMPLE_RATE
); // 8,000 samples

export interface SafeTrimWavResult {
  blob: Blob;
  durationMs: number | null;
  wasTrimmed: boolean;
  usedFallbackBlob: boolean;
}

export interface TrimmedSamplesResult {
  samples: Float32Array;
  wasTrimmed: boolean;
}

type WindowWithWebkitAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
    webkitOfflineAudioContext?: typeof OfflineAudioContext;
  };

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const win = window as WindowWithWebkitAudio;
  return win.AudioContext ?? win.webkitAudioContext ?? null;
}

function getOfflineAudioContextConstructor():
  | typeof OfflineAudioContext
  | null {
  if (typeof window === "undefined") return null;
  const win = window as WindowWithWebkitAudio;
  return win.OfflineAudioContext ?? win.webkitOfflineAudioContext ?? null;
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/**
 * Applies a symmetric linear fade-in and fade-out at the boundaries of a
 * Float32Array slice in place to prevent clicks/pops.
 */
export function applyLinearEdgeFade(
  samples: Float32Array,
  fadeSampleCount: number = FADE_SAMPLES
): void {
  const fadeLength = Math.min(fadeSampleCount, Math.floor(samples.length / 2));
  if (fadeLength <= 0) return;

  const lastIndex = samples.length - 1;
  for (let i = 0; i < fadeLength; i++) {
    const gain = i / fadeLength;
    samples[i] *= gain;
    samples[lastIndex - i] *= gain;
  }
}

/**
 * Encodes mono Float32 PCM samples ([-1, 1]) into a standard 44-byte RIFF
 * 16-bit signed PCM little-endian WAV Blob ("audio/wav").
 */
export function encodeMonoPcm16Wav(
  samples: Float32Array,
  sampleRate: number = TARGET_SAMPLE_RATE
): Blob {
  const numChannels = TARGET_CHANNELS;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataByteLength = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataByteLength, true);
  writeAscii(view, 8, "WAVE");

  // "fmt " sub-chunk (16-bit PCM)
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1Size for PCM
  view.setUint16(20, 1, true); // AudioFormat = 1 (Linear PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // "data" sub-chunk
  writeAscii(view, 36, "data");
  view.setUint32(40, dataByteLength, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const raw = samples[i];
    const safe = Number.isFinite(raw) ? Math.max(-1, Math.min(1, raw)) : 0;
    const pcm16 =
      safe < 0 ? Math.round(safe * 0x8000) : Math.round(safe * 0x7fff);
    view.setInt16(offset, pcm16, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Pure DSP trimming routine on 16,000 Hz mono samples:
 * - Computes RMS across 10 ms (160-sample) windows.
 * - Estimates ambientFloorRms from the quietest 10% of frames.
 * - Uses adaptive speech threshold: Math.max(peakRms * 0.0125, ambientFloorRms * 2.5, 0.0025).
 * - Trims leading and trailing silence ONLY (never internal phrase pauses).
 * - Adds 300 ms safety padding on both sides clamped to [0, totalSamples].
 * - Bypasses trimming if no speech frame is found or trimmed length < 0.5s.
 * - Applies a 5 ms linear fade-in and fade-out at slice boundaries when trimmed.
 */
export function trimMonoSamples16k(
  monoSamples: Float32Array
): TrimmedSamplesResult {
  const totalSamples = monoSamples.length;
  const frameCount = Math.floor(totalSamples / RMS_WINDOW_SAMPLES);

  if (totalSamples < MIN_TRIMMED_SAMPLES || frameCount === 0) {
    return {
      samples: monoSamples.slice(),
      wasTrimmed: false,
    };
  }

  const frameRms = new Float32Array(frameCount);
  let peakRms = 0;

  for (let frameIdx = 0; frameIdx < frameCount; frameIdx++) {
    const baseOffset = frameIdx * RMS_WINDOW_SAMPLES;
    let sumSquares = 0;
    for (let i = 0; i < RMS_WINDOW_SAMPLES; i++) {
      const sample = monoSamples[baseOffset + i];
      const finite = Number.isFinite(sample) ? sample : 0;
      sumSquares += finite * finite;
    }
    const rms = Math.sqrt(sumSquares / RMS_WINDOW_SAMPLES);
    frameRms[frameIdx] = rms;
    if (rms > peakRms) {
      peakRms = rms;
    }
  }

  // Estimate ambient noise floor from the quietest 10% of 10 ms frames
  const sortedRms = Float32Array.from(frameRms).sort();
  const quietestFrameCount = Math.max(1, Math.floor(frameCount * 0.1));
  let quietSum = 0;
  for (let i = 0; i < quietestFrameCount; i++) {
    quietSum += sortedRms[i];
  }
  const ambientFloorRms = quietSum / quietestFrameCount;

  const speechThreshold = Math.max(
    peakRms * 0.0125,
    ambientFloorRms * 2.5,
    0.0025
  );

  let firstSpeechFrame = -1;
  for (let i = 0; i < frameCount; i++) {
    if (frameRms[i] > speechThreshold) {
      firstSpeechFrame = i;
      break;
    }
  }

  // Safety fallback 1: No speech detected above threshold -> keep uncropped 16 kHz audio
  if (firstSpeechFrame === -1) {
    return {
      samples: monoSamples.slice(),
      wasTrimmed: false,
    };
  }

  let lastSpeechFrame = firstSpeechFrame;
  for (let i = frameCount - 1; i >= firstSpeechFrame; i--) {
    if (frameRms[i] > speechThreshold) {
      lastSpeechFrame = i;
      break;
    }
  }

  const startSample = Math.max(
    0,
    firstSpeechFrame * RMS_WINDOW_SAMPLES - SAFETY_BUFFER_SAMPLES
  );
  const endSample = Math.min(
    totalSamples,
    (lastSpeechFrame + 1) * RMS_WINDOW_SAMPLES + SAFETY_BUFFER_SAMPLES
  );
  const trimmedLength = endSample - startSample;

  // Safety fallback 2: Trimmed clip shorter than 0.5 seconds -> keep uncropped 16 kHz audio
  if (trimmedLength < MIN_TRIMMED_SAMPLES) {
    return {
      samples: monoSamples.slice(),
      wasTrimmed: false,
    };
  }

  const sliced = monoSamples.slice(startSample, endSample);
  applyLinearEdgeFade(sliced, FADE_SAMPLES);

  return {
    samples: sliced,
    wasTrimmed: true,
  };
}

/**
 * Decodes a recorded MediaRecorder Blob via Web Audio API, resamples & downmixes
 * to 16,000 Hz mono via OfflineAudioContext, safely trims leading/trailing
 * silence only, and exports a 16-bit PCM WAV Blob ("audio/wav").
 *
 * Never loses or clips a recording:
 * - Returns uncropped 16 kHz mono WAV if speech is undetected or trimmed audio < 0.5s.
 * - Catches any decode/resample failure (e.g. iOS Safari container quirk), logs a
 *   warning, and returns rawBlob untouched so upload still succeeds.
 */
export async function safeTrimToWav(rawBlob: Blob): Promise<SafeTrimWavResult> {
  if (!rawBlob || rawBlob.size === 0) {
    return {
      blob: rawBlob,
      durationMs: null,
      wasTrimmed: false,
      usedFallbackBlob: true,
    };
  }

  const AudioCtx = getAudioContextConstructor();
  const OfflineAudioCtx = getOfflineAudioContextConstructor();

  if (!AudioCtx || !OfflineAudioCtx) {
    console.warn(
      "[safeTrimToWav] Web Audio API unavailable in this browser; returning original recording blob."
    );
    return {
      blob: rawBlob,
      durationMs: null,
      wasTrimmed: false,
      usedFallbackBlob: true,
    };
  }

  try {
    const arrayBuffer = await rawBlob.arrayBuffer();

    let decodedBuffer: AudioBuffer;
    const decodeCtx = new AudioCtx();
    try {
      decodedBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
    } finally {
      await decodeCtx.close().catch(() => {});
    }

    if (decodedBuffer.length === 0 || decodedBuffer.duration <= 0) {
      throw new Error("Decoded AudioBuffer is empty.");
    }

    const targetFrameCount = Math.max(
      1,
      Math.ceil(decodedBuffer.duration * TARGET_SAMPLE_RATE)
    );
    const offlineCtx = new OfflineAudioCtx(
      TARGET_CHANNELS,
      targetFrameCount,
      TARGET_SAMPLE_RATE
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = decodedBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    const monoSamples = renderedBuffer.getChannelData(0);

    if (monoSamples.length === 0) {
      throw new Error("Resampled 16 kHz mono buffer is empty.");
    }

    const { samples: outputSamples, wasTrimmed } =
      trimMonoSamples16k(monoSamples);
    const wavBlob = encodeMonoPcm16Wav(outputSamples, TARGET_SAMPLE_RATE);
    const durationMs = Math.max(
      1,
      Math.round((outputSamples.length / TARGET_SAMPLE_RATE) * 1000)
    );

    return {
      blob: wavBlob,
      durationMs,
      wasTrimmed,
      usedFallbackBlob: false,
    };
  } catch (err) {
    console.warn(
      "[safeTrimToWav] Audio decoding or 16 kHz WAV resampling failed; returning original MediaRecorder blob untouched:",
      err
    );
    return {
      blob: rawBlob,
      durationMs: null,
      wasTrimmed: false,
      usedFallbackBlob: true,
    };
  }
}
