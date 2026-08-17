"use client";

// BACKLOG-155: shared gate for admin panels that need to respect the
// Settings page's Feature Flags toggles. Client components can't call
// src/lib/featureFlags.ts's server-only isFeatureEnabled() directly, so this
// hits the public GET /api/feature-flags read surface instead.

import { useEffect, useState } from "react";
import { ShieldOff } from "lucide-react";

interface FeatureGateProps {
  flagKey: string;
  featureName: string;
  children: React.ReactNode;
}

export function FeatureGate({
  flagKey,
  featureName,
  children,
}: FeatureGateProps) {
  const [status, setStatus] = useState<"loading" | "enabled" | "disabled">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/feature-flags")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setStatus(data?.flags?.[flagKey] === false ? "disabled" : "enabled");
      })
      .catch(() => {
        // Fail open on a network error -- same reasoning as the API route
        // and isFeatureEnabled() itself: a check that can't complete must
        // never be the reason a feature disappears.
        if (!cancelled) setStatus("enabled");
      });
    return () => {
      cancelled = true;
    };
  }, [flagKey]);

  if (status === "loading") return null;

  if (status === "disabled") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-4">
          <ShieldOff className="mx-auto text-white/30" size={48} />
          <h1 className="text-xl font-bold text-white">
            {featureName} is temporarily disabled
          </h1>
          <p className="text-sm text-white/50">
            Re-enable it from Admin &rarr; Settings &rarr; Feature Flags.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
