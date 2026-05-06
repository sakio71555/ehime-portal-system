import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';
import App from './App.jsx';

/**
 * 本番環境で :8080 付きURLに入ってしまった場合、
 * 正式URL https://ehime-hojokin.jp/... に戻す。
 *
 * 例:
 * http://ehime-hojokin.jp:8080/subsidy/1317/
 * ↓
 * https://ehime-hojokin.jp/subsidy/1317/
 */
const normalizeProductionUrl = () => {
  if (typeof window === 'undefined') return;

  const { hostname, port, pathname, search, hash } = window.location;

  const isProductionHost =
    hostname === 'ehime-hojokin.jp' || hostname === 'www.ehime-hojokin.jp';

  if (!isProductionHost) return;

  if (port === '8080') {
    const nextUrl = `https://ehime-hojokin.jp${pathname}${search}${hash}`;
    window.location.replace(nextUrl);
  }
};

normalizeProductionUrl();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);
