import { useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  ArcElement,
  DoughnutController,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(ArcElement, DoughnutController, Tooltip, Legend)

function fmtRM(n) {
  return 'RM ' + Math.round(n).toLocaleString('ms-MY')
}

export default function DashboardPage({ data, onBack }) {
  const chartRef = useRef(null)
  const chartInstance = useRef(null)

  const pct = data.target > 0
    ? Math.round((data.actualSaving / data.target) * 100)
    : 0
  const fill = Math.min(pct, 100)
  const gap  = data.target - data.actualSaving

  useEffect(() => {
    if (!chartRef.current) return

    // Destroy any chart already attached to this canvas (handles StrictMode double-invoke)
    const existing = ChartJS.getChart(chartRef.current)
    if (existing) existing.destroy()
    if (chartInstance.current) {
      chartInstance.current.destroy()
      chartInstance.current = null
    }

    chartInstance.current = new ChartJS(chartRef.current, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [fill, 100 - fill],
          backgroundColor: pct >= 100
            ? ['#0a2d7a', '#d4a017']
            : ['#1247b8', '#d4a017'],
          borderWidth: 0,
        }],
      },
      options: {
        cutout: '70%',
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        animation: { duration: 800 },
      },
    })

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy()
        chartInstance.current = null
      }
    }
  }, [fill, pct])

  const updateTime = new Date().toLocaleString('ms-MY')

  return (
    <div className="p2-wrap">
      <div className="glow2" />
      <div className="p2-inner">

        {/* Top bar */}
        <div className="p2-top">
          <button className="back-btn" onClick={onBack}>
            <svg viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
            KEMBALI
          </button>
          <div className="logo-phn-sm">PHN</div>
          <div className="logo-crop">
            <div className="crop-box-sm">
              <div className="cb-sm" style={{width:'7px'}} />
              <div className="cb-sm" style={{width:'10px'}} />
              <div className="cb-sm" style={{width:'13px'}} />
            </div>
            <div className="crop-txt">
              <span style={{fontSize:'11px'}}>CROP</span>
              Cost Reduction<br />&amp; Optimisation
            </div>
          </div>
        </div>

        {/* Banner */}
        <div className="p2-banner">
          <div className="p2-ttl">
            CFT 2026 : <span>INDIVIDUAL SAVING</span>
          </div>
        </div>

        {/* Body */}
        <div className="p2-body">

          {/* Staff info row */}
          <div className="srow">
            <div className="sblk">
              <div className="sblk-icon">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              </div>
              <div>
                <div className="sblk-lbl">Nama</div>
                <div className="sblk-val">{data.name}</div>
              </div>
            </div>
            <div className="sblk">
              <div className="sblk-icon">
                <svg viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <circle cx="9" cy="10" r="2" />
                  <path d="M15 8h2M15 12h2" />
                </svg>
              </div>
              <div>
                <div className="sblk-lbl">No. Staff</div>
                <div className="sblk-val">{data.empNo}</div>
              </div>
            </div>
            <div className="sblk">
              <div className="sblk-icon">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 3" />
                </svg>
              </div>
              <div>
                <div className="sblk-lbl">Target CFT 2026</div>
                <div className="sblk-val">{fmtRM(data.target)}</div>
              </div>
            </div>
          </div>

          {/* Main grid */}
          <div className="pgrid">

            {/* Left – project list */}
            <div className="pleft">
              <div className="sec-lbl">Senarai Projek</div>

              {data.projects.length > 0 ? (
                data.projects.map((p, i) => (
                  <div className="pcard" key={i}>
                    <div className="pnum">{i + 1}</div>
                    <div className="ptitle">{p.title}</div>
                    <div className="psav-box">
                      <div className="psav-lbl">Saving</div>
                      <div className="psav-val">{fmtRM(p.saving)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-proj">Tiada projek didaftarkan lagi.</div>
              )}

              <div className="total-row">
                <div className="total-ico">
                  <svg viewBox="0 0 24 24">
                    <path d="M4 20V10l8-6 8 6v10M9 20v-6h6v6" />
                  </svg>
                </div>
                <div className="total-lbl">Jumlah Keseluruhan Saving</div>
                <div className="total-val">{fmtRM(data.actualSaving)}</div>
              </div>
            </div>

            {/* Right – achievement */}
            <div className="pright">
              <div className="ach-card">
                <div className="ach-ttl">Achievement</div>
                <div className="donut-wrap">
                  <canvas ref={chartRef} width={130} height={130} />
                  <div className="donut-center">
                    <div className="donut-pct">{pct}%</div>
                    <div className="donut-sub">Pencapaian<br />Daripada Target</div>
                  </div>
                </div>
                <div className="ach-sav-lbl">Saving Sehingga Kini</div>
                <div className="ach-sav-val">{fmtRM(data.actualSaving)}</div>
              </div>

              {pct >= 100 ? (
                <div className="tahniah">
                  <div className="tahniah-ico">🏆</div>
                  <div className="tahniah-ttl">TAHNIAH!</div>
                  <div className="tahniah-msg">
                    Sasaran anda telah melebihi target CFT 2026.
                  </div>
                </div>
              ) : (
                <div className="usaha">
                  <div className="usaha-ttl">TERUSKAN USAHA!</div>
                  <div className="usaha-msg">
                    Baki diperlukan:<br />
                    <strong style={{color:'#f5c842',fontSize:'14px'}}>
                      {fmtRM(gap)}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="foot-note">Data dikemaskini: {updateTime}</div>
        </div>
      </div>
    </div>
  )
}
