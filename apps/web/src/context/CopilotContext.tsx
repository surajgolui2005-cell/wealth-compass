"use client";

/**
 * CopilotContext
 * ==============
 *
 * React Context that holds the copilot drawer's state at the dashboard-layout
 * level, so messages and open/close state persist across tab navigation
 * (Dashboard → Analytics → Risk → back) without re-mounting.
 *
 * Wrap `(dashboard)/layout.tsx` with <CopilotProvider> and add <CopilotDrawer>
 * inside it. All children can call `useCopilotContext()` to toggle the drawer.
 */

import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ChatMessage, ConversationTurn } from "@/types/copilot";

// ── Context shape ─────────────────────────────────────────────────────────────

interface CopilotContextValue {
  /** Whether the drawer panel is currently open. */
  isOpen: boolean;
  /** Open the drawer. */
  open: () => void;
  /** Close the drawer. */
  close: () => void;
  /** Toggle the drawer open/closed. */
  toggle: () => void;
  /** Full ordered list of chat messages in this session. */
  messages: ChatMessage[];
  /** Append a new message to the thread. */
  addMessage: (msg: ChatMessage) => void;
  /** Replace the last message (used to update a streaming placeholder). */
  updateLastMessage: (updater: (prev: ChatMessage) => ChatMessage) => void;
  /** Clear all messages (start fresh conversation). */
  clearMessages: () => void;
  /** Count of unread assistant messages (resets when drawer opens). */
  unreadCount: number;
}

// ── Context ───────────────────────────────────────────────────────────────────

const CopilotContext = createContext<CopilotContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function CopilotProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Use a ref to avoid stale-closure issues inside callbacks
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  const open = useCallback(() => {
    setIsOpen(true);
    setUnreadCount(0);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) setUnreadCount(0); // clear badge when opening
      return !prev;
    });
  }, []);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
    // Increment badge only for assistant messages when drawer is closed
    if (msg.role === "assistant" && !isOpenRef.current) {
      setUnreadCount((n) => n + 1);
    }
  }, []);

  const updateLastMessage = useCallback((updater: (prev: ChatMessage) => ChatMessage) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      return [...prev.slice(0, -1), updater(last)];
    });
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);

  return (
    <CopilotContext.Provider
      value={{
        isOpen,
        open,
        close,
        toggle,
        messages,
        addMessage,
        updateLastMessage,
        clearMessages,
        unreadCount,
      }}
    >
      {children}
    </CopilotContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCopilotContext(): CopilotContextValue {
  const ctx = useContext(CopilotContext);
  if (!ctx) {
    throw new Error("useCopilotContext must be used within <CopilotProvider>");
  }
  return ctx;
}

// ── Utility: build ConversationTurn[] from ChatMessage[] ─────────────────────

/** Convert client-side ChatMessage[] to the API-expected ConversationTurn[]. */
export function toConversationHistory(messages: ChatMessage[]): ConversationTurn[] {
  return messages.filter((m) => !m.isStreaming).map((m) => ({ role: m.role, content: m.content }));
}
