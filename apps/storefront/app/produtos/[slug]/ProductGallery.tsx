"use client";

import { useCallback, useEffect, useState } from "react";

export type GalleryImage = {
  url: string;
  alt: string;
};

export function ProductGallery({
  images,
  fallbackAlt,
}: {
  images: GalleryImage[];
  fallbackAlt: string;
}) {
  const [active, setActive] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);

  const current = images[active] ?? null;

  const openZoom = useCallback((index: number) => {
    setZoomIndex(index);
    setZoomOpen(true);
  }, []);

  const closeZoom = useCallback(() => setZoomOpen(false), []);

  const prevZoom = useCallback(() => {
    setZoomIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const nextZoom = useCallback(() => {
    setZoomIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!zoomOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeZoom();
      if (e.key === "ArrowLeft") prevZoom();
      if (e.key === "ArrowRight") nextZoom();
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [zoomOpen, closeZoom, prevZoom, nextZoom]);

  return (
    <>
      <div className="product-gallery-stack">
        <div
          className="product-gallery-card product-gallery-card--zoomable"
          onClick={() => openZoom(active)}
          title="Clique para ampliar"
        >
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.url}
              alt={current.alt || fallbackAlt}
              className="product-detail-image"
            />
          ) : (
            <div className="product-detail-image" />
          )}
          <span className="product-gallery-zoom-hint" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
            Ampliar
          </span>
        </div>

        {images.length > 1 ? (
          <div className="product-gallery-thumbs" aria-label="Galeria do produto">
            {images.map((image, index) => (
              <button
                key={`${image.url}-${index}`}
                type="button"
                className={index === active ? "is-active" : ""}
                onClick={() => setActive(index)}
                aria-label={`Ver imagem ${index + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="" aria-hidden />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* ── Lightbox / Zoom ── */}
      {zoomOpen ? (
        <div
          className="product-zoom-overlay"
          onClick={closeZoom}
          role="dialog"
          aria-modal="true"
          aria-label="Imagem ampliada"
        >
          <button
            type="button"
            className="product-zoom-close"
            onClick={closeZoom}
            aria-label="Fechar"
          >
            ✕
          </button>

          {images.length > 1 ? (
            <>
              <button
                type="button"
                className="product-zoom-nav product-zoom-nav--prev"
                onClick={(e) => { e.stopPropagation(); prevZoom(); }}
                aria-label="Imagem anterior"
              >
                ‹
              </button>
              <button
                type="button"
                className="product-zoom-nav product-zoom-nav--next"
                onClick={(e) => { e.stopPropagation(); nextZoom(); }}
                aria-label="Próxima imagem"
              >
                ›
              </button>
            </>
          ) : null}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[zoomIndex]?.url ?? current?.url ?? ""}
            alt={images[zoomIndex]?.alt || fallbackAlt}
            className="product-zoom-image"
            onClick={(e) => e.stopPropagation()}
          />

          {images.length > 1 ? (
            <div className="product-zoom-dots" onClick={(e) => e.stopPropagation()}>
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={i === zoomIndex ? "is-active" : ""}
                  onClick={() => setZoomIndex(i)}
                  aria-label={`Imagem ${i + 1}`}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
