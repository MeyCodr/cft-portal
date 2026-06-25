import { useState, useEffect, useRef } from 'react'
import LoginPage from './components/LoginPage'
import DashboardPage from './components/DashboardPage'

export default function App() {
  const [page, setPage] = useState('login')
  const [staffData, setStaffData] = useState(null)
  const intervalRef = useRef(null)

  const fetchStaff = async (empNo) => {
    const res = await fetch(`/phncft/api/staff/${encodeURIComponent(empNo)}`)
    if (res.ok) setStaffData(await res.json())
  }

  // Restore session on page refresh
  useEffect(() => {
    const savedEmpNo = sessionStorage.getItem('cft_empNo')
    if (savedEmpNo) {
      fetch(`/phncft/api/staff/${encodeURIComponent(savedEmpNo)}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) { setStaffData(data); setPage('dashboard') }
          else sessionStorage.removeItem('cft_empNo')
        })
        .catch(() => sessionStorage.removeItem('cft_empNo'))
    }
  }, [])

  // Auto-refresh every 10 seconds while on dashboard
  useEffect(() => {
    if (page === 'dashboard' && staffData) {
      intervalRef.current = setInterval(() => fetchStaff(staffData.empNo), 10_000)
    }
    return () => clearInterval(intervalRef.current)
  }, [page, staffData?.empNo])

  const handleLogin = (data) => {
    sessionStorage.setItem('cft_empNo', data.empNo)
    setStaffData(data)
    setPage('dashboard')
  }

  const handleBack = () => {
    sessionStorage.removeItem('cft_empNo')
    clearInterval(intervalRef.current)
    setStaffData(null)
    setPage('login')
  }

  if (page === 'dashboard' && staffData) {
    return <DashboardPage data={staffData} onBack={handleBack} />
  }
  return <LoginPage onLogin={handleLogin} />
}
