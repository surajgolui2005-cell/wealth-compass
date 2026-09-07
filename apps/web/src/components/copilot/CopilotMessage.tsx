"use client";

/**
 * CopilotMessage
 * ==============
 *
 * Renders a single chat message bubble for both user and assistant roles.
 *
 * Features:
 * - User messages: right-aligned, primary gradient background
 * - Assistant messages: left-aligned, card background with bot avatar
 * - Typing indicator: three animated dots (shown while isStreaming = true)
 * - Lightweight markdown renderer targeting copilot output patterns:
 *     **bold**, `code`, ### heading, - bullet list
 * - Inline SuggestedTradeAction cards rendered below the answer text
 */

import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { TradeActionCard } from "./TradeActionCard";
import type { ChatMessage } from "@/types/copilot";

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

// ── Lightweight markdown renderer ─────────────────────────────────────────────
// Handles the four patterns the copilot actually produces, in one pass.

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (key: string) => {
    if (listItems.length === 0) return;
    elements.push(
      <ul key={key} className="list-disc list-inside space-y-0.5 my-1 text-sm">
        {listItems.map((item, i) => (
          <li key={i} className="leading-relaxed">
            {renderInline(item)}
          </li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  lines.forEach((line, idx) => {
    const key = `line-${idx}`;

    // Heading: ### or ## or #
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      flushList(`flush-${idx}`);
      const level = headingMatch[1].length;
      const Tag = `h${Math.min(level + 3, 6)}` as "h4" | "h5" | "h6";
      elements.push(
        <Tag
          key={key}
          className={cn(
            "font-semibold mt-3 mb-1",
            level === 1 && "text-base",
            level === 2 && "text-sm",
            level >= 3 && "text-xs uppercase tracking-wide text-muted-foreground",
          )}
        >
          {headingMatch[2]}
        </Tag>,
      );
      return;
    }

    // Bullet: - or * or •
    const bulletMatch = line.match(/^[\-\*•]\s+(.+)/);
    if (bulletMatch) {
      listItems.push(bulletMatch[1]);
      return;
    }

    // Numbered list: 1. 2. etc.
    const numMatch = line.match(/^\d+\.\s+(.+)/);
    if (numMatch) {
      listItems.push(numMatch[1]);
      return;
    }

    // Empty line → paragraph break
    if (line.trim() === "") {
      flushList(`flush-${idx}`);
      if (elements.length > 0) {
        elements.push(<div key={key} className="h-1" />);
      }
      return;
    }

    // Normal paragraph line
    flushList(`flush-${idx}`);
    elements.push(
      <p key={key} className="text-sm leading-relaxed">
        {renderInline(line)}
      </p>,
    );
  });

  flushList("flush-final");
  return <>{elements}</>;
}

/** Process inline markdown: **bold**, `code`, and plain text. */
function renderInline(text: string): React.ReactNode {
  // Split on **bold** and `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={i} className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface CopilotMessageProps {
  message: ChatMessage;
}

export function CopilotMessage({ message }: CopilotMessageProps) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end mb-3">
        <div className="flex items-end gap-2 max-w-[85%]">
          <div className="rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-primary-foreground shadow-sm">
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
            </p>
          </div>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 mb-0.5">
            <User className="h-3.5 w-3.5 text-primary" />
          </div>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex items-start gap-2 mb-3">
      {/* Bot avatar */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-sm mt-0.5">
        <Bot className="h-3.5 w-3.5 text-white" />
      </div>

      <div className="flex-1 min-w-0 max-w-[88%]">
        <div className="rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3 shadow-sm">
          {message.isStreaming ? (
            <TypingIndicator />
          ) : (
            <div className="space-y-1">{renderMarkdown(message.content)}</div>
          )}
        </div>

        {/* Trade suggestion cards */}
        {!message.isStreaming && message.suggestedTrades && message.suggestedTrades.length > 0 && (
          <div className="mt-1 space-y-1">
            <p className="text-[11px] text-muted-foreground px-1 mt-2 font-medium uppercase tracking-wide">
              Suggested Actions
            </p>
            {message.suggestedTrades.map((trade, i) => (
              <TradeActionCard key={i} trade={trade} />
            ))}
          </div>
        )}

        {/* Timestamp */}
        <p className="text-[10px] text-muted-foreground mt-1 px-1">
          {message.timestamp.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
