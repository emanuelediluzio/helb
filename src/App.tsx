import { useCallback, useEffect, useRef, useState } from 'react'
import { describeImage } from './services/openrouter'
import { speakWithElevenLabs } from './services/voice'
import './App.css'

type DescriptionEntry = {
  text: string
  timestamp: number
}

const CAPTURE_INTERVAL_MS = 6000

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'starting' | 'active' | 'error'>(
    'idle',
  )
  const [status, setStatus] = useState('Preparazione della fotocamera...')
  const [error, setError] = useState<string | null>(null)
  const [lastDescription, setLastDescription] = useState<DescriptionEntry | null>(null)
  const [isDescribing, setIsDescribing] = useState(false)
  const [lastSpoken, setLastSpoken] = useState('')
  const [lastLatency, setLastLatency] = useState<number | null>(null)
  const pendingAudioRef = useRef<HTMLAudioElement | null>(null)

  const speakText = useCallback(
    (text: string) => {
      if (typeof window === 'undefined') {
        return
      }

      if (pendingAudioRef.current) {
        pendingAudioRef.current.pause()
        pendingAudioRef.current = null
      }

      void speakWithElevenLabs(text)
        .then((audio) => {
          pendingAudioRef.current = audio
          setLastSpoken(text)
        })
        .catch((ttsError) => {
          console.error(ttsError)
          setError('Sintesi vocale non disponibile in questo momento.')
        })
    },
    [],
  )

  const stopCamera = useCallback(() => {
    const stream = videoRef.current?.srcObject as MediaStream | null
    stream?.getTracks().forEach((track) => track.stop())
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraStatus('idle')
  }, [])

  const startCamera = useCallback(async () => {
    stopCamera()
    setError(null)
    setStatus('Attivazione fotocamera...')
    setCameraStatus('starting')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraStatus('active')
        setStatus('In ascolto della scena, aggiornamento automatico ogni pochi secondi.')
      }
    } catch (cameraError) {
      console.error(cameraError)
      setCameraStatus('error')
      setError('Accesso alla fotocamera non riuscito. Concedi i permessi e riprova.')
      setStatus('Impossibile avviare la fotocamera')
    }
  }, [stopCamera])

  const captureFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current

    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      return null
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')

    if (!context) {
      return null
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.5)
  }, [])

  const requestDescription = useCallback(
    async (trigger: 'auto' | 'manual' = 'auto') => {
      if (isDescribing) {
        return
      }

      const frame = captureFrame()

      if (!frame) {
        setStatus('In attesa di un fotogramma nitido dalla fotocamera...')
        return
      }

      setIsDescribing(true)
      setStatus('Analisi in corso...')

      const start = performance.now()

      try {
        const description = await describeImage(frame)
        setLastLatency(Math.round(performance.now() - start))

        const cleaned = description.trim()
        const isSameAsLast = lastDescription?.text === cleaned
        const now = Date.now()

        if (isSameAsLast && trigger === 'auto') {
          setLastDescription({ text: cleaned, timestamp: now })
          setStatus('Situazione invariata, continuo a monitorare.')
          if (lastSpoken !== 'Situazione invariata.') {
            speakText('Situazione invariata.')
          }
          return
        }

        setLastDescription({ text: cleaned, timestamp: now })
        setError(null)
        setStatus('Descrizione aggiornata e letta ad alta voce.')

        if (cleaned !== lastSpoken) {
          speakText(cleaned)
        }
      } catch (inferenceError) {
        console.error(inferenceError)
        const message =
          inferenceError instanceof Error
            ? inferenceError.message
            : 'Impossibile descrivere la scena in questo momento.'
        setError(message)
        setStatus('Attendo prima di riprovare...')
      } finally {
        setIsDescribing(false)
      }
    },
    [captureFrame, isDescribing, lastDescription, lastSpoken, speakText],
  )

  useEffect(() => {
    startCamera()

    return () => {
      stopCamera()
    }
  }, [startCamera, stopCamera])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void requestDescription('auto')
    }, CAPTURE_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [requestDescription])

  return (
    <div className="page">
      <header className="hero minimal">
        <div>
          <p className="eyebrow">Auto assistenza visiva</p>
          <h1>Eyes Up</h1>
          <p className="lede">Descrizione vocale automatica, ogni 6 secondi, senza controlli da toccare.</p>
        </div>
      </header>

      <main className="grid">
        <section className="card video-card">
          <div className="card-header">
            <div>
              <p className="overline">Fotocamera</p>
              <h2>{cameraStatus === 'active' ? 'Streaming' : 'Inizializzazione'}</h2>
            </div>
            <div className={`status-dot ${cameraStatus}`} aria-label={`Camera status: ${cameraStatus}`}></div>
          </div>

          <div className="video-shell">
            <video ref={videoRef} className="video" playsInline autoPlay muted aria-label="Live camera feed" />
          </div>

          <p className="status" aria-live="polite">
            {status}
          </p>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
        </section>

        <section className="card description-card" aria-live="assertive">
          <div className="card-header">
            <div>
              <p className="overline">Narrazione</p>
              <h2>Cosa vede il modello</h2>
            </div>
            {lastLatency ? <span className="pill small">{lastLatency} ms</span> : null}
          </div>

          {lastDescription ? (
            <>
              <p className="description">{lastDescription.text}</p>
              <p className="timestamp">Aggiornato alle {new Date(lastDescription.timestamp).toLocaleTimeString()}</p>
            </>
          ) : (
            <p className="placeholder">In attesa della prima descrizione...</p>
          )}
        </section>
      </main>

      <canvas ref={canvasRef} className="hidden-canvas" aria-hidden="true"></canvas>
    </div>
  )
}

export default App
