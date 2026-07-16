"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

type ClinicImageProps = Omit<ImageProps, "onError">;

export function ClinicImage(props: ClinicImageProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  const { alt, ...imageProps } = props;
  return <Image alt={alt} {...imageProps} onError={() => setFailed(true)} />;
}
