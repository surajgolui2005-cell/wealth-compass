"use client";

/**
 * CopilotDrawer
 * =============
 *
 * The main floating AI Copilot chatbot panel for the Wealth Compass dashboard.
 *
 * Structure:
 * ┌─────────────────────────────────────┐
 * │ [Bot] Wealth Compass AI   [×] close  │  ← Header
 * ├─────────────────────────────────────┤
 * │ ⚠ SEBI disclaimer banner             │  ← Always visible
 * ├─────────────────────────────────────┤
 * │                                     │
 * │   Starter chips (when no messages)  │  ← First-open state
 * │   OR message thread                 │  ← Chat state
 * │                                     │
 * ├─────────────────────────────────────┤
 * │ [textarea                ] [Send →] │  ← Input bar
 * └─────────────────────────────────────┘
 *
 * The drawer slides in from the right on desktop (w-[420px]) and is full-screen
 * on mobile. State (messages, open/close) lives in CopilotContext so it
 * persists across dashboard tab navigation without re-mounting.
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AlertTriangle, Bot, ChevronDown, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCopilotContext } from "@/context/CopilotContext";
import { useCopilotChat } from "@/hooks/useCopilotChat";
import { CopilotMessage } from "./CopilotMessage";
import { STARTER_PROMPTS } from "@/types/copilot";

// ── Constants ─────────────────────────────────────────────────────────────────

const SEBI_DISCLAIMER =
  "AI-generated portfolio analytics for educational purposes only. Not SEBI-registered investment advice. Past performance is not indicative of future results.";

// ── Floating trigger button ───────────────────────────────────────────────────

interface CopilotTriggerProps {
  isOpen: boolean;
  unreadCount: number;
  onClick: () => void;
}

function CopilotTrigger({ isOpen, unreadCount, onClick }: CopilotTriggerProps) {
  return (
    <button
      id="copilot-trigger-button"
      onClick={onClick}
      aria-label={isOpen ? "Close AI Copilot" : "Open AI Copilot"}
      aria-expanded={isOpen}
      className={cn(
        "fixed bottom-6 right-6 z-50",
        "flex h-14 w-14 items-center justify-center rounded-full",
        "bg-gradient-to-br from-violet-600 to-indigo-600",
        "text-white shadow-lg shadow-violet-500/30",
        "transition-all duration-300 ease-out",
        "hover:scale-105 hover:shadow-violet-500/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2",
        isOpen && "scale-90 opacity-80",
      )}
    >
      {/* Pulse ring — shown when there are unread messages */}
      {unreadCount > 0 && !isOpen && (
        <span className="absolute inset-0 animate-ping rounded-full bg-violet-500 opacity-30" />
      )}

      {/* Icon */}
      <span className="relative">
        {isOpen ? <ChevronDown className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </span>

      {/* Unread badge */}
      {unreadCount > 0 && !isOpen && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}

// ── Starter prompt chips ──────────────────────────────────────────────────────

interface StarterChipsProps {
  onSelect: (message: string) => void;
  disabled: boolean;
}

function StarterChips({ onSelect, disabled }: StarterChipsProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-8 gap-4">
      {/* Hero text */}
      <div className="text-center space-y-2 mb-2">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
        </div>
        <h3 className="font-semibold text-foreground">Wealth Compass AI</h3>
        <p className="text-sm text-muted-foreground max-w-[260px]">
          Ask me anything about your portfolio — risk, allocation, rebalancing, or tax strategies.
        </p>
      </div>

      {/* Prompt chips */}
      <div className="flex flex-col gap-2 w-full">
        {STARTER_PROMPTS.map((prompt) => (
          <button
            key={prompt.id}
            id={`copilot-starter-${prompt.id}`}
            disabled={disabled}
            onClick={() => onSelect(prompt.message)}
            className={cn(
              "flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3",
              "text-left text-sm font-medium text-foreground",
              "transition-all duration-150",
              "hover:border-primary/50 hover:bg-accent hover:shadow-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            <span className="text-lg">{prompt.icon}</span>
            <span className="flex-1 leading-snug">{prompt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main Drawer ───────────────────────────────────────────────────────────────

export function CopilotDrawer() {
  const { isOpen, close, toggle, messages, clearMessages, unreadCount } = useCopilotContext();
  const { sendMessage, isLoading } = useCopilotChat();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput("");
  }, [input, isLoading, sendMessage]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleStarterSelect = useCallback(
    (message: string) => {
      sendMessage(message);
    },
    [sendMessage],
  );

  const showStarters = messages.length === 0 && !isLoading;

  return (
    <>
      {/* Floating trigger button */}
      <CopilotTrigger isOpen={isOpen} unreadCount={unreadCount} onClick={toggle} />

      {/* Backdrop — mobile only */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm sm:hidden"
          onClick={close}
          aria-hidden
        />
      )}

      {/* Slide-over panel */}
      <div
        id="copilot-drawer-panel"
        role="dialog"
        aria-label="AI Portfolio Copilot"
        aria-modal="true"
        className={cn(
          // Layout
          "fixed inset-y-0 right-0 z-40 flex flex-col",
          "w-full sm:w-[420px]",
          // Visual
          "bg-background border-l border-border shadow-2xl",
          // Animation — slide in from right
          "transform transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-gradient-to-r from-violet-600/10 to-indigo-600/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">
                Wealth Compass AI
              </p>
              <p className="text-[10px] text-muted-foreground">
                Portfolio Copilot • Grounded in live data
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Clear chat */}
            {messages.length > 0 && (
              <button
                id="copilot-clear-button"
                onClick={clearMessages}
                title="Clear conversation"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
            {/* Close */}
            <button
              id="copilot-close-button"
              onClick={close}
              title="Close"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── SEBI Disclaimer banner ───────────────────────────────────────── */}
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-3 py-2 shrink-0">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-400">
            {SEBI_DISCLAIMER}
          </p>
        </div>

        {/* ── Message area ────────────────────────────────────────────────── */}
        <div id="copilot-messages-area" className="flex-1 overflow-y-auto px-4 py-3 scroll-smooth">
          {showStarters ? (
            <StarterChips onSelect={handleStarterSelect} disabled={isLoading} />
          ) : (
            <>
              {messages.map((msg) => (
                <CopilotMessage key={msg.id} message={msg} />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* ── Input bar ───────────────────────────────────────────────────── */}
        <div className="border-t border-border bg-background px-3 py-3 shrink-0">
          <div className="flex items-end gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30 transition-all">
            <textarea
              ref={inputRef}
              id="copilot-input"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="Ask about your portfolio…"
              className={cn(
                "flex-1 resize-none bg-transparent text-sm text-foreground",
                "placeholder:text-muted-foreground",
                "focus:outline-none",
                "max-h-32 overflow-y-auto",
                "disabled:cursor-not-allowed",
              )}
              style={{ minHeight: "24px" }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
              }}
            />
            <button
              id="copilot-send-button"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                "bg-primary text-primary-foreground",
                "transition-all duration-150",
                "hover:bg-primary/90",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              )}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
            Press <kbd className="rounded bg-muted px-1 text-[10px]">Enter</kbd> to send
            {" · "}
            <kbd className="rounded bg-muted px-1 text-[10px]">Shift+Enter</kbd> for new line
          </p>
        </div>
      </div>
    </>
  );
}
