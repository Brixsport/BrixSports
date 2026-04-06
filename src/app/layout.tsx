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
import AdBanner from "@/components/ads/AdBanner";

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
        {/* LLMs.txt - AI model discovery */}
        <link rel="alternate" type="text/plain" href="/llms.txt" title="LLM Information" />
        <link rel="alternate" type="text/plain" href="/llms-full.txt" title="LLM Full Information" />
        {/* JSON-LD: Organization + WebSite schema for AI and search engine entity understanding */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": ["Organization", "SportsOrganization"],
                  "@id": "https://brixsports.com/#organization",
                  "name": "BRIXSPORTS",
                  "alternateName": ["Brix Sport", "Brixsports", "BRIX SPORTS", "BrixSport"],
                  "url": "https://brixsports.com",
                  "logo": {
                    "@type": "ImageObject",
                    "url": "https://brixsports.com/assets/Logos/BRIX-SPORT-LOGO.png",
                    "width": 512,
                    "height": 512
                  },
                  "description": "BRIXSPORTS is Nigeria's premier digital platform for university sports, providing live scores, match streaming, player statistics, and comprehensive coverage of NUGA, NPUGA, BUCS, and university competitions. Founded at Bells University of Technology.",
                  "slogan": "Bringing Nigerian University Sports to Life",
                  "foundingDate": "2023",
                  "foundingLocation": {
                    "@type": "Place",
                    "name": "Bells University of Technology",
                    "address": "Ota, Ogun State, Nigeria"
                  },
                  "areaServed": {
                    "@type": "Country",
                    "name": "Nigeria"
                  },
                  "knowsAbout": [
                    "Nigerian University Sports",
                    "NUGA Games",
                    "NPUGA",
                    "BUSA League",
                    "BUCS Competitions",
                    "University Football Nigeria",
                    "University Basketball Nigeria",
                    "Sports Analytics",
                    "Live Sports Streaming",
                    "Bells University of Technology Sports"
                  ],
                  "sameAs": [
                    "https://twitter.com/brixsports",
                    "https://instagram.com/brixsports",
                    "https://facebook.com/brixsports"
                  ],
                  "contactPoint": {
                    "@type": "ContactPoint",
                    "contactType": "Customer Support",
                    "email": "support@brixsports.com",
                    "availableLanguage": ["English"]
                  }
                },
                {
                  "@type": "WebSite",
                  "@id": "https://brixsports.com/#website",
                  "name": "BRIXSPORTS",
                  "alternateName": "Brix Sport",
                  "url": "https://brixsports.com",
                  "publisher": { "@id": "https://brixsports.com/#organization" },
                  "potentialAction": {
                    "@type": "SearchAction",
                    "target": {
                      "@type": "EntryPoint",
                      "urlTemplate": "https://brixsports.com/search?q={search_term_string}"
                    },
                    "query-input": "required name=search_term_string"
                  }
                },
                {
                  "@type": "SoftwareApplication",
                  "name": "BRIXSPORTS",
                  "applicationCategory": "SportsApplication",
                  "operatingSystem": "Web, iOS, Android (PWA)",
                  "offers": {
                    "@type": "Offer",
                    "price": "0",
                    "priceCurrency": "NGN"
                  },
                  "featureList": [
                    "Real-time live scores",
                    "Live match streaming",
                    "Player statistics and ratings",
                    "Team management tools",
                    "Interactive lineup builder",
                    "Match predictions and leaderboards",
                    "Scout features and talent tracking",
                    "Push notifications",
                    "Live match chat"
                  ],
                  "url": "https://brixsports.com"
                }
              ]
            })
          }}
        />
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
                  <AdBanner position="top" />
                  {children}
                  <AdBanner position="bottom" />
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
