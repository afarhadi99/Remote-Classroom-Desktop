import { ImageResponse } from 'next/og'

export const alt = 'Remote Classroom — a real desktop for every student, in any browser.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px 96px',
          background: '#fcf9f5',
          position: 'relative',
        }}
      >
        {/* faint cobalt corner accent */}
        <div
          style={{
            position: 'absolute',
            top: -180,
            right: -180,
            width: 520,
            height: 520,
            borderRadius: 9999,
            background: '#eaf0fd',
            display: 'flex',
          }}
        />

        {/* brand mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 18,
              background: '#201e1a',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{ width: '100%', height: 11, background: '#1d5ad2', display: 'flex' }} />
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="5" width="18" height="12" rx="1.5" stroke="#fcf9f5" strokeWidth="1.9" />
                <path d="M9 21h6M12 17v4" stroke="#fcf9f5" strokeWidth="1.9" strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 600, color: '#201e1a', letterSpacing: -0.5 }}>
            Remote Classroom
          </div>
        </div>

        {/* headline */}
        <div
          style={{
            display: 'flex',
            marginTop: 56,
            fontSize: 66,
            fontWeight: 600,
            lineHeight: 1.08,
            letterSpacing: -1.5,
            color: '#201e1a',
            maxWidth: 920,
          }}
        >
          A real computer for every student, in any browser.
        </div>

        {/* tagline */}
        <div
          style={{
            display: 'flex',
            marginTop: 28,
            fontSize: 28,
            color: '#6b6357',
            maxWidth: 820,
          }}
        >
          Full Linux or Windows cloud desktops, streamed straight to a Chromebook. Powered by Daytona.
        </div>
      </div>
    ),
    { ...size },
  )
}
