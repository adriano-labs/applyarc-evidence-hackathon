// Record from the microphone, then hand back a mono 16-bit WAV at 16 kHz, the
// format Meta Voice Transcribe's file API accepts.
import { encodeWav } from './wav.js';

const RATE = 16000;

export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks = [];
  recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
  recorder.start();
  return {
    async stop() {
      const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
      recorder.stop();
      await stopped;
      const context = new AudioContext();
      try {
        const audio = await context.decodeAudioData(await new Blob(chunks).arrayBuffer());
        const offline = new OfflineAudioContext(1, Math.ceil(audio.duration * RATE), RATE);
        const source = offline.createBufferSource();
        source.buffer = audio;
        source.connect(offline.destination);
        source.start();
        return encodeWav((await offline.startRendering()).getChannelData(0), RATE);
      } finally {
        stream.getTracks().forEach((track) => track.stop());
        context.close();
      }
    },
  };
}
