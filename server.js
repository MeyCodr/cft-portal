import express from 'express'
import cors from 'cors'
import xlsx from 'xlsx'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// .env.local takes priority over .env (local dev secrets)
dotenv.config({ path: path.join(__dirname, '.env.local') })
dotenv.config({ path: path.join(__dirname, '.env') })

const app = express()
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*'
}))
app.use(express.json())

// ── Serve built React app (production) ───────────────────────────────────────
const DIST = path.join(__dirname, 'dist')
app.use('/phncft', express.static(DIST))
app.get('/phncft', (_req, res) => res.sendFile(path.join(DIST, 'index.html')))
app.get('/phncft/*', (req, res, next) => {
  if (req.path.startsWith('/phncft/api')) return next()  // let API routes handle it
  res.sendFile(path.join(DIST, 'index.html'))
})

// ── Config ────────────────────────────────────────────────────────────────────
const GSHEET_CSV_URL       = process.env.GSHEET_CSV_URL
const AZURE_TENANT_ID      = process.env.AZURE_TENANT_ID
const AZURE_CLIENT_ID      = process.env.AZURE_CLIENT_ID
const AZURE_CLIENT_SECRET  = process.env.AZURE_CLIENT_SECRET
const ONEDRIVE_USER_EMAIL  = process.env.ONEDRIVE_USER_EMAIL
const ONEDRIVE_FILE_PATH   = process.env.ONEDRIVE_FILE_PATH || 'MASTER CFT 2026 .xlsx'
const LOCAL_EXCEL_PATH     = process.env.EXCEL_PATH || path.join(__dirname, 'MASTER CFT 2026 .xlsx')

const USE_GSHEET = !!GSHEET_CSV_URL
const USE_GRAPH  = !USE_GSHEET && !!(AZURE_TENANT_ID && AZURE_CLIENT_ID && AZURE_CLIENT_SECRET && ONEDRIVE_USER_EMAIL)

console.log(
  USE_GSHEET ? `Data source: Google Sheets (${GSHEET_CSV_URL})`
  : USE_GRAPH ? `Data source: OneDrive (${ONEDRIVE_USER_EMAIL}/${ONEDRIVE_FILE_PATH})`
  : `Data source: Local file (${LOCAL_EXCEL_PATH})`
)

// ── Column indices in "ALL STAFF" sheet (0-based) ────────────────────────────
const COL = {
  EMPNO:      0,   // A  Employee number
  NAME:       1,   // B  Full name
  CFT_GROUP:  2,   // C  Multi-line project titles "1)Title...\n2)Title..."
  TARGET:     3,   // D  Individual target (RM)
  PROJ_START: 4,   // E  Project 1 saving
  PROJ_END:   30,  // AE Project 27 saving
  ACTUAL:     31,  // AF Actual saving
  ACHIEVE:    33,  // AH Achievement % (decimal, e.g. 0.53 = 53%)
  DESIG:      34,  // AI Designation
  TEAM:       35,  // AJ Team
  DIVISION:   36,  // AK Division
  DEPT:       37,  // AL Department
  SECTION:    38,  // AM Section
}

// ── Parse multi-line project titles from column C ─────────────────────────────
function parseProjectTitles(text) {
  if (!text) return []
  const lines = text.toString().replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const projects = []
  let current = null
  for (const line of lines) {
    const match = line.match(/^(\d+)\)\s*(.*)/)
    if (match) {
      if (current !== null) projects.push(current.trim())
      current = match[2]
    } else if (current !== null) {
      current += '\n' + line
    }
  }
  if (current !== null) projects.push(current.trim())
  return projects.filter(Boolean)
}

// ── Robust number parser: handles "1,478.14", "30,000", "10.41%" ─────────────
function toNum(v) {
  return parseFloat(String(v ?? '').replace(/,/g, '')) || 0
}
function toPct(v) {
  const s = String(v ?? '').trim()
  // Could be "10.41%" (Google Sheets) or "0.1041" (Excel)
  if (s.endsWith('%')) return parseFloat(s) || 0          // already a percentage
  return Math.round((parseFloat(s) || 0) * 10000) / 100  // decimal → percentage
}

// ── Build staff array from 2D rows array ──────────────────────────────────────
function buildStaffFromRows(rows) {
  const staff = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const empNo = String(row[COL.EMPNO] || '').trim()
    if (!empNo) continue

    const projectTitles = parseProjectTitles(row[COL.CFT_GROUP])
    const projects = projectTitles.map((title, idx) => ({
      title,
      saving: toNum(row[COL.PROJ_START + idx]),
    }))

    staff.push({
      empNo,
      name:           String(row[COL.NAME]     || '').trim(),
      target:         toNum(row[COL.TARGET]),
      projects,
      actualSaving:   toNum(row[COL.ACTUAL]),
      achievementPct: toPct(row[COL.ACHIEVE]),
      designation:    String(row[COL.DESIG]    || '').trim(),
      team:           String(row[COL.TEAM]     || '').trim(),
      division:       String(row[COL.DIVISION] || '').trim(),
      department:     String(row[COL.DEPT]     || '').trim(),
      section:        String(row[COL.SECTION]  || '').trim(),
    })
  }
  return staff
}

// ── Graph API: token cache ─────────────────────────────────────────────────────
let tokenCache = { value: null, expiresAt: 0 }

