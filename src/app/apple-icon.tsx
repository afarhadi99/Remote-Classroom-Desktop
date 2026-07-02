import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// iOS applies its own rounded-square mask, so this fills edge-to-edge.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#201e1a',
        }}
      >
        <div style={{ width: '100%', height: 26, background: '#1d5ad2', display: 'flex' }} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="112" height="112" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5" width="18" height="12" rx="1.5" stroke="#fcf9f5" strokeWidth="1.8" />
            <path d="M9 21h6M12 17v4" stroke="#fcf9f5" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    ),
    { ...size },
  )
}
