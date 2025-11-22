import { useCallback, useEffect, useRef, useState } from 'react'
import { describeImage } from './services/openrouter'
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
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [lastDescription, setLastDescription] = useState<DescriptionEntry | null>(null)
  const [isDescribing, setIsDescribing] = useState(false)
  const [autoMode, setAutoMode] = useState(true)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [lastSpoken, setLastSpoken] = useState('')
  const [lastLatency, setLastLatency] = useState<number | null>(null)

  const speakText = useCallback(
    (text: string) => {
      if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
        return
      }

      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'en-US'
      utterance.rate = 1
      utterance.pitch = 1
      window.speechSynthesis.speak(utterance)
      setLastSpoken(text)
    },
    [voiceEnabled],
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
    setStatus('Requesting camera access...')
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
        setStatus('Camera is live. Auto description is running every few seconds.')
      }
    } catch (cameraError) {
      console.error(cameraError)
      setCameraStatus('error')
      setError('Camera access failed. Please allow camera permissions and try again.')
      setStatus('Unable to start the camera')
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

      if (!import.meta.env.VITE_OPENROUTER_API_KEY) {
        setError('Add VITE_OPENROUTER_API_KEY to your environment to enable OpenRouter vision calls.')
        setStatus('API key missing. Auto mode paused until configured.')
        setAutoMode(false)
        return
      }

      const frame = captureFrame()

      if (!frame) {
        setStatus('Waiting for a clear camera frame...')
        return
      }

      setIsDescribing(true)
      setStatus(trigger === 'auto' ? 'Updating description...' : 'Describing the scene now...')

      const start = performance.now()

      try {
        const description = await describeImage(frame)
        setLastLatency(Math.round(performance.now() - start))

        const cleaned = description.trim()
        setLastDescription({ text: cleaned, timestamp: Date.now() })
        setError(null)

        if (voiceEnabled && cleaned !== lastSpoken) {
          speakText(cleaned)
        }
      } catch (inferenceError) {
        console.error(inferenceError)
        const message =
          inferenceError instanceof Error
            ? inferenceError.message
            : 'Unable to describe the scene right now.'
        setError(message)
        setStatus('Waiting before retrying...')
      } finally {
        setIsDescribing(false)
      }
    },
    [captureFrame, isDescribing, lastSpoken, speakText, voiceEnabled],
  )

  useEffect(() => {
    startCamera()

    return () => {
      stopCamera()
    }
  }, [startCamera, stopCamera])

  useEffect(() => {
    if (!autoMode) {
      return undefined
    }

    const interval = window.setInterval(() => {
      void requestDescription('auto')
    }, CAPTURE_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [autoMode, requestDescription])

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Mobile-first · Live AI narration</p>
          <h1>Eyes Up</h1>
          <p className="lede">
            Keep the camera running and let the assistant narrate what it sees in clear English. The view stays on screen
            while the description is read aloud for hands-free accessibility.
          </p>
        </div>
        <div className="pills">
          <span className="pill">Grok 4.1 fast</span>
          <span className="pill">Vision ready</span>
          <span className="pill">Voice enabled</span>
        </div>
      </header>

      <main className="grid">
        <section className="card video-card">
          <div className="card-header">
            <div>
              <p className="overline">Live camera</p>
              <h2>{cameraStatus === 'active' ? 'Streaming' : 'Camera control'}</h2>
            </div>
            <div className={`status-dot ${cameraStatus}`} aria-label={`Camera status: ${cameraStatus}`}></div>
          </div>

          <div className="video-shell">
            <video ref={videoRef} className="video" playsInline autoPlay muted aria-label="Live camera feed" />
            <div className="overlay">
              <p className="overlay-text">Camera stays on. Point it at the scene you need described.</p>
            </div>
          </div>

          <div className="actions">
            <button className="primary" onClick={() => void requestDescription('manual')} disabled={isDescribing}>
              {isDescribing ? 'Listening to the scene...' : 'Describe now'}
            </button>
            <button className="ghost" onClick={() => void startCamera()}>
              Restart camera
            </button>
            <button className="ghost" onClick={stopCamera}>
              Stop camera
            </button>
          </div>

          <div className="toggles">
            <label className="toggle">
              <input
                type="checkbox"
                checked={autoMode}
                onChange={(event) => setAutoMode(event.target.checked)}
              />
              <span>Auto describe every {Math.round(CAPTURE_INTERVAL_MS / 1000)}s</span>
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={voiceEnabled}
                onChange={(event) => setVoiceEnabled(event.target.checked)}
              />
              <span>Speak results aloud</span>
            </label>
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
              <p className="overline">Narration</p>
              <h2>What the model sees</h2>
            </div>
            {lastLatency ? <span className="pill small">{lastLatency} ms</span> : null}
          </div>

          {lastDescription ? (
            <>
              <p className="description">{lastDescription.text}</p>
              <p className="timestamp">Updated {new Date(lastDescription.timestamp).toLocaleTimeString()}</p>
            </>
          ) : (
            <p className="placeholder">Waiting for the first description...</p>
          )}
        </section>
      </main>

      <canvas ref={canvasRef} className="hidden-canvas" aria-hidden="true"></canvas>
    </div>
  )
}

export default App
