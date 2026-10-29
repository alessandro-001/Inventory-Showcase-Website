import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

// Minimal typing for the native BarcodeDetector (Chrome/Android; not in Safari, which falls back to zxing).
interface DetectedBarcode { rawValue: string }
interface NativeDetector { detect(source: HTMLVideoElement): Promise<DetectedBarcode[]> }
declare global {
  interface Window { BarcodeDetector?: new (opts: { formats: string[] }) => NativeDetector }
}

export type ScannerStatus = 'starting' | 'scanning' | 'paused' | 'unsupported' | 'blocked'

const FORMATS = ['data_matrix', 'qr_code', 'code_128', 'code_39', 'ean_13']

// Opens the rear camera into `videoRef`, calls `onDetect` once per successful read, then pauses.
// Call `resume()` to scan again (e.g. after the server rejected a code). Stops the camera on unmount.
export function useBarcodeScanner(videoRef: RefObject<HTMLVideoElement | null>, onDetect: (text: string) => void) {
  const [status, setStatus] = useState<ScannerStatus>('starting')
  const [torch, setTorch] = useState<{ on: boolean; toggle: () => void } | null>(null)
  const [run, setRun] = useState(0)
  const onDetectRef = useRef(onDetect)
  useEffect(() => { onDetectRef.current = onDetect }, [onDetect])

  useEffect(() => {
    let stopped = false
    let stream: MediaStream | undefined
    let timer: number | undefined
    let zxing: { reset(): void } | undefined

    const found = (text: string) => {
      if (stopped) return
      stopped = true
      setStatus('paused')
      onDetectRef.current(text)
    }

    ;(async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setStatus('unsupported')
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        const video = videoRef.current
        if (stopped || !video) return
        video.srcObject = stream
        await video.play()

        const track = stream.getVideoTracks()[0]
        if ((track.getCapabilities?.() as { torch?: boolean } | undefined)?.torch) {
          let on = false
          const toggle = () => {
            on = !on
            track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] })
            setTorch({ on, toggle })
          }
          setTorch({ on, toggle })
        }
        setStatus('scanning')

        if (window.BarcodeDetector) {
          const detector = new window.BarcodeDetector({ formats: FORMATS })
          const tick = async () => {
            if (stopped) return
            try {
              const [hit] = await detector.detect(video)
              if (hit?.rawValue) return found(hit.rawValue)
            } catch { /* frame not ready */ }
            timer = window.setTimeout(tick, 250)
          }
          tick()
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/library') // loaded only when needed (iOS)
          if (stopped) return
          const reader = new BrowserMultiFormatReader()
          zxing = reader
          reader.decodeFromStream(stream, video, result => { if (result) found(result.getText()) })
        }
      } catch {
        if (!stopped) setStatus('blocked')
      }
    })()

    return () => {
      stopped = true
      window.clearTimeout(timer)
      zxing?.reset()
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [videoRef, run])

  const resume = useCallback(() => { setStatus('starting'); setRun(r => r + 1) }, [])
  return { status, torch, resume }
}
