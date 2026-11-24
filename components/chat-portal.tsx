"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { ArrowDownIcon, ArrowUpIcon, LinkIcon, PortalMark, ShieldIcon, StopIcon } from "@/components/icons";
import { PrivacyDialog, SourceDialog } from "@/components/dialogs";
import { MarkdownMessage } from "@/components/markdown-message";
import {
  clearBrowserChat,
  loadBrowserChat,
  messageSources,
  messageText,
  saveBrowserChat,
} from "@/lib/chat-storage";
import type { ChatUIMessage, Source } from "@/lib/types";

const SUGGESTIONS = ["这个门户根据什么资料回答？", "资料覆盖哪些主题？", "回答如何引用来源？"];

type Health = { referenceCount: number; modelMode: "mock" | "live" | "unconfigured" };

export function ChatPortal() {
  const [input, setInput] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [online, setOnline] = useState(true);
  const [announcement, setAnnouncement] = useState("");
  const [selectedSources, setSelectedSources] = useState<Source[] | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const sourceTriggerRef = useRef<HTMLButtonElement | null>(null);
  const privacyTriggerRef = useRef<HTMLButtonElement | null>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const followOutputRef = useRef(true);
  const interruptedRef = useRef(false);
  const messagesRef = useRef<ChatUIMessage[]>([]);

  const {
    messages,
    setMessages,
    sendMessage,
    stop,
    status,
    error,
    clearError,
  } = useChat<ChatUIMessage>({
    id: "reference-portal",
    throttle: 80,
    onFinish: ({ isAbort, isDisconnect, isError }) => {
      if (isAbort || isDisconnect || isError) interruptedRef.current = true;
      if (!isAbort && !isDisconnect && !isError) setAnnouncement("回答已完成，可以查看引用或继续提问。");
    },
    onError: () => setAnnouncement("回答失败，可以保留当前内容并重试。"),
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        setMessages(loadBrowserChat(window.localStorage));
      } catch {
        setStorageWarning(true);
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [setMessages]);

  useEffect(() => {
    if (status !== "ready" || !interruptedRef.current) return;
    interruptedRef.current = false;
    setMessages((current) => {
      let lastAssistantIndex = -1;
      current.forEach((message, index) => {
        if (message.role === "assistant") lastAssistantIndex = index;
      });
      return current.map((message, index) =>
        index === lastAssistantIndex ? { ...message, metadata: { ...message.metadata, interrupted: true } } : message,
      );
    });
  }, [status, setMessages]);

  useEffect(() => {
    if (!hydrated || busy) return;
    const timer = window.setTimeout(() => {
      try {
        if (!saveBrowserChat(window.localStorage, messages)) setStorageWarning(true);
      } catch {
        setStorageWarning(true);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [messages, status, hydrated, busy]);

  useEffect(() => {
    if (!hydrated) return;
    const persist = () => {
      try {
        saveBrowserChat(window.localStorage, messagesRef.current);
      } catch {
        // The current page remains usable when browser storage is blocked.
      }
    };
    window.addEventListener("pagehide", persist);
    return () => window.removeEventListener("pagehide", persist);
  }, [hydrated]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health", { signal: controller.signal, cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Health | null) => setHealth(data))
      .catch(() => setHealth(null));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [input]);

  useEffect(() => {
    if (!followOutputRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      const container = scrollRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, busy]);

  const openSources = (sources: Source[], trigger: HTMLButtonElement) => {
    sourceTriggerRef.current = trigger;
    setSelectedSources(sources);
  };

  const closeSources = () => {
    setSelectedSources(null);
    window.setTimeout(() => sourceTriggerRef.current?.focus(), 0);
  };

  const openPrivacy = (trigger: HTMLButtonElement) => {
    privacyTriggerRef.current = trigger;
    setPrivacyOpen(true);
  };

  const closePrivacy = () => {
    setPrivacyOpen(false);
    window.setTimeout(() => privacyTriggerRef.current?.focus(), 0);
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    followOutputRef.current = true;
    setShowJump(false);
    setAnnouncement("正在检索公开资料并生成回答。");
    try {
      await sendMessage({ text: question });
    } catch {
      setAnnouncement("发送失败，请检查网络后重试。");
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 72;
    followOutputRef.current = atBottom;
    setShowJump(!atBottom);
  };

  const jumpToBottom = () => {
    const container = scrollRef.current;
    if (!container) return;
    followOutputRef.current = true;
    setShowJump(false);
    container.scrollTo({ top: container.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  const retryMessage = (messageId: string) => {
    if (busy) return;
    const index = messages.findIndex((message) => message.id === messageId);
    if (index === -1) return;
    let question = "";
    for (let cursor = index; cursor >= 0; cursor -= 1) {
      if (messages[cursor].role === "user") {
        question = messageText(messages[cursor]);
        break;
      }
    }
    if (!question && messages.at(-1)?.role === "user") question = messageText(messages.at(-1)!);
    if (!question) return;
    followOutputRef.current = true;
    setAnnouncement("正在重新回答，上一份内容会保留。");
    void sendMessage({ text: question, metadata: { retryOf: messageId } }).catch(() => {
      setAnnouncement("重试发送失败，请稍后再试。");
    });
  };

  const clearChat = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    if (busy) stop();
    clearError();
    setMessages([]);
    try {
      clearBrowserChat(window.localStorage);
    } catch {
      setStorageWarning(true);
    }
    setConfirmClear(false);
    setAnnouncement("此浏览器中的对话已清空。");
    textareaRef.current?.focus();
  };

  const modelLabel = health?.modelMode === "mock" ? "Mock 模式" : health?.modelMode === "live" ? "模型已连接" : "模型未配置";

  return (
    <div className="portal">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="参考问答门户首页">
          <PortalMark className="brand-mark" />
          <span className="brand-copy">
            <strong>参考问答</strong>
            <span>PERSONAL REFERENCE PORTAL</span>
          </span>
        </Link>
        <div className="header-actions">
          <span className={`service-status ${health?.modelMode === "unconfigured" ? "is-warning" : ""}`}>
            <span className="status-dot" aria-hidden="true" />
            {health ? modelLabel : "检查服务"}
          </span>
          <button type="button" className="text-button" onClick={(event) => openPrivacy(event.currentTarget)}>
            <ShieldIcon /> 隐私
          </button>
        </div>
      </header>

      <main
        className="conversation"
        ref={scrollRef}
        onScroll={handleScroll}
        aria-busy={busy}
        aria-label={messages.length ? "对话记录" : "门户说明"}
      >
        <div className={`conversation-inner ${messages.length === 0 ? "is-empty" : ""}`}>
          {!hydrated ? (
            <p className="loading-history" role="status">正在读取此浏览器中的对话…</p>
          ) : messages.length === 0 ? (
            <section className="empty-state" aria-labelledby="empty-title">
              <p className="eyebrow">ASK THE REFERENCES</p>
              <h1 id="empty-title">向公开资料提问。</h1>
              <p className="empty-intro">基于主人提供的 reference 回答，重要信息附上可核查的来源。</p>
              <div className="suggestion-list" aria-label="示例问题">
                {SUGGESTIONS.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => setInput(suggestion)}>
                    {suggestion}<ArrowUpIcon />
                  </button>
                ))}
              </div>
              <p className="empty-note">
                {health ? `${health.referenceCount} 份公开资料` : "公开资料"} · AI 可能出错，请核对引用
              </p>
            </section>
          ) : (
            <div className="message-list" role="log" aria-label="对话内容" aria-live="off">
              {messages.map((message) => {
                const text = messageText(message);
                const sources = messageSources(message);
                const isRetry = Boolean(message.metadata?.retryOf);
                if (isRetry) {
                  return <p className="retry-divider" key={message.id}>重新回答上一题，旧内容已保留</p>;
                }
                return (
                  <article className={`message ${message.role}`} key={message.id} aria-label={message.role === "user" ? "你的问题" : "助手回答"}>
                    <div className="message-label">
                      <span className="message-avatar" aria-hidden="true">{message.role === "user" ? "你" : <PortalMark />}</span>
                      <span>{message.role === "user" ? "你" : "参考助手"}</span>
                    </div>
                    <div className="message-body">
                      {message.role === "assistant" ? (
                        <>
                          {text ? (
                            <MarkdownMessage text={text} sources={sources} onOpenSource={(source, trigger) => openSources([source], trigger)} />
                          ) : (
                            <div className="thinking" aria-label="正在思考"><span /><span /><span /></div>
                          )}
                          {message.metadata?.interrupted && <p className="incomplete-note">内容可能不完整</p>}
                          {sources.length > 0 && (
                            <button type="button" className="sources-button" onClick={(event) => openSources(sources, event.currentTarget)}>
                              <LinkIcon /> 查看 {sources.length} 条来源
                            </button>
                          )}
                        </>
                      ) : (
                        <p className="user-text">{text}</p>
                      )}
                    </div>
                  </article>
                );
              })}
              {busy && (
                <p className="generation-status" role="status">
                  <span className="mini-spinner" aria-hidden="true" />
                  {status === "submitted" ? "正在检索资料…" : "正在生成回答…"}
                </p>
              )}
            </div>
          )}
        </div>
        {showJump && (
          <button type="button" className="jump-button" onClick={jumpToBottom}>
            <ArrowDownIcon /> 回到最新内容
          </button>
        )}
      </main>

      <div className="composer-area">
        <div className="composer-inner">
          {!online && <p className="network-warning" role="status">网络已断开。恢复连接后再发送或重试。</p>}
          {error && (
            <div className="error-banner">
              <span>{error.message || "回答失败，请稍后重试。"}</span>
              <button type="button" onClick={() => retryMessage(messages.at(-1)?.id || "")}>重试</button>
              <button type="button" onClick={clearError} aria-label="关闭错误提示">×</button>
            </div>
          )}
          {storageWarning && (
            <p className="storage-warning">浏览器存储不可用或已满；本次对话仍可使用，但刷新后可能丢失。</p>
          )}
          <form ref={formRef} className="composer" onSubmit={submit}>
            <label htmlFor="question" className="sr-only">向公开资料提问</label>
            <textarea
              id="question"
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="根据公开资料，问一个问题…"
              rows={1}
              maxLength={4_000}
              disabled={!hydrated}
            />
            <div className="composer-bottom">
              <p>Enter 发送 · Shift + Enter 换行</p>
              <div className="composer-controls">
                {input.length > 3_500 && <span className="character-count">{input.length}/4000</span>}
                {busy ? (
                  <button type="button" className="send-button stop-button" onClick={() => { stop(); setAnnouncement("已停止生成，保留的内容可能不完整。"); }} aria-label="停止生成">
                    <StopIcon />
                  </button>
                ) : (
                  <button type="submit" className="send-button" disabled={!input.trim() || !hydrated || !online} aria-label="发送问题">
                    <ArrowUpIcon />
                  </button>
                )}
              </div>
            </div>
          </form>
          <div className="composer-footer">
            <p>对话仅保存在此浏览器 · 提问会发送给模型服务</p>
            <button type="button" className={confirmClear ? "clear-button is-confirming" : "clear-button"} onClick={clearChat} disabled={!messages.length || busy}>
              {confirmClear ? "确认清空" : "清空对话"}
            </button>
          </div>
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
      <SourceDialog sources={selectedSources} onClose={closeSources} returnFocusRef={sourceTriggerRef} />
      <PrivacyDialog open={privacyOpen} onClose={closePrivacy} returnFocusRef={privacyTriggerRef} />
    </div>
  );
}
