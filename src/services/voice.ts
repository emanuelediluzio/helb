const ELEVENLABS_API_KEY =
  import.meta.env.VITE_ELEVENLABS_API_KEY ?? 'sk_02a12eca8af6f8c1774563ce986b26289c7a29eb2591040b'

const ELEVENLABS_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'

export async function speakWithElevenLabs(text: string): Promise<HTMLAudioElement> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('Missing VITE_ELEVENLABS_API_KEY for ElevenLabs text-to-speech')
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream?optimize_streaming_latency=1`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        model_id: 'eleven_multilingual_v2',
        text,
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.8,
          style: 0.2,
          use_speaker_boost: true,
        },
      }),
    },
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`ElevenLabs error ${response.status}: ${errorText}`)
  }

  const audioBuffer = await response.arrayBuffer()
  const blob = new Blob([audioBuffer], { type: 'audio/mpeg' })
  const url = URL.createObjectURL(blob)

  const audio = new Audio(url)
  audio.onended = () => URL.revokeObjectURL(url)

  await audio.play()
  return audio
}
