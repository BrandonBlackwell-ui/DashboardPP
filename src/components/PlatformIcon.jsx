import { C } from '../utils/helpers';

export default function PlatformIcon({ platform, size = 18 }) {
  const p = (platform || '').toLowerCase();
  const box = { width:size, height:size, flex:'none', display:'inline-flex', alignItems:'center', justifyContent:'center' };
  if (p === 'facebook') {
    return (
      <span style={box} aria-label="Facebook">
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <circle cx="12" cy="12" r="11" fill="#1877F2" />
          <path fill="#fff" d="M14.86 12.66h-1.9V20h-3.05v-7.34H8.36v-2.6h1.55V8.38c0-1.2.57-3.08 3.08-3.08l2.26.01v2.52h-1.64c-.27 0-.65.13-.65.71v1.52h2.33l-.43 2.6Z" />
        </svg>
      </span>
    );
  }
  if (p === 'instagram') {
    return (
      <span style={box} aria-label="Instagram">
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <defs>
            <linearGradient id="igGradient" x1="4" x2="20" y1="20" y2="4" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FEDA75" />
              <stop offset="0.35" stopColor="#FA7E1E" />
              <stop offset="0.62" stopColor="#D62976" />
              <stop offset="1" stopColor="#4F5BD5" />
            </linearGradient>
          </defs>
          <rect width="22" height="22" x="1" y="1" rx="6" fill="url(#igGradient)" />
          <rect x="6.1" y="6.1" width="11.8" height="11.8" rx="3.6" fill="none" stroke="#fff" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="3" fill="none" stroke="#fff" strokeWidth="1.8" />
          <circle cx="16.25" cy="7.75" r="1.05" fill="#fff" />
        </svg>
      </span>
    );
  }
  if (p === 'tiktok') {
    return (
      <span style={box} aria-label="TikTok">
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <rect width="22" height="22" x="1" y="1" rx="5" fill="#050505" />
          <path fill="#25F4EE" d="M10.73 17.1a2.04 2.04 0 0 1-1.1.32 2.12 2.12 0 1 1 1.47-3.65V10.5a5.14 5.14 0 1 0 3.05 4.7V8.78a6.25 6.25 0 0 0 3.52 1.08V6.82a3.22 3.22 0 0 1-3.52-3.02h-3.42v13.3Z" opacity=".9" />
          <path fill="#FE2C55" d="M11.55 17.1a2.04 2.04 0 0 1-1.1.32 2.12 2.12 0 0 1-1.68-3.4 2.12 2.12 0 0 0 3.14 1.85V9.68a6.19 6.19 0 0 0 3.52 1.08V7.71a3.22 3.22 0 0 1-3.52-3.02h-.36v12.4Z" />
          <path fill="#fff" d="M11.1 17.1a2.04 2.04 0 0 1-1.1.32 2.12 2.12 0 1 1 1.47-3.65v-3.26a5.14 5.14 0 1 0 3.05 4.7V8.78a6.25 6.25 0 0 0 3.52 1.08V6.82a3.22 3.22 0 0 1-3.52-3.02H11.1v13.3Z" />
        </svg>
      </span>
    );
  }
  if (p === 'twitter' || p === 'x') {
    return (
      <span style={box} aria-label="X">
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <rect width="22" height="22" x="1" y="1" rx="5" fill="#000" />
          <path fill="#fff" d="M14.58 11.1 20.1 5h-1.31l-4.8 5.3L10.16 5H5.75l5.8 8.01L5.75 19h1.31l5.07-5.2 4.05 5.2h4.41l-6.01-7.9Zm-1.8 1.9-.59-.8-4.67-6.18h2.01l3.77 5 .59.79 4.9 6.49h-2.01l-4-5.3Z" />
        </svg>
      </span>
    );
  }
  if (p === 'google_news') {
    return (
      <span style={box} aria-label="Google News">
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <rect x="4.2" y="3.2" width="13.5" height="15.8" rx="1.8" fill="#4285F4" transform="rotate(-7 10.95 11.1)" />
          <rect x="6.2" y="5.2" width="13.5" height="15.8" rx="1.8" fill="#34A853" transform="rotate(5 12.95 13.1)" />
          <rect x="5" y="6.5" width="14" height="13.5" rx="1.7" fill="#fff" />
          <rect x="7" y="8.5" width="3.5" height="3.5" fill="#EA4335" />
          <rect x="11.5" y="8.5" width="5.5" height="1.1" fill="#4285F4" />
          <rect x="11.5" y="11" width="5.5" height="1.1" fill="#4285F4" />
          <rect x="7" y="14" width="10" height="1.1" fill="#FBBC04" />
          <rect x="7" y="16.3" width="8" height="1.1" fill="#34A853" />
        </svg>
      </span>
    );
  }
  if (p === 'youtube') {
    return (
      <span style={box} aria-label="YouTube">
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <rect x="2.2" y="5.4" width="19.6" height="13.2" rx="4" fill="#FF0000" />
          <path d="M10 9.1v5.8l5.1-2.9L10 9.1Z" fill="#fff" />
        </svg>
      </span>
    );
  }
  return <span style={{ ...box, background:C.ink }} aria-hidden="true" />;
}
