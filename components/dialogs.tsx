"use client";

import { useEffect, useRef, type RefObject } from "react";
import { CloseIcon, LinkIcon, ShieldIcon } from "@/components/icons";
import type { Source } from "@/lib/types";

function safeLink(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function SourceDialog({
  sources,
  onClose,
  returnFocusRef,
}: {
  sources: Source[] | null;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (sources && !dialog.open) dialog.showModal();
    if (!sources && dialog.open) dialog.close();
  }, [sources]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => returnFocusRef.current?.focus();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [returnFocusRef]);

  const closeDialog = () => {
    dialogRef.current?.close();
    returnFocusRef.current?.focus();
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal source-modal"
      aria-labelledby="source-dialog-title"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        closeDialog();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
    >
      <div className="modal-header">
        <div>
          <p className="eyebrow">REFERENCE CHECK</p>
          <h2 id="source-dialog-title">回答依据</h2>
        </div>
        <button type="button" className="icon-button" onClick={closeDialog} aria-label="关闭来源">
          <CloseIcon />
        </button>
      </div>
      <p className="modal-intro">这些是本次检索到的资料片段。请核对原文，引用本身不代表结论一定正确。</p>
      <div className="source-list">
        {sources?.map((source) => {
          const href = safeLink(source.url);
          return (
            <article className="source-card" key={source.id}>
              <div className="source-meta">
                <span className="source-id">{source.id}</span>
                {source.publishedAt && <time>{source.publishedAt}</time>}
              </div>
              <h3>{source.title}</h3>
              <p className="source-locator">定位：{source.locator}</p>
              <p className="source-excerpt">{source.excerpt}</p>
              {href && (
                <a href={href} target="_blank" rel="noopener noreferrer" className="source-link">
                  打开原始资料 <LinkIcon />
                </a>
              )}
            </article>
          );
        })}
      </div>
    </dialog>
  );
}

export function PrivacyDialog({ open, onClose, returnFocusRef }: { open: boolean; onClose: () => void; returnFocusRef: RefObject<HTMLButtonElement | null> }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => returnFocusRef.current?.focus();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [returnFocusRef]);

  const closeDialog = () => {
    dialogRef.current?.close();
    returnFocusRef.current?.focus();
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal privacy-modal"
      aria-labelledby="privacy-dialog-title"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        closeDialog();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
    >
      <div className="modal-header">
        <div>
          <p className="eyebrow">PRIVACY</p>
          <h2 id="privacy-dialog-title">隐私与资料边界</h2>
        </div>
        <button type="button" className="icon-button" onClick={closeDialog} aria-label="关闭隐私说明">
          <CloseIcon />
        </button>
      </div>
      <div className="privacy-icon"><ShieldIcon /></div>
      <ul className="privacy-list">
        <li>对话历史只保存在当前浏览器，可从页面一键清空。</li>
        <li>新的提问和必要的上下文会发送到服务器，并交给配置的模型服务。</li>
        <li>请勿输入密码、证件号码、联系方式等敏感信息。</li>
        <li>回答基于公开资料；资料不足时助手应明确说明，而不是猜测。</li>
      </ul>
    </dialog>
  );
}
