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
};

export default function AlbumGrid({ images }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

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

  return (
    <div ref={ref} className="grid grid-cols-3 gap-1 p-1">
      {images.map((img) => {
        // For width/height 0 (e.g. SVG or sharp failure), fall back to 1024
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
  );
}