async function getAccessToken() {
  if (tokenCache.value && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.value
  }
  const res = await fetch(
    `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     AZURE_CLIENT_ID,
        client_secret: AZURE_CLIENT_SECRET,
        grant_type:    'client_credentials',
        scope:         'https://graph.microsoft.com/.default',
      }),
    }
  )
  if (!res.ok) throw new Error('Token error: ' + await res.text())
  const data = await res.json()
  tokenCache = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return tokenCache.value
}

// ── OneDrive: get file metadata (lastModifiedDateTime + download URL) ─────────
async function getFileMeta() {
  const token = await getAccessToken()
  const encodedPath = ONEDRIVE_FILE_PATH.split('/').map(encodeURIComponent).join('/')
  const url = `https://graph.microsoft.com/v1.0/users/${ONEDRIVE_USER_EMAIL}/drive/root:/${encodedPath}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error('File not found on OneDrive: ' + await res.text())
  return res.json()
}

// ── OneDrive: download and parse Excel ───────────────────────────────────────
async function downloadAndParse(downloadUrl) {
  const fileRes = await fetch(downloadUrl)
  if (!fileRes.ok) throw new Error('File download failed: ' + fileRes.status)
  const buffer = await fileRes.arrayBuffer()
  const wb = xlsx.read(new Uint8Array(buffer), { type: 'array' })
  const ws = wb.Sheets['ALL STAFF']
  if (!ws) throw new Error('Sheet "ALL STAFF" not found in workbook')
  return xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' })
}

// ── Google Sheets: parse CSV (handles quoted multi-line fields) ───────────────
function parseCSV(text) {
  const rows = []
  let row = [], field = '', inQuote = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuote) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') inQuote = false
      else field += ch
    } else {
      if (ch === '"') inQuote = true
      else if (ch === ',') { row.push(field); field = '' }
      else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        if (ch === '\r') i++
        row.push(field); rows.push(row); row = []; field = ''
      } else field += ch
    }
  }
  if (row.length || field) { row.push(field); rows.push(row) }
  return rows
}

// ── Google Sheets: fetch CSV and return 2D rows array ────────────────────────
let lastCsvText = null  // detect changes without rebuilding unnecessarily

async function loadFromGoogleSheets() {
  const res = await fetch(GSHEET_CSV_URL)
  if (!res.ok) throw new Error('Google Sheets fetch failed: ' + res.status)
  const text = await res.text()
  if (text === lastCsvText) return null  // no change
  lastCsvText = text
  return parseCSV(text)
}

// ── Local file fallback ───────────────────────────────────────────────────────
function loadFromLocalFile() {
  const wb = xlsx.readFile(LOCAL_EXCEL_PATH)
  const ws = wb.Sheets['ALL STAFF']
  if (!ws) throw new Error('Sheet "ALL STAFF" not found')
  return xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' })
}

// ── Smart cache: only re-downloads when file actually changed ─────────────────
let cache = null
let lastModified = null  // tracks OneDrive file's lastModifiedDateTime
let lastChecked = null   // shown in /api/status

async function checkAndRefresh() {
  try {
    if (USE_GSHEET) {
      const rows = await loadFromGoogleSheets()
      if (rows === null) return  // no change in CSV content
      cache = buildStaffFromRows(rows)
      console.log(`[${new Date().toLocaleTimeString()}] Google Sheets changed → reloaded ${cache.length} records`)
    } else if (USE_GRAPH) {
      const meta = await getFileMeta()
      const modified = meta.lastModifiedDateTime
      if (modified === lastModified && cache) return  // nothing changed
      const rows = await downloadAndParse(meta['@microsoft.graph.downloadUrl'])
      cache = buildStaffFromRows(rows)
      lastModified = modified
      console.log(`[${new Date().toLocaleTimeString()}] OneDrive changed → reloaded ${cache.length} records`)
    } else {
      const rows = loadFromLocalFile()
      cache = buildStaffFromRows(rows)
      console.log(`[${new Date().toLocaleTimeString()}] Local file reloaded — ${cache.length} records`)
    }
  } catch (err) {
    console.error('Refresh failed:', err.message)
  } finally {
    lastChecked = new Date().toISOString()
  }
}

async function getData() {
  if (!cache) await checkAndRefresh()
  return cache
}

// Check every 10 seconds — lightweight metadata call, downloads only on change
function startBackgroundRefresh() {
  setInterval(checkAndRefresh, 10_000)
  console.log('Smart refresh: checking OneDrive every 10s, downloading only on change')
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/phncft/api/staff/:empNo', async (req, res) => {
  try {
    const empNo = req.params.empNo.toUpperCase().trim()
    const data  = await getData()
    const found = data.find(s => s.empNo.toUpperCase() === empNo)
    if (!found) return res.status(404).json({ error: 'Staff not found' })
    res.json(found)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// Force immediate reload
app.post('/phncft/api/reload', async (_req, res) => {
  try {
    lastModified = null  // force re-download even if file hasn't changed
    await checkAndRefresh()
    res.json({ message: 'Reloaded', count: cache?.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Status — shows when data was last loaded and file last modified
app.get('/phncft/api/status', (_req, res) => {
  res.json({ lastChecked, lastModified, records: cache?.length ?? 0 })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, async () => {
  console.log(`CFT Portal API → http://localhost:${PORT}`)
  await checkAndRefresh()   // initial load on startup
  startBackgroundRefresh()  // then keep refreshing silently
})
