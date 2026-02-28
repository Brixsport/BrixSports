import type { Metadata, Viewport } from "next";
import "./globals.css";
import VisualEditsMessenger from "../visual-edits/VisualEditsMessenger";
import ErrorReporter from "@/components/ErrorReporter";
import Script from "next/script";
import { BottomNav } from "@/components/BottomNav";
import { PWAProvider } from "@/components/pwa/PWAProvider";
import SessionProvider from "@/components/providers/SessionProvider";
import { NotificationProvider } from "@/components/Notifications";
import { GlobalNotificationListener } from "@/components/GlobalNotificationListener";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";
import { SocketProvider } from "@/hooks/useWebSocket";

export const metadata: Metadata = {
  title: {
    default: "BRIXSPORTS | Nigerian University Sports Live",
    template: "%s | BRIXSPORTS"
  },
  description: "Real-time scoring, live match updates, and comprehensive sports management for Nigerian universities. Follow NUGA, NPUGA, BUSA LEAGUE, BUCS, and university sports competitions with BRIXSPORTS.",
  keywords: [
    "Nigerian university sports",
    "NUGA",
    "NPUGA",
    "university football",
    "university basketball",
    "live scores",
    "sports management",
    "Nigeria sports",
    "campus sports",
    "student athletics",
    "university competitions",
    "sports livestream",
    "match results",
    "team standings",
    "player statistics"
  ],
  authors: [{ name: "BRIXSPORTS Team" }],
  creator: "BRIXSPORTS",
  publisher: "BRIXSPORTS",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: "https://brixsports.com",
    siteName: "BRIXSPORTS",
    title: "BRIXSPORTS | Nigerian University Sports Live",
    description: "Real-time scoring and sports management for Nigerian universities. Follow NUGA, NPUGA, BUSA LEAGUE, BUCS, and campus sports competitions.",
    images: [
      {
        url: "/assets/Logos/BRIX-SPORT-LOGO.png",
        width: 1200,
        height: 630,
        alt: "BRIXSPORTS - Nigerian University Sports",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BRIXSPORTS | Nigerian University Sports Live",
    description: "Real-time scoring and sports management for Nigerian universities.",
    images: ["/assets/Logos/BRIX-SPORT-LOGO.png"],
    creator: "@brixsports",
  },
  alternates: {
    canonical: "https://brixsports.com",
  },
  manifest: "/manifest-user.json",
  icons: {
    icon: [
      { url: '/assests/Logos/BRIX-SPORT-LOGO.png', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/assests/Logos/BRIX-SPORT-LOGO.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BRIXSPORTS",
  },
  other: {
    'google-site-verification': 'googlefd0ce86c5ed02ba9.html',
    'msvalidate.01': '',
  },
};

export const viewport: Viewport = {
  themeColor: "#8b5cf6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/assests/Logos/BRIX-SPORT-LOGO.png" type="image/png" sizes="any" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/assests/Logos/BRIX-SPORT-LOGO.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="BRIXSPORTS" />
      </head>
      <body className="antialiased">
        <Script
          id="orchids-browser-logs"
          src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/scripts/orchids-browser-logs.js"
          strategy="lazyOnload"
          data-orchids-project-id="014126df-de10-4764-9819-95edd7099944"
        />
        <ErrorReporter />
        <Script
          src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/scripts//route-messenger.js"
          strategy="lazyOnload"
          data-target-origin="*"
          data-message-type="ROUTE_CHANGE"
          data-include-search-params="true"
          data-only-in-iframe="true"
          data-debug="true"
          data-custom-data='{"appName": "YourApp", "version": "1.0.0", "greeting": "hi"}'
        />
        <PWAProvider swPath="/sw-user.js">
          <SessionProvider>
            <AuthProvider>
              <NotificationProvider>
                <SocketProvider>
                  <GlobalNotificationListener />
                  {children}
                  <BottomNav />
                  <AuthModal />
                </SocketProvider>
              </NotificationProvider>
            </AuthProvider>
          </SessionProvider>
        </PWAProvider>
        <VisualEditsMessenger />
      </body>
    </html>
  );
}
