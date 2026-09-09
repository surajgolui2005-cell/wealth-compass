"use client";

import { ExternalLink } from "lucide-react";
import { getBrokerConfig } from "@/lib/broker-config";
import { cn } from "@/lib/utils";

interface PlatformBadgeProps {
  providerCode: string | null | undefined;
  symbol?: string;
  size?: "sm" | "md";
  className?: string;
}

export function PlatformBadge({
  providerCode,
  symbol,
  size = "sm",
  className,
}: PlatformBadgeProps) {
  const cfg = getBrokerConfig(providerCode);
  const isClickable = symbol && cfg.deepLink(symbol) !== "#";
  const url = symbol ? cfg.deepLink(symbol) : cfg.webUrl;

  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium border",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
        isClickable && "cursor-pointer hover:opacity-80 transition-opacity",
        className,
      )}
      style={{
        backgroundColor: cfg.color,
        color: cfg.textColor,
        borderColor: cfg.textColor + "33",
      }}
    >
      <span>{cfg.emoji}</span>
      <span>{cfg.shortLabel}</span>
      {isClickable && <ExternalLink className="h-2.5 w-2.5 opacity-70" />}
    </span>
  );

  if (!isClickable) return content;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title={`Open ${cfg.label}`}>
      {content}
    </a>
  );
}
