"use client";

import Image from "next/image";
import { useState } from "react";

type ProductScreenImageProps = {
  src: string;
  fallbackSrc: string;
  alt: string;
  priority: boolean;
};

export function ProductScreenImage({ src, fallbackSrc, alt, priority }: ProductScreenImageProps) {
  const [imageSrc, setImageSrc] = useState(src);

  return (
    <Image
      src={imageSrc}
      alt={alt}
      priority={priority}
      loading={priority ? undefined : "lazy"}
      width={1206}
      height={2622}
      sizes="(max-width: 620px) 66vw, 238px"
      quality={68}
      onError={() => {
        if (imageSrc !== fallbackSrc) setImageSrc(fallbackSrc);
      }}
    />
  );
}
