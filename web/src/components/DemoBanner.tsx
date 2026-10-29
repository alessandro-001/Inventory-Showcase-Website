import { api } from '../api/client'

const SOURCE = 'https://github.com/alessandro-001/Inventory-Showcase-Website'

// Thin note above the header: this is a demo, data lives in this browser, and how to start over.
export function DemoBanner() {
  async function reset() {
    if (!confirm('Reset the demo? Your changes in this browser will be lost.')) return
    await api.reset()
    location.reload()
  }
  return (
    <div className="demo-banner" role="note">
      <p><strong>Demo</strong> — changes stay in your browser.</p>
      <div className="demo-actions">
        <button type="button" className="link" onClick={reset}>Reset demo</button>
        <a href={SOURCE} target="_blank" rel="noreferrer">Source</a>
      </div>
    </div>
  )
}
