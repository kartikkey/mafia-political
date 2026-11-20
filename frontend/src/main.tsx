import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { store } from 'store'
import { gameSocket } from 'api/gameSocket'
import App from './App'
import 'assets/scss/global.scss'
import 'common/components/components.scss'

// Dev-only hook for the e2e acceptance script (this client's own view + socket; no hidden server state).
if (import.meta.env.DEV) Object.assign(window, { __netagiri: { store, socket: gameSocket } })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
)
