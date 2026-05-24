import { useEffect, useRef } from 'react';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';

type ImageItem = {
  filename: string;
  thumbUrl: string;
  originalUrl: string;
  width: number;
  height: number;
};

type Props = {
  images: ImageItem[];
  prevHref?: string | null;
  nextHref?: string | null;
};

const TRIGGER_DX = 60;
const HORIZONTAL_THRESHOLD = 12;
const VERTICAL_ABORT = 30;

export default function AlbumGrid({ images, prevHref, nextHref }: Props) {
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const swipeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!galleryRef.current) return;
    const lightbox = new PhotoSwipeLightbox({
      gallery: galleryRef.current,
      children: 'a[data-pswp-src]',
      pswpModule: () => import('photoswipe'),
      bgOpacity: 0.95,
      showHideAnimationType: 'fade',
    });
    lightbox.init();
    return () => {
      lightbox.destroy();
    };
  }, []);

  // iOS Safari aggressively uses the back/forward cache. After window.location
  // navigation, returning users to this page can leave React state and
  // event-listener bookkeeping in a stale state. Force a real reload so the
  // component re-initialises cleanly.
  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) {
        window.location.reload();
      }
    }
    window.addEventListener('pageshow', onPageShow as EventListener);
    return () => window.removeEventListener('pageshow', onPageShow as EventListener);
  }, []);

  useEffect(() => {
    const el = swipeRef.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let dx = 0;
    let isHorizontal = false;
    let aborted = false;

    function reset() {
      isHorizontal = false;
      aborted = false;
      dx = 0;
    }

    function onStart(e: TouchEvent) {
      if (e.touches.length !== 1) {
        aborted = true;
        return;
      }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      reset();
    }

    function onMove(e: TouchEvent) {
      if (aborted || e.touches.length !== 1) return;
      const cdx = e.touches[0].clientX - startX;
      const cdy = e.touches[0].clientY - startY;
      if (!isHorizontal) {
        if (Math.abs(cdy) > VERTICAL_ABORT) {
          aborted = true;
          return;
        }
        if (Math.abs(cdx) > HORIZONTAL_THRESHOLD && Math.abs(cdx) > Math.abs(cdy)) {
          isHorizontal = true;
        }
      }
      dx = cdx;
      if (isHorizontal) {
        e.preventDefault();
      }
    }

    function onEnd() {
      const committed = isHorizontal && !aborted && Math.abs(dx) > TRIGGER_DX;
      if (committed) {
        if (dx > 0 && prevHref) {
          window.location.href = prevHref;
        } else if (dx < 0 && nextHref) {
          window.location.href = nextHref;
        }
      }
      reset();
    }

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onStart as EventListener);
      el.removeEventListener('touchmove', onMove as EventListener);
      el.removeEventListener('touchend', onEnd as EventListener);
      el.removeEventListener('touchcancel', onEnd as EventListener);
    };
  }, [prevHref, nextHref]);

  return (
    <div ref={swipeRef} style={{ touchAction: 'pan-y' }} className="pb-16">
      <div ref={galleryRef} className="grid grid-cols-3 gap-1 p-1">
        {images.map((img) => {
          const w = img.width || 1024;
          const h = img.height || 1024;
          return (
            <a
              key={img.filename}
              href={img.originalUrl}
              data-pswp-src={img.originalUrl}
              data-pswp-width={w}
              data-pswp-height={h}
              className="block aspect-square overflow-hidden bg-bg-subtle rounded"
            >
              <img
                src={img.thumbUrl}
                alt={img.filename}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            </a>
          );
        })}
      </div>

      {(prevHref || nextHref) && (
        <div
          className="fixed left-0 right-0 z-20 bg-bg/95 backdrop-blur border-t border-border"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 56px)' }}
          role="navigation"
          aria-label="Album navigation"
        >
          <div className="flex items-stretch h-12">
            {prevHref ? (
              <a
                href={prevHref}
                className="flex-1 flex items-center justify-center gap-2 text-sm text-fg no-underline active:bg-bg-subtle"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                <span>prev album</span>
              </a>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-fg-subtle/40">
                <span>—</span>
              </div>
            )}
            <div className="w-px bg-border" />
            {nextHref ? (
              <a
                href={nextHref}
                className="flex-1 flex items-center justify-center gap-2 text-sm text-fg no-underline active:bg-bg-subtle"
              >
                <span>next album</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </a>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-fg-subtle/40">
                <span>—</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
