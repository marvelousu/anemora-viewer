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

const SWIPE_TRIGGER = 80; // px to commit
const HORIZONTAL_THRESHOLD = 20; // px before we decide "this is horizontal"
const VERTICAL_ABORT = 12; // if vertical exceeds this before horizontal is detected, abort

export default function AlbumGrid({ images, prevHref, nextHref }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const isHorizontal = useRef(false);
  const aborted = useRef(false);
  const dx = useRef(0);

  useEffect(() => {
    if (!ref.current) return;
    const lightbox = new PhotoSwipeLightbox({
      gallery: ref.current,
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

  function reset() {
    isHorizontal.current = false;
    aborted.current = false;
    dx.current = 0;
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== 'touch') return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    reset();
  }

  function onPointerMove(e: React.PointerEvent) {
    if (e.pointerType !== 'touch' || aborted.current) return;
    const cdx = e.clientX - startX.current;
    const cdy = e.clientY - startY.current;
    if (!isHorizontal.current) {
      if (Math.abs(cdy) > VERTICAL_ABORT) {
        aborted.current = true;
        return;
      }
      if (Math.abs(cdx) > HORIZONTAL_THRESHOLD && Math.abs(cdx) > Math.abs(cdy) * 1.5) {
        isHorizontal.current = true;
      }
    }
    dx.current = cdx;
    if (isHorizontal.current) {
      e.preventDefault();
    }
  }

  function onPointerEnd(e: React.PointerEvent) {
    if (e.pointerType !== 'touch') return;
    const committed = isHorizontal.current && !aborted.current && Math.abs(dx.current) > SWIPE_TRIGGER;
    if (committed) {
      if (dx.current > 0 && prevHref) {
        window.location.href = prevHref;
      } else if (dx.current < 0 && nextHref) {
        window.location.href = nextHref;
      }
    }
    reset();
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      style={{ touchAction: 'pan-y' }}
    >
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
      <div ref={ref} className="grid grid-cols-3 gap-1 p-1">
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
