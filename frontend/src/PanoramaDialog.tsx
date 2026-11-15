import { useEffect, useRef, useState } from 'react'
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
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="pd-dialog"
      aria-labelledby="panorama-title"
      onClose={onClose}
      // Sadece boşluğa (backdrop) tıklanırsa kapat; içerik tüm alanı kapladığı için
      // hedef dialog'un kendisi olursa tıklama dışarıdadır.
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close()
      }}
    >
      <header className="pd-header">
        <div className="pd-heading">
          <p className="pd-kicker">360° Panorama</p>
          <h2 id="panorama-title" className="pd-title">{panorama.name}</h2>
          <p className="pd-meta">Sol {panorama.sol} · Approximate capture location</p>
        </div>

        <div className="pd-actions">
          <a className="pd-link" href={panorama.url} target="_blank" rel="noopener noreferrer">
            Open at FU Berlin <span aria-hidden="true">↗</span>
          </a>
          <form method="dialog">
            <button type="submit" className="pd-close" aria-label="Close" autoFocus>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M5 5l14 14M19 5L5 19" />
              </svg>
            </button>
          </form>
        </div>
      </header>

      <div className="pd-stage">
        <div className="pd-loading" data-hidden={loaded} role="status">
          <i aria-hidden="true" />
          <span>Loading panorama…</span>
        </div>

        <iframe
          className="pd-frame"
          data-loaded={loaded}
          src={panorama.url}
          title={`${panorama.name} — 360° panorama`}
          allowFullScreen
          onLoad={() => setLoaded(true)}
        />

        <footer className="pd-credit">
          <span>Image: Mars 2020 / Mastcam-Z · NASA / JPL / ASU / MSSS</span>
          <span>Viewer: Freie Universität Berlin</span>
        </footer>
      </div>
    </dialog>
  )
}