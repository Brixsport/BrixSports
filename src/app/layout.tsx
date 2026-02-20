import type { Metadata, Viewport } from "next";
import "./globals.css";
import VisualEditsMessenger from "../visual-edits/VisualEditsMessenger";
import ErrorReporter from "@/components/ErrorReporter";
import Script from "next/script";
import { BottomNav } from "@/components/BottomNav";
import { PWAProvider } from "@/components/pwa/PWAProvider";
import SessionProvider from "@/components/providers/SessionProvider";
import { NotificationProvider } from "@/components/NotificationProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";
import { SocketProvider } from "@/hooks/useWebSocket";

export const metadata: Metadata = {
  title: "Brixsport | Nigerian University Sports Live",
  description: "Real-time scoring and sports management for Nigerian universities.",
  manifest: "/manifest-user.json",
  icons: {
    icon: '/assests/Logos/BRIX-SPORT-LOGO.png',
    apple: '/assests/Logos/BRIX-SPORT-LOGO.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Brixsport",
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
        <link rel="icon" href="/assests/Logos/BRIX-SPORT-LOGO.png" type="image/png" />
        <link rel="apple-touch-icon" href="/assests/Logos/BRIX-SPORT-LOGO.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Brixsport" />
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
