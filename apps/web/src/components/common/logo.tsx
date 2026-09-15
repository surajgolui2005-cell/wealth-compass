import React from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface LogoProps {
  size?: number;
  showText?: boolean;
  textClassName?: string;
  className?: string;
  href?: string;
  priority?: boolean;
}

export function Logo({
  size = 32,
  showText = false,
  textClassName,
  className,
  href,
  priority = false,
}: LogoProps) {
  const content = (
    <div className={cn("flex items-center gap-2.5 select-none", className)}>
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
        <span
          className={cn(
            "font-bold tracking-tight text-foreground font-sans",
            size >= 40 ? "text-2xl" : size >= 32 ? "text-lg" : "text-base",
            textClassName,
          )}
        >
          Wealth Compass
        </span>
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
