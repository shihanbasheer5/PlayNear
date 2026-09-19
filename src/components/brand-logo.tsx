import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  href?: string | null;
}

export function BrandLogo({
  className,
  size = "md",
  showText = true,
  href = "/",
}: BrandLogoProps) {
  const iconDimensions = {
    sm: { img: 28, box: "h-7 w-7", text: "text-lg" },
    md: { img: 36, box: "h-9 w-9", text: "text-xl" },
    lg: { img: 48, box: "h-12 w-12", text: "text-2xl" },
  }[size];

  const content = (
    <div className={cn("flex items-center gap-2.5 font-extrabold tracking-tight", className)}>
      <div className={cn("relative shrink-0 flex items-center justify-center transition-transform hover:scale-105", iconDimensions.box)}>
        <Image
          src="/logo.png"
          alt="PlayNear Logo"
          width={iconDimensions.img}
          height={iconDimensions.img}
          className="object-contain drop-shadow-sm"
          priority
        />
      </div>
      {showText && (
        <span className={cn("font-black tracking-tight flex items-center", iconDimensions.text)}>
          <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-600 bg-clip-text text-transparent">
            Play
          </span>
          <span className="text-foreground">Near</span>
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center group">
        {content}
      </Link>
    );
  }

  return content;
}
