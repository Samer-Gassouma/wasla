import { useCallback, useEffect, useMemo, useState } from 'react'
import './index.css'
import InitScreen from '@/components/InitScreen'
import LoginScreen from '@/components/LoginScreen'
import { setAuthToken } from '@/api/client'
import MainPage from '@/components/MainPage'

function App() {
  const [stage, setStage] = useState<'init' | 'login' | 'app'>('init')
  const [token, setToken] = useState<string | null>(null)

  const handleInitReady = useCallback(() => setStage('login'), [])
  const handleLoggedIn = useCallback((t: string, staffInfo: { firstName: string; lastName: string }) => {
    setToken(t)
    setAuthToken(t)
    setStage('app')
  }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('authToken')
      if (saved) {
        setToken(saved)
        setAuthToken(saved)
        setStage('app')
      }
    } catch {}
  }, [])

  const screen = useMemo(() => {
    if (stage === 'init') return <InitScreen onReady={handleInitReady} />
    if (stage === 'login') return <LoginScreen onLoggedIn={handleLoggedIn} />
    return (
      <MainPage />
    )
  }, [stage, handleInitReady, handleLoggedIn, token])

  return screen
}

export default App
