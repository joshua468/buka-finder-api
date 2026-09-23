import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/fraunces'
import '@fontsource-variable/plus-jakarta-sans'
import './index.css'
import App from './App.jsx'
import { applyTokens } from './lib/tokens.js'

applyTokens()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)