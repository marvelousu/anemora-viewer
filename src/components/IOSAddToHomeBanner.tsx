import { useEffect, useState } from 'react';

const DISMISS_KEY = 'viewer.ios-banner-dismissed';

export default function IOSAddToHomeBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isIOS && !standalone) setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-2 right-2 z-30">
      <div className="bg-bg border border-border rounded-2xl shadow-xl p-3 text-sm flex items-start gap-3">
        <div className="flex-1">
          <div className="font-semibold mb-1">Add to Home Screen</div>
          <div className="text-fg-subtle text-xs leading-snug">
            Tap the Share button, then "Add to Home Screen" to use this in full-screen mode.
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, '1');
            setShow(false);
          }}
          aria-label="Dismiss"
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-bg-subtle shrink-0"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
