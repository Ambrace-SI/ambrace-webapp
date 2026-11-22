"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";

import { ThemeSync } from "@/components/theme/theme-sync";
import { setTokenGetter, setUnauthorizedHandler } from "@/lib/api/axios";
import { isWorthRetrying } from "@/lib/api/errors";
import { ME_PATH } from "@/lib/api/me";
import { configureAuth, getAccessToken } from "@/lib/auth/client";
import { ME_KEY } from "@/lib/hooks/use-me";

// Runs once, when the browser first loads the app, before any component asks
// for data. Every API call then picks up a fresh access token by itself.
if (typeof window !== "undefined") {
  configureAuth();
  setTokenGetter(getAccessToken);
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            // A 401 or 404 will not fix itself; only retry what might.
            retry: (failureCount, error) =>
              isWorthRetrying(error) && failureCount < 2,
          },
        },
      }),
  );

  // Any API call refused as signed-out asks for the profile again. If that is
  // refused too, the session really has ended and the gate around every
  // signed-in screen returns the student to sign-in. One place decides, so a
  // single stray 401 never throws anyone out by itself.
  useEffect(() => {
    setUnauthorizedHandler((path) => {
      if (path === ME_PATH) return;
      void queryClient.invalidateQueries({ queryKey: ME_KEY });
    });
    return () => setUnauthorizedHandler(null);
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeSync />
      {children}
    </QueryClientProvider>
  );
}
