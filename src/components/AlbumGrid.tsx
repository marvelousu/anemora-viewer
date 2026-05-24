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

// Tuning: keep the threshold low so iOS Safari has plenty of room to decide
// the gesture is horizontal before it commits to a vertical scroll.
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
        // Required to keep the page from interpreting the gesture as a
        // vertical scroll once we've claimed it.
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

    // passive: false on touchmove is essential — without it iOS ignores
    // preventDefault() and the page just scrolls.
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
    <div ref={swipeRef} style={{ touchAction: 'pan-y' }}>
      {(prevHref || nextHref) && (
        <div className="flex items-center justify-between px-3 py-2 text-xs text-fg-subtle">
          <div>
            {prevHref ? (
              <a href={prevHref} className="no-underline inline-flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                prev
              </a>
            ) : <span>&nbsp;</span>}
          </div>
          <div className="opacity-60">swipe ←/→</div>
          <div>
            {nextHref ? (
              <a href={nextHref} className="no-underline inline-flex items-center gap-1">
                next
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </a>
            ) : <span>&nbsp;</span>}
          </div>
        </div>
      )}
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
    </div>
  );
}
