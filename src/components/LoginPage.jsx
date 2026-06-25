import { useState } from 'react'

export default function LoginPage({ onLogin }) {
  const [staffNo, setStaffNo] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const doSearch = async () => {
    const val = staffNo.trim()
    if (!val) { setError('Sila masukkan No. Staf.'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/staff/${encodeURIComponent(val)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'HTTP ' + res.status)
      onLogin(json)
    } catch (e) {
      setError(
        e.message === 'Staff not found'
          ? 'No. Staf tidak dijumpai. Sila semak semula.'
          : 'Ralat: ' + e.message
      )
    } finally {
      setLoading(false)
    }
  }

  const onKey = (e) => { if (e.key === 'Enter') doSearch() }

  return (
    <div className="p1-wrap">
      <div className="glow1" />
      <div className="road-wrap">
        <div className="road-fill" />
        <div className="road-stripe" />
      </div>

      {/* Top bar */}
      <div className="topbar">
        <div className="logo-phn">PHN</div>
        <div className="logo-crop">
          <div className="crop-box">
            <div className="cb" style={{width:'9px'}} />
            <div className="cb" style={{width:'13px'}} />
            <div className="cb" style={{width:'17px'}} />
          </div>
          <div className="crop-txt">
            <span>CROP</span>
            Cost Reduction<br />&amp; Optimisation<br />Programme
          </div>
        </div>
      </div>

      {/* Left panel */}
      <div className="p1-left">
        <div className="cft-lbl">CFT</div>
        <div className="cft-yr">2026</div>
        <div className="cft-tag">COLLABORATE &bull; FOCUS &bull; TRANSFORM</div>
        <div className="cft-sl">
          BERSAMA MELANGKAH,<br />
          MENCIPTA MASA DEPAN<br />
          <span className="cft-sl-gold">YANG LEBIH GEMILANG</span>
        </div>
      </div>

      {/* Right login card */}
      <div className="p1-right">
        <div className="login-card">
          <div className="card-icon">
            <svg viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="9" cy="10" r="2" />
              <path d="M15 8h2M15 12h2M7 16h10" />
            </svg>
          </div>
          <div className="card-ttl">SELAMAT DATANG</div>
          <div className="card-sub">Sila masukkan No. Staf anda untuk meneruskan</div>

          <div className="inp-wrap">
            <svg className="inp-ico" viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
            <input
              className="inp-field"
              type="text"
              placeholder="No. Staf"
              autoComplete="off"
              value={staffNo}
              onChange={e => setStaffNo(e.target.value)}
              onKeyDown={onKey}
              disabled={loading}
            />
          </div>

          <div className="msg-err">{error}</div>
          <div className="msg-load">{loading ? 'Sedang mendapatkan data...' : ''}</div>

          <button className="btn-go" onClick={doSearch} disabled={loading}>
            TERUSKAN
            <svg className="btn-arrow" viewBox="0 0 24 24">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
