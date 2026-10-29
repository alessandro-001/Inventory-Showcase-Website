import { useState } from 'react'
import type { PackageKind } from '../lib/packageKind'

// Distributor photo (https only, sanitized server-side) or, without one, a CSS-drawn component sitting on a
// scrap of PCB: tan capacitor, black resistor, IC with legs... with the start of the part number printed on it.
// The drawing is also the fallback when the photo fails: DigiKey's image host sits behind a Cloudflare bot
// challenge, which an embedded <img> can't pass, so its photos often don't load on other sites.
export function PartImage({ src, label, kind = 'chip', className = '' }:
  { src: string; label: string; kind?: PackageKind; className?: string }) {
  const [failed, setFailed] = useState('')
  if (src && src !== failed) {
    return <img className={`part-img ${className}`} src={src} alt="" loading="lazy" referrerPolicy="no-referrer"
      onError={() => setFailed(src)} />
  }
  return (
    <div className={`part-img part-img-empty ${className}`} aria-hidden="true">
      <span className={`pkg pkg-${kind}`}>
        <span className="pkg-text">{label.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()}</span>
      </span>
    </div>
  )
}
