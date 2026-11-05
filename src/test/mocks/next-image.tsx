"use client";

// Mock for next/image in Vitest (jsdom) environment
import React from "react";

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string;
    alt?: string;
    width?: number | string;
    height?: number | string;
    priority?: boolean;
    fill?: boolean;
    className?: string;
}

export const Image = React.forwardRef<HTMLImageElement, ImageProps>(
    (
        { src, alt, width, height, className, ...props },
        ref,
    ) => {
        return (
            <img
                ref={ref}
                src={src}
                alt={alt ?? ""}
                width={width}
                height={height}
                className={className}
                {...props}
            />
        );
    },
);

Image.displayName = "NextImage";
