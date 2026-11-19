export interface BrowserAudioEnvironment {
  isInAppBrowser: boolean;
  inAppName: string | null;
  canRecord: boolean;
  isSecureContext: boolean;
  reason: string | null;
}

const IN_APP_PATTERNS: Array<{ regex: RegExp; name: string }> = [
  { regex: /WhatsApp/i, name: "WhatsApp" },
  { regex: /FBAN|FBAV|FB_IAB/i, name: "Facebook" },
  { regex: /Instagram/i, name: "Instagram" },
  { regex: /Messenger/i, name: "Messenger" },
  { regex: /BytedanceWebview|TikTok/i, name: "TikTok" },
  { regex: /Line\//i, name: "LINE" },
  { regex: /Snapchat/i, name: "Snapchat" },
];

export function detectBrowserAudioEnvironment(): BrowserAudioEnvironment {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      isInAppBrowser: false,
      inAppName: null,
      canRecord: true,
      isSecureContext: true,
      reason: null,
    };
  }

  const ua = navigator.userAgent || "";
  const matchedApp = IN_APP_PATTERNS.find((entry) => entry.regex.test(ua));
  const isInAppBrowser = Boolean(matchedApp);
  const isSecureContext = window.isSecureContext !== false;
  const hasMediaDevices = Boolean(navigator.mediaDevices?.getUserMedia);
  const hasMediaRecorder = typeof window.MediaRecorder !== "undefined";
  const canRecord = isSecureContext && hasMediaDevices && hasMediaRecorder;

  let reason: string | null = null;
  if (!isSecureContext) {
    reason =
      "Microphone recording requires a secure HTTPS connection. Open this link over HTTPS in Chrome or Safari.";
  } else if (isInAppBrowser) {
    reason = `You opened this link inside ${matchedApp?.name}'s built-in browser, which often blocks microphone recording. Tap the menu and choose "Open in Chrome" or "Open in Safari".`;
  } else if (!hasMediaDevices || !hasMediaRecorder) {
    reason =
      "This browser does not support direct microphone recording. Open this link in Chrome or Safari, or upload a pre-recorded .mp3/.mp4/.webm clip.";
  }

  return {
    isInAppBrowser,
    inAppName: matchedApp?.name ?? null,
    canRecord,
    isSecureContext,
    reason,
  };
}
