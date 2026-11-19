"use client";

import { useState, useSyncExternalStore } from "react";
import { AlertTriangle, Check, Copy } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  detectBrowserAudioEnvironment,
  type BrowserAudioEnvironment,
} from "@/lib/audio/environment";

const SERVER_ENV: BrowserAudioEnvironment = {
  isInAppBrowser: false,
  inAppName: null,
  canRecord: true,
  isSecureContext: true,
  reason: null,
};

let cachedClientEnv: BrowserAudioEnvironment | null = null;

function getClientEnv(): BrowserAudioEnvironment {
  if (!cachedClientEnv) {
    cachedClientEnv = detectBrowserAudioEnvironment();
  }
  return cachedClientEnv;
}

function subscribeNoop(): () => void {
  return () => {};
}

export function WebViewWarningBanner() {
  const env = useSyncExternalStore(
    subscribeNoop,
    getClientEnv,
    () => SERVER_ENV
  );
  const [copied, setCopied] = useState(false);

  if (!env.isInAppBrowser && env.canRecord) {
    return null;
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: ignore if clipboard is blocked inside WebView
    }
  };

  return (
    <Alert
      variant="destructive"
      className="border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
    >
      <AlertTriangle className="size-4" aria-hidden="true" />
      <AlertTitle className="font-semibold">
        Open in Chrome or Safari for best recording
      </AlertTitle>
      <AlertDescription className="mt-1 flex flex-col gap-3 text-sm">
        <p>{env.reason}</p>
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="min-h-10 border-amber-600/40 bg-background text-foreground"
          >
            {copied ? (
              <>
                <Check className="size-4" aria-hidden="true" />
                Link Copied
              </>
            ) : (
              <>
                <Copy className="size-4" aria-hidden="true" />
                Copy Link to Open in Browser
              </>
            )}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
