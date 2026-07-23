"use client";

import { useState } from "react";

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
  const current = images[active] ?? null;

  return (
    <div className="product-gallery-stack">
      <div className="product-gallery-card">
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
  );
}
