import { ImageResponse } from '@vercel/og'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title') ?? 'Dineiz — Restaurant POS Pakistan'
  const subtitle = searchParams.get('subtitle') ?? ''

  return new ImageResponse(
    <div
      style={{
        background: 'linear-gradient(135deg, #FF6B35 0%, #E63946 100%)',
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'flex-start', justifyContent: 'flex-end',
        padding: '80px',
      }}
    >
      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 28, marginBottom: 16, fontFamily: 'Inter' }}>
        Dineiz
      </div>
      <div style={{ color: 'white', fontSize: 64, fontWeight: 700, lineHeight: 1.1, fontFamily: 'Inter', maxWidth: 900 }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 32, marginTop: 24, fontFamily: 'Inter' }}>
          {subtitle}
        </div>
      )}
      <div style={{ position: 'absolute', top: 80, right: 80, color: 'rgba(255,255,255,0.6)', fontSize: 24 }}>
        dineiz.com
      </div>
    </div>,
    { width: 1200, height: 630 }
  )
}
