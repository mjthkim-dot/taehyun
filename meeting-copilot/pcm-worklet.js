// 🎙 PCM 캡처 워클릿 — Gemini Live 전사용 (v6.4)
// 브라우저 오디오(보통 48kHz Float32)를 16kHz 16비트 PCM으로 바꿔 100ms(1,600샘플)
// 단위로 메인 스레드에 넘긴다. Live API 규격: raw 16-bit PCM, 16kHz, mono, LE.
// 워클릿은 오디오 스레드에서 돌아 메인 스레드(번역·답변 렌더)가 바빠도 끊기지 않는다.
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;   // sampleRate: 워클릿 전역 (AudioContext 샘플레이트)
    this.pos = 0;                      // 다음 출력 샘플의 입력 위치(소수)
    this.out = new Int16Array(1600);
    this.n = 0;
    this.prev = 0;                     // 직전 블록의 마지막 샘플(블록 경계 보간용)
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    // 선형 보간 다운샘플 — 음성 대역(≤8kHz)에는 충분하고 지연이 없다
    // pos는 블록 경계를 넘으면 [-1, 0) 범위가 된다 → 인덱스 -1은 직전 블록의 마지막 샘플
    const at = k => (k < 0 ? this.prev : ch[k]);
    while (this.pos < ch.length - 1) {
      const i = Math.floor(this.pos), f = this.pos - i;
      let v = at(i) * (1 - f) + at(i + 1) * f;
      v = v < -1 ? -1 : v > 1 ? 1 : v;
      this.out[this.n++] = v < 0 ? v * 0x8000 : v * 0x7fff;
      if (this.n === this.out.length) {
        this.port.postMessage(this.out.buffer, [this.out.buffer]);
        this.out = new Int16Array(1600); this.n = 0;
      }
      this.pos += this.ratio;
    }
    this.pos -= ch.length;
    this.prev = ch[ch.length - 1];
    return true;
  }
}
registerProcessor('pcm-capture', PcmCapture);
