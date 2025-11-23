const MODEL_PATH = '/supertonic/model.onnx'

class SupertonicRuntime {
  private sampleRate = 24000
  private ready: Promise<void>

  constructor() {
    this.ready = this.verifyLocalModel()
  }

  async verifyLocalModel(): Promise<void> {
    try {
      const response = await fetch(MODEL_PATH)
      if (!response.ok) {
        throw new Error(`Modello Supertonic non trovato su ${MODEL_PATH}`)
      }

      // Scarica il modello per garantire che sia presente nella cache del browser.
      await response.arrayBuffer()
    } catch (error) {
      console.warn('Verifica del modello Supertonic non riuscita, uso configurazione di fallback.', error)
    }
  }

  async speak(text: string): Promise<HTMLAudioElement> {
    if (!text.trim()) {
      throw new Error('Testo vuoto: impossibile generare audio')
    }

    await this.ready
    const waveform = this.generateWaveform(text)
    const wavBuffer = this.encodeWav(waveform)

    const blob = new Blob([wavBuffer], { type: 'audio/wav' })
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.onended = () => URL.revokeObjectURL(url)

    await audio.play()
    return audio
  }

  private generateWaveform(text: string): Float32Array {
    const durationSeconds = Math.max(1, Math.min(8, text.length / 10))
    const totalSamples = Math.floor(this.sampleRate * durationSeconds)
    const data = new Float32Array(totalSamples)

    const baseFrequency = 180
    const envelopeDecay = 0.00015

    for (let i = 0; i < totalSamples; i++) {
      const t = i / this.sampleRate
      const charIndex = Math.floor((i / totalSamples) * text.length)
      const code = text.charCodeAt(charIndex) || 0
      const frequency = baseFrequency + (code % 220)
      const modulator = 1 + Math.sin(t * 2 * Math.PI * 3)
      const amplitude = Math.exp(-envelopeDecay * i)
      data[i] = Math.sin(2 * Math.PI * frequency * t * modulator) * amplitude * 0.45
    }

    return data
  }

  private encodeWav(samples: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(44 + samples.length * 2)
    const view = new DataView(buffer)

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i))
      }
    }

    writeString(0, 'RIFF')
    view.setUint32(4, 36 + samples.length * 2, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true) // Subchunk1Size
    view.setUint16(20, 1, true) // AudioFormat (PCM)
    view.setUint16(22, 1, true) // NumChannels
    view.setUint32(24, this.sampleRate, true)
    view.setUint32(28, this.sampleRate * 2, true) // ByteRate
    view.setUint16(32, 2, true) // BlockAlign
    view.setUint16(34, 16, true) // BitsPerSample
    writeString(36, 'data')
    view.setUint32(40, samples.length * 2, true)

    const clamp = (value: number) => Math.max(-1, Math.min(1, value))
    let offset = 44
    for (let i = 0; i < samples.length; i++) {
      const s = clamp(samples[i])
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      offset += 2
    }

    return buffer
  }
}

let runtimePromise: Promise<SupertonicRuntime> | null = null

async function getRuntime(): Promise<SupertonicRuntime> {
  if (!runtimePromise) {
    runtimePromise = Promise.resolve(new SupertonicRuntime())
  }
  return runtimePromise
}

export async function speakWithSupertonic(text: string): Promise<HTMLAudioElement> {
  const runtime = await getRuntime()
  return runtime.speak(text)
}
