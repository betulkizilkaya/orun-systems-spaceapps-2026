import { useEffect, useRef } from 'react'
import './PanoramaDialog.css'

export type Panorama = {
  name: string
  url: string
  sol: string
}

export function PanoramaDialog({
  panorama,
  onClose,
}: {
  panorama: Panorama
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="panorama-dialog"
      aria-labelledby="panorama-title"
      onClose={onClose}
    >
      <div className="panorama-header">
        <div>
          <h2 id="panorama-title">{panorama.name}</h2>
          <p>Sol {panorama.sol} · Yaklaşık çekim konumu</p>
        </div>

        <div className="panorama-actions">
          <a href={panorama.url} target="_blank" rel="noopener noreferrer">
            FU Berlin’de aç ↗
          </a>
          <form method="dialog">
            <button type="submit">Kapat</button>
          </form>
        </div>
      </div>

      <iframe
        className="panorama-frame"
        src={panorama.url}
        title={`${panorama.name} — 360° panorama`}
        allowFullScreen
      />

      <footer className="panorama-credit">
        Görüntü Mars 2020 / Mastcam-Z · NASA / JPL / ASU / MSSS
        <span>Görüntüleyici · Freie Universität Berlin</span>
      </footer>
    </dialog>
  )
}