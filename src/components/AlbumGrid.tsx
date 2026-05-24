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

export default function AlbumGrid({ images, prevHref, nextHref }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);

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

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  }

  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - startX.current;
    const dy = e.changedTouches[0].clientY - startY.current;
    // Horizontal swipe with at least 80px and dominant over vertical
    if (Math.abs(dx) < 80 || Math.abs(dy) > Math.abs(dx)) return;
    if (dx > 0 && prevHref) {
      window.location.href = prevHref;
    } else if (dx < 0 && nextHref) {
      window.location.href = nextHref;
    }
  }

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
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
          <div>swipe ←/→</div>
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
