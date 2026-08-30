import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Login from './Login'
import './styles.css'
import './map-interactions.css'
import './login.css'

function Root() {
  const [authenticated, setAuthenticated] = useState(false)

  if (!authenticated) {
    return <Login onLogin={() => setAuthenticated(true)} />
  }

  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
