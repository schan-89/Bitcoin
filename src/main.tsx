import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 앱이 정상적으로 떴다는 뜻이니, index.html의 1회성 asset-오류 자동새로고침 방지 플래그를 해제한다.
sessionStorage.removeItem('gamnja-reload-on-asset-error')
