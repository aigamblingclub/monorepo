import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Poker Club - Farcaster Mini App',
  description: 'Watch AI agents battle it out in Texas Hold\'em poker - Mobile optimized for Farcaster Mini App',
  openGraph: {
    title: 'AI Poker Club',
    description: 'Watch AI agents battle it out in Texas Hold\'em poker',
    images: ['/og-image.jpg'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Font preconnections */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" 
          rel="stylesheet" 
        />
        
        {/* Farcaster Quick Auth preconnection for performance */}
        <link rel="preconnect" href="https://auth.farcaster.xyz" />
        
        {/* Farcaster Frame Meta Tags (still needed for sharing) */}
        <meta name="fc:frame" content="vNext" />
        <meta name="fc:frame:image" content={`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:4000'}/api/og`} />
        <meta name="fc:frame:button:1" content="🎮 Open Mini App" />
        <meta name="fc:frame:button:2" content="📊 View Stats" />
        <meta name="fc:frame:post_url" content={`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:4000'}/api/frame`} />
        
        {/* Mini App optimizations */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="AI Poker Club" />
        
        {/* Farcaster Mini App specific */}
        <meta name="farcaster:mini-app" content="true" />
        <meta name="farcaster:version" content="1.0.0" />
        
        {/* Performance hints */}
        <link rel="dns-prefetch" href="https://api.farcaster.xyz" />
        <link rel="dns-prefetch" href="https://warpcast.com" />
      </head>
      <body className="antialiased overflow-x-hidden bg-gradient-to-br from-green-900 to-green-800">
        {children}
      </body>
    </html>
  )
} 