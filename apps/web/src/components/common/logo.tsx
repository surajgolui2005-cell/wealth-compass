import React from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface LogoProps {
  size?: number;
  showText?: boolean;
  showTagline?: boolean;
  textClassName?: string;
  className?: string;
  href?: string;
  priority?: boolean;
}

export function Logo({
  size = 32,
  showText = false,
  showTagline = false,
  textClassName,
  className,
  href,
  priority = false,
}: LogoProps) {
  const content = (
    <div className={cn("flex items-center gap-3 select-none", className)}>
      <div
        className="relative flex items-center justify-center rounded-xl overflow-hidden shadow-sm transition-transform hover:scale-105"
        style={{ width: size, height: size }}
      >
        <Image
          src="/logo.png"
          alt="Wealth Compass Logo"
          width={size}
          height={size}
          priority={priority}
          className="object-contain w-full h-full"
        />
      </div>
      {showText && (
        <div className="flex flex-col">
          <span
            className={cn(
              "font-extrabold tracking-tight font-sans leading-none",
              size >= 40 ? "text-2xl" : size >= 32 ? "text-lg" : "text-base",
              textClassName,
            )}
          >
            <span className="text-[#003B7A] dark:text-white">Wealth</span>
            <span className="text-[#00A99D] dark:text-[#6DD5A3]">Compass</span>
          </span>
          {showTagline && (
            <span className="text-[9px] font-bold tracking-widest text-[#2D3E50]/70 dark:text-[#6DD5A3]/80 uppercase mt-1">
              Plan Smarter • Grow Further
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
      >
        {content}
      </Link>
    );
  }

  return content;
}
