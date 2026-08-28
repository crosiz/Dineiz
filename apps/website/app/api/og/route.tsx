import { ImageResponse } from '@vercel/og'

export const runtime = 'edge'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title') ?? 'Dineiz — Restaurant POS System Pakistan'
  const subtitle = searchParams.get('subtitle') ?? 'Offline-First POS • QR Menu • WhatsApp Ordering • Multi-Branch Analytics'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          backgroundColor: '#FFFFFF',
          fontFamily: 'sans-serif',
          backgroundImage: 'radial-gradient(circle at 100% 0%, rgba(255, 107, 53, 0.08) 0%, transparent 50%), radial-gradient(circle at 0% 100%, rgba(230, 57, 70, 0.05) 0%, transparent 40%)',
        }}
      >
        {/* Top Header Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: '#FF6B35',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontSize: '24px',
                fontWeight: 'bold',
              }}
            >
              D
            </div>
            <span style={{ fontSize: '32px', fontWeight: '800', color: '#1D1D1F', letterSpacing: '-0.02em' }}>
              Dineiz
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 18px',
              borderRadius: '999px',
              backgroundColor: '#F5F5F7',
              border: '1px solid #E5E5EA',
              color: '#C04417',
              fontSize: '15px',
              fontWeight: '700',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            Restaurant POS
          </div>
        </div>

        {/* Middle: Title & Description */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1040px' }}>
          <h1
            style={{
              fontSize: title.length > 50 ? '52px' : '62px',
              fontWeight: '800',
              color: '#1D1D1F',
              lineHeight: 1.12,
              letterSpacing: '-0.03em',
              margin: 0,
            }}
          >
            {title}
          </h1>

          <p
            style={{
              fontSize: '24px',
              color: '#6E6E73',
              lineHeight: 1.4,
              margin: 0,
            }}
          >
            {subtitle}
          </p>
        </div>

        {/* Bottom Bar: Feature Pills & Domain */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '28px',
            borderTop: '1px solid #E5E5EA',
          }}
        >
          <div style={{ display: 'flex', gap: '12px' }}>
            <div
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: '#F5F5F7',
                color: '#1D1D1F',
                fontSize: '16px',
                fontWeight: '600',
              }}
            >
              ⚡ 100% Offline POS
            </div>
            <div
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: '#F5F5F7',
                color: '#1D1D1F',
                fontSize: '16px',
                fontWeight: '600',
              }}
            >
              📱 QR & WhatsApp
            </div>
            <div
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: '#F5F5F7',
                color: '#1D1D1F',
                fontSize: '16px',
                fontWeight: '600',
              }}
            >
              🍳 Kitchen Display (KDS)
            </div>
          </div>

          <span style={{ fontSize: '20px', fontWeight: '700', color: '#1D1D1F' }}>
            dineiz.com
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
