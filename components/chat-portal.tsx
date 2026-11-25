"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { useTranslations } from "next-intl";
import AddCommentRounded from "@mui/icons-material/AddCommentRounded";
import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";
import ExploreRounded from "@mui/icons-material/ExploreRounded";
import ForumRounded from "@mui/icons-material/ForumRounded";
import LinkRounded from "@mui/icons-material/LinkRounded";
import LocalLibraryRounded from "@mui/icons-material/LocalLibraryRounded";
import NorthEastRounded from "@mui/icons-material/NorthEastRounded";
import ReplayRounded from "@mui/icons-material/ReplayRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import StopRounded from "@mui/icons-material/StopRounded";
import VerifiedRounded from "@mui/icons-material/VerifiedRounded";
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  CircularProgress,
  Divider,
  Fab,
  IconButton,
  Link as MuiLink,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { PortalMark } from "@/components/icons";
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

const SUGGESTION_IDS = ["portal", "topics", "guide", "sources"] as const;
const PROMPT_ICONS = [LocalLibraryRounded, ExploreRounded, ForumRounded, VerifiedRounded];

type Health = { referenceCount: number; modelMode: "mock" | "live" | "unconfigured" };

export function ChatPortal() {
  const t = useTranslations();
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
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
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
      if (!isAbort && !isDisconnect && !isError) setAnnouncement(t("Announcement.completed"));
    },
    onError: () => setAnnouncement(t("Announcement.failed")),
  });

  const busy = status === "submitted" || status === "streaming";
  const lastMessageId = messages.at(-1)?.id;

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
    const frame = window.requestAnimationFrame(() => {
      const container = scrollRef.current;
      if (!container) return;
      if (messages.length === 0) {
        followOutputRef.current = true;
        setShowJump(false);
        container.scrollTop = 0;
      } else if (followOutputRef.current) {
        container.scrollTop = container.scrollHeight;
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, busy]);

  useEffect(() => {
    if (!copiedMessageId) return;
    const timer = window.setTimeout(() => setCopiedMessageId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [copiedMessageId]);

  const openSources = (sources: Source[]) => setSelectedSources(sources);
  const closeSources = () => setSelectedSources(null);
  const openPrivacy = () => setPrivacyOpen(true);
  const closePrivacy = () => setPrivacyOpen(false);

  const sendQuestion = async (question: string) => {
    if (!question.trim() || busy || !hydrated || !online) return;
    setInput("");
    followOutputRef.current = true;
    setShowJump(false);
    setAnnouncement(t("Announcement.retrieving"));
    try {
      await sendMessage({ text: question.trim() });
    } catch {
      setAnnouncement(t("Announcement.sendFailed"));
    }
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    await sendQuestion(input);
  };

  const askSuggestion = (question: string) => {
    void sendQuestion(question);
    textareaRef.current?.focus();
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
    container.scrollTo({
      top: container.scrollHeight,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
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
    setAnnouncement(t("Announcement.retrying"));
    void sendMessage({ text: question, metadata: { retryOf: messageId } }).catch(() => {
      setAnnouncement(t("Announcement.retryFailed"));
    });
  };

  const copyMessage = async (message: ChatUIMessage) => {
    const text = messageText(message);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(message.id);
      setAnnouncement(t("Announcement.copied"));
    } catch {
      setAnnouncement(t("Announcement.copyFailed"));
    }
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
    setCopiedMessageId(null);
    setAnnouncement(t("Announcement.cleared"));
    textareaRef.current?.focus();
  };

  const healthLabel = health ? t(`Health.${health.modelMode}`) : t("Health.checking");

  return (
    <Box
      className="portal"
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
        bgcolor: "background.default",
      }}
    >
      <Box
        component="nav"
        aria-label={t("Nav.otherPortals")}
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          minHeight: 32,
          px: { xs: 1.25, sm: 2.5, md: 5 },
          bgcolor: "action.hover",
        }}
      >
        <MuiLink href="https://classic.samuelcheston.com" underline="hover" color="text.secondary" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontSize: 11 }}>
          {t("Nav.classicPortal")} <NorthEastRounded sx={{ fontSize: 14 }} />
        </MuiLink>
      </Box>

      <AppBar
        component="header"
        position="static"
        elevation={0}
        color="inherit"
        sx={{ minHeight: { xs: 64, sm: 72 }, justifyContent: "center", px: { xs: 1.5, sm: 2.5, md: 5 }, bgcolor: "background.default" }}
      >
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 2.5 }}>
          <MuiLink component={Link} href="/" underline="none" color="inherit" aria-label={t("Header.home")} sx={{ display: "inline-flex", alignItems: "center", gap: { xs: 1.25, sm: 1.5 }, minWidth: 0, borderRadius: 2 }}>
            <Box className="brand-mark" sx={{ width: { xs: 36, sm: 40 }, height: { xs: 36, sm: 40 }, p: 0.375, borderRadius: { xs: 3, sm: 4 }, bgcolor: "secondary.main", color: "primary.main", flex: "none" }}>
              <PortalMark width="100%" height="100%" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography component="strong" sx={{ display: "block", fontSize: { xs: 15, sm: 17 }, fontWeight: 600, letterSpacing: "0.02em", lineHeight: 1.25 }}>
                {t("Header.brand")}
              </Typography>
              <Typography sx={{ display: { xs: "none", sm: "block" }, mt: 0.5, color: "text.secondary", fontSize: 9, letterSpacing: "0.13em", lineHeight: 1.25 }}>
                {t("Header.brandCaption")}
              </Typography>
            </Box>
          </MuiLink>

          <Stack direction="row" sx={{ alignItems: "center", gap: { xs: 0.25, sm: 1 } }}>
            <Tooltip title={healthLabel}>
              <Chip
                size="small"
                variant="outlined"
                color={health?.modelMode === "unconfigured" ? "warning" : "default"}
                aria-label={healthLabel}
                icon={
                  <Box
                    className="status-dot"
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      bgcolor: health?.modelMode === "unconfigured" ? "error.main" : "primary.main",
                      boxShadow: (theme) => `0 0 0 3px ${theme.palette.action.hover}`,
                      ml: 0.5,
                    }}
                  />
                }
                label={<Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>{healthLabel}</Box>}
                sx={{ minHeight: { xs: 30, sm: 32 }, color: "text.secondary" }}
              />
            </Tooltip>

            {messages.length > 0 && (
              <Button
                type="button"
                variant="text"
                color={confirmClear ? "error" : "primary"}
                startIcon={<AddCommentRounded />}
                onClick={clearChat}
                disabled={busy}
                aria-label={confirmClear ? t("Chat.confirmClearAria") : t("Chat.newAria")}
                sx={{ minWidth: { xs: 40, sm: 0 }, minHeight: 40, px: { xs: 0, sm: 1.75 }, borderRadius: 999 }}
              >
                <Box component="span" sx={{ display: { xs: confirmClear ? "inline" : "none", sm: "inline" } }}>
                  {confirmClear ? t("Chat.confirmClear") : t("Chat.new")}
                </Box>
              </Button>
            )}

            <Tooltip title={t("Privacy.tooltip")}>
              <IconButton onClick={openPrivacy} aria-label={t("Privacy.open")} sx={{ width: { xs: 40, sm: 44 }, height: { xs: 40, sm: 44 }, color: "primary.main" }}>
                <ShieldRounded />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </AppBar>

      <Box
        component="main"
        ref={scrollRef}
        onScroll={handleScroll}
        aria-busy={busy}
        aria-label={messages.length ? t("Main.history") : t("Main.welcome")}
        sx={{ position: "relative", flex: "1 1 auto", minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", bgcolor: "background.default" }}
      >
        <Box
          sx={{
            width: "min(840px, 100%)",
            minHeight: "100%",
            mx: "auto",
            px: { xs: 2, sm: 3, md: 5 },
            py: { xs: 2.75, sm: 4.25 },
            pb: 3.5,
            ...(messages.length === 0
              ? { display: "grid", justifyItems: "center", alignItems: "safe center" }
              : {}),
          }}
        >
          {!hydrated ? (
            <Stack spacing={1.5} role="status" sx={{ minHeight: 260, alignItems: "center" }}>
              <CircularProgress color="primary" size={30} />
              <Typography color="text.secondary">{t("Loading.preparing")}</Typography>
            </Stack>
          ) : messages.length === 0 ? (
            <Box sx={{ width: "min(720px, 100%)", textAlign: "center" }}>
              <Avatar sx={{ width: { xs: 52, sm: 58 }, height: { xs: 52, sm: 58 }, mx: "auto", mb: { xs: 1.5, sm: 1.75 }, borderRadius: { xs: 4, sm: 5 }, bgcolor: "secondary.main", color: "primary.main" }}>
                <Box sx={{ width: { xs: 37, sm: 42 }, height: { xs: 37, sm: 42 } }}>
                  <PortalMark width="100%" height="100%" />
                </Box>
              </Avatar>
              <Typography color="primary.dark" sx={{ mb: 1, fontSize: 12, fontWeight: 600, letterSpacing: "0.05em" }}>
                {t("Welcome.eyebrow")}
              </Typography>
              <Typography component="h1" sx={{ fontSize: { xs: "clamp(30px, 8vw, 38px)", sm: "clamp(34px, 4.8vw, 48px)" }, fontWeight: 500, lineHeight: 1.2, letterSpacing: "-0.025em" }}>
                {t("Welcome.title")}
              </Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 540, mx: "auto", mt: { xs: 1.5, sm: 1.75 }, fontSize: { xs: 13, sm: 15 }, lineHeight: 1.7 }}>
                {t("Welcome.description")}
              </Typography>

              <Box component="section" aria-label={t("Suggestions.label")} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: { xs: 1.125, sm: 1.5 }, mt: { xs: 3, sm: 3.75 }, textAlign: "left" }}>
                {SUGGESTION_IDS.map((id, index) => {
                  const PromptIcon = PROMPT_ICONS[index];
                  return (
                    <Card key={id} className="prompt-card" variant="outlined" sx={{ minWidth: 0, borderColor: "divider", bgcolor: "background.paper" }}>
                      <CardActionArea onClick={() => askSuggestion(t(`Suggestions.${id}.prompt`))} sx={{ display: "flex", alignItems: { xs: "center", sm: "flex-start" }, gap: 1.625, p: { xs: 1.625, sm: 2.25 }, height: "100%", "&:hover": { bgcolor: "action.hover" } }}>
                        <Avatar sx={{ width: { xs: 40, sm: 42 }, height: { xs: 40, sm: 42 }, borderRadius: { xs: 3, sm: 4 }, bgcolor: "secondary.main", color: "secondary.contrastText", flex: "none" }}>
                          <PromptIcon sx={{ fontSize: 23 }} />
                        </Avatar>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography component="strong" sx={{ display: "block", pr: 2, fontSize: { xs: 14, sm: 15 }, fontWeight: 600 }}>
                            {t(`Suggestions.${id}.title`)}
                          </Typography>
                          <Typography color="text.secondary" sx={{ display: "block", mt: 0.5, fontSize: { xs: 11, sm: 12 }, lineHeight: 1.55 }}>
                            {t(`Suggestions.${id}.description`)}
                          </Typography>
                        </Box>
                        <ArrowUpwardRounded sx={{ position: "absolute", top: { xs: "50%", sm: 2 }, right: { xs: 2, sm: 2.5 }, color: "text.disabled", fontSize: 17, transform: { xs: "translateY(-50%) rotate(45deg)", sm: "rotate(45deg)" } }} />
                      </CardActionArea>
                    </Card>
                  );
                })}
              </Box>

              <Stack component="section" aria-label={t("Service.label")} direction="row" sx={{ mt: { xs: 2.125, sm: 2.75 }, alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: { xs: 1, sm: 1.5 }, color: "text.secondary" }}>
                <Typography variant="caption" sx={{ display: "inline-flex", alignItems: "center", gap: 0.625 }}>
                  <LinkRounded sx={{ fontSize: 15, color: "primary.main" }} />{t("Service.sources")}
                </Typography>
                <Typography variant="caption" sx={{ display: "inline-flex", alignItems: "center", gap: 0.625 }}>
                  <ShieldRounded sx={{ fontSize: 15, color: "primary.main" }} />{t("Service.browserHistory")}
                </Typography>
                <Chip size="small" label={health ? t("Service.referenceCount", { count: health.referenceCount }) : t("Service.publicLibrary")} sx={{ bgcolor: "action.hover", borderRadius: 2 }} />
              </Stack>
            </Box>
          ) : (
            <Box role="log" aria-label={t("Messages.content")} aria-live="off" sx={{ display: "grid", gap: { xs: 3.125, sm: 3.75 } }}>
              <Stack direction="row" sx={{ pb: 1.75, borderBottom: 1, borderColor: "divider", color: "text.disabled", fontSize: 11, justifyContent: "space-between", alignItems: "center" }}>
                <Typography color="text.secondary" sx={{ fontWeight: 600 }}>{t("Messages.current")}</Typography>
                <Typography>{t("Messages.questionCount", { count: messages.filter((message) => message.role === "user").length })}</Typography>
              </Stack>

              {messages.map((message) => {
                const text = messageText(message);
                const sources = messageSources(message);
                const isRetry = Boolean(message.metadata?.retryOf);
                if (isRetry) {
                  return (
                    <Divider key={message.id} sx={{ my: -1, color: "text.disabled", fontSize: 11 }}>
                      <Typography variant="caption">{t("Messages.retryDivider")}</Typography>
                    </Divider>
                  );
                }
                return (
                  <Box component="article" key={message.id} aria-label={message.role === "user" ? t("Messages.userQuestion") : t("Messages.assistantAnswer")} sx={{ minWidth: 0 }}>
                    <Stack direction={message.role === "user" ? "row-reverse" : "row"} sx={{ mb: 1.25, color: "text.secondary", fontSize: 12, fontWeight: 600, alignItems: "center", gap: 1.25 }}>
                      <Avatar sx={{ width: 30, height: 30, borderRadius: 3, bgcolor: "secondary.main", color: "primary.main", fontSize: 11 }}>
                        {message.role === "user" ? t("Messages.you") : <PortalMark width={23} height={23} />}
                      </Avatar>
                      <Typography color="text.secondary" sx={{ fontSize: 12, fontWeight: 600 }}>
                        {message.role === "user" ? t("Messages.you") : t("Messages.assistant")}
                      </Typography>
                    </Stack>

                    {message.role === "assistant" ? (
                      <Box sx={{ pl: { xs: 0, sm: 5 } }}>
                        {text ? (
                          <MarkdownMessage text={text} sources={sources} onOpenSource={(source) => openSources([source])} />
                        ) : (
                          <Box role="status" aria-label={t("Messages.thinking")} sx={{ display: "flex", alignItems: "center", minHeight: 34 }}>
                            <CircularProgress color="primary" size={14} thickness={5} />
                          </Box>
                        )}
                        {message.metadata?.interrupted && (
                          <Chip size="small" color="warning" variant="outlined" label={t("Messages.incomplete")} sx={{ mt: 1.5 }} />
                        )}
                        {(sources.length > 0 || text) && (
                          <Stack component="div" direction="row" sx={{ mt: 1.5, flexWrap: "wrap", gap: 0.5 }} aria-label={t("Messages.actions")}>
                            {sources.length > 0 && (
                              <Button size="small" variant="outlined" startIcon={<LinkRounded />} onClick={() => openSources(sources)}>
                                {t("Messages.sourceCount", { count: sources.length })}
                              </Button>
                            )}
                            {text && (
                              <Button size="small" variant="text" startIcon={copiedMessageId === message.id ? <CheckRounded /> : <ContentCopyRounded />} onClick={() => void copyMessage(message)}>
                                {copiedMessageId === message.id ? t("Messages.copied") : t("Messages.copy")}
                              </Button>
                            )}
                            {!busy && message.id === lastMessageId && (
                              <Button size="small" variant="text" startIcon={<ReplayRounded />} onClick={() => retryMessage(message.id)}>
                                {t("Messages.retry")}
                              </Button>
                            )}
                          </Stack>
                        )}
                      </Box>
                    ) : (
                      <Paper elevation={0} sx={{ maxWidth: { xs: "90%", sm: "min(82%, 650px)" }, ml: "auto", px: { xs: 1.875, sm: 2.25 }, py: 1.625, borderRadius: "22px 22px 6px 22px", bgcolor: "secondary.main", color: "secondary.contrastText" }}>
                        <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{text}</Typography>
                      </Paper>
                    )}
                  </Box>
                );
              })}

              {busy && (
                <Stack direction="row" role="status" sx={{ pl: { xs: 0, sm: 5 }, color: "text.secondary", fontSize: 12, alignItems: "center", gap: 1.125 }}>
                  <CircularProgress color="primary" size={14} thickness={4} />
                  <Typography color="text.secondary" sx={{ fontSize: 12 }}>
                    {status === "submitted" ? t("Messages.retrieving") : t("Messages.generating")}
                  </Typography>
                </Stack>
              )}
            </Box>
          )}
        </Box>

        {showJump && (
          <Fab
            variant="extended"
            size="small"
            color="primary"
            onClick={jumpToBottom}
            sx={{ position: "sticky", bottom: 14, zIndex: 1, mx: "auto", mt: -7, borderRadius: 3 }}
          >
            <ArrowDownwardRounded sx={{ mr: 1 }} />
            {t("Messages.jump")}
          </Fab>
        )}
      </Box>

      <Box component="section" aria-label={t("Composer.label")} sx={{ flex: "0 0 auto", px: { xs: 1.25, sm: 2.5, md: 5 }, pb: "max(12px, env(safe-area-inset-bottom))", bgcolor: "background.default" }}>
        <Box sx={{ width: "min(760px, 100%)", mx: "auto" }}>
          {!online && (
            <Alert severity="warning" sx={{ mb: 1.125 }}>
              {t("Composer.offline")}
            </Alert>
          )}
          {error && (
            <Alert
              severity="error"
              sx={{ mb: 1.125 }}
              action={
                <Stack direction="row" sx={{ alignItems: "center" }}>
                  <Button color="inherit" size="small" onClick={() => retryMessage(messages.at(-1)?.id || "")}>{t("Composer.errorRetry")}</Button>
                  <IconButton color="inherit" size="small" onClick={clearError} aria-label={t("Composer.dismissError")}><CloseRounded fontSize="small" /></IconButton>
                </Stack>
              }
            >
              {error.message || t("Composer.generationFailed")}
            </Alert>
          )}
          {storageWarning && (
            <Alert severity="info" sx={{ mb: 1.125 }}>
              {t("Composer.storageWarning")}
            </Alert>
          )}

          <Paper
            component="form"
            ref={formRef}
            onSubmit={submit}
            className="composer"
            elevation={1}
            sx={{
              px: { xs: 1.875, sm: 2.25 },
              pt: { xs: 1.375, sm: 1.625 },
              pb: { xs: 1, sm: 1.125 },
              borderRadius: { xs: 3, sm: 4 },
              border: 1,
              borderColor: "divider",
              bgcolor: "background.paper",
              "&:focus-within": { borderColor: "primary.main", boxShadow: (theme) => `0 0 0 2px ${theme.palette.secondary.main}, ${theme.shadows[1]}` },
            }}
          >
            <TextField
              fullWidth
              multiline
              minRows={1}
              maxRows={5}
              variant="standard"
              inputRef={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t("Composer.placeholder")}
              disabled={!hydrated}
              slotProps={{ htmlInput: { maxLength: 4_000, onKeyDown: handleKeyDown, "aria-label": t("Composer.inputLabel") } }}
              sx={{
                "& .MuiInputBase-root": {
                  px: 0,
                  py: 0.5,
                  fontSize: { xs: 16, sm: 15 },
                  lineHeight: 1.65,
                  "&::before": { borderBottom: 0 },
                  "&::after": { borderBottom: 0 },
                  "&:hover:not(.Mui-disabled)::before": { borderBottom: 0 },
                },
                "& textarea": { minHeight: "34px !important", maxHeight: 160, overflowY: "auto" },
              }}
            />

            <Stack direction="row" sx={{ mt: 0.875, alignItems: "center", justifyContent: "space-between", gap: 2 }}>
              <Chip
                size="small"
                variant="outlined"
                label={t("Composer.publicReferences")}
                color="default"
                icon={<Box className="source-badge-dot" sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "primary.main" }} />}
                sx={{ color: "text.secondary" }}
              />
              <Stack direction="row" sx={{ alignItems: "center", gap: 1.25 }}>
                {input.length > 3_500 && <Typography color="error" sx={{ fontSize: 10 }}>{input.length}/4000</Typography>}
                {busy ? (
                  <IconButton
                    color="error"
                    aria-label={t("Composer.stop")}
                    onClick={() => {
                      stop();
                      setAnnouncement(t("Composer.stopAnnouncement"));
                    }}
                    sx={{ width: 44, height: 44 }}
                  >
                    <StopRounded />
                  </IconButton>
                ) : (
                  <Button
                    type="submit"
                    className="send-button"
                    variant="contained"
                    color="primary"
                    disabled={!input.trim() || !hydrated || !online}
                    aria-label={t("Composer.send")}
                    sx={{ width: 44, height: 44, minWidth: 44, p: 0, borderRadius: "16px" }}
                  >
                    <ArrowUpwardRounded />
                  </Button>
                )}
              </Stack>
            </Stack>
          </Paper>

          <Stack direction={{ xs: "column", sm: "row" }} sx={{ px: 0.875, pt: 1, color: "text.disabled", alignItems: "center", justifyContent: { sm: "space-between" }, gap: 1.5 }}>
            <Typography variant="caption" component="p" sx={{ fontSize: { xs: 9, sm: 10 } }}>{t("Composer.disclaimer")}</Typography>
            <Typography variant="caption" sx={{ display: { xs: "none", sm: "block" }, whiteSpace: "nowrap", fontSize: 10 }}>{t("Composer.keyboardHint")}</Typography>
          </Stack>
        </Box>
      </Box>

      <Box component="p" className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</Box>
      <SourceDialog sources={selectedSources} onClose={closeSources} />
      <PrivacyDialog open={privacyOpen} onClose={closePrivacy} />
    </Box>
  );
}
