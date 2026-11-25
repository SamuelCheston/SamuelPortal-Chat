"use client";

import CloseRounded from "@mui/icons-material/CloseRounded";
import LinkRounded from "@mui/icons-material/LinkRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Stack,
  Typography,
} from "@mui/material";
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

export function SourceDialog({ sources, onClose }: { sources: Source[] | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(sources)} onClose={onClose} maxWidth="md" fullWidth aria-labelledby="source-dialog-title">
      <DialogTitle sx={{ px: { xs: 3, sm: 4 }, pt: 4, pb: 1.5 }}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 2.5 }}>
          <Box>
            <Typography color="primary.dark" sx={{ mb: 0.625, fontSize: 10, fontWeight: 600, letterSpacing: "0.12em" }}>
              REFERENCE CHECK
            </Typography>
            <Typography component="h2" variant="h5" sx={{ fontWeight: 500 }}>回答依据</Typography>
          </Box>
          <IconButton onClick={onClose} aria-label="关闭来源"><CloseRounded /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ px: { xs: 3, sm: 4 }, py: 2.5 }}>
        <Typography color="text.secondary" sx={{ mb: 2.25, fontSize: 13 }}>
          这些是本次检索到的资料片段。请核对原文，引用本身不代表结论一定正确。
        </Typography>
        <Stack spacing={1.5}>
          {sources?.map((source) => {
            const href = safeLink(source.url);
            return (
              <Card key={source.id} className="source-card" variant="outlined" sx={{ borderColor: "divider", bgcolor: "background.paper" }}>
                <CardContent sx={{ p: { xs: 1.875, sm: 2.25 }, "&:last-child": { pb: { xs: 1.875, sm: 2.25 } } }}>
                  <Stack direction="row" sx={{ color: "text.secondary", fontSize: 11, alignItems: "center", gap: 1.25 }}>
                    <Chip className="source-id" label={source.id} size="small" color="secondary" sx={{ minWidth: 32, height: 26 }} />
                    {source.publishedAt && <Typography component="time" variant="caption">{source.publishedAt}</Typography>}
                  </Stack>
                  <Typography component="h3" variant="subtitle1" sx={{ mt: 1.375, mb: 0.375, fontWeight: 600 }}>{source.title}</Typography>
                  <Typography color="text.secondary" variant="body2" sx={{ mb: 1.25 }}>定位：{source.locator}</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{source.excerpt}</Typography>
                  {href && (
                    <Button
                      component="a"
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="contained"
                      color="secondary"
                      size="small"
                      startIcon={<LinkRounded />}
                      sx={{ mt: 1 }}
                    >
                      打开原始资料
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

export function PrivacyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="privacy-dialog-title">
      <DialogTitle sx={{ px: { xs: 3, sm: 4 }, pt: 4, pb: 1.5 }}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 2.5 }}>
          <Box>
            <Typography color="primary.dark" sx={{ mb: 0.625, fontSize: 10, fontWeight: 600, letterSpacing: "0.12em" }}>PRIVACY</Typography>
            <Typography component="h2" variant="h5" sx={{ fontWeight: 500 }}>隐私与资料边界</Typography>
          </Box>
          <IconButton onClick={onClose} aria-label="关闭隐私说明"><CloseRounded /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ px: { xs: 3, sm: 4 }, py: 2.5 }}>
        <Avatar sx={{ width: 52, height: 52, mb: 1.5, borderRadius: 4, bgcolor: "secondary.main", color: "secondary.contrastText" }}>
          <ShieldRounded sx={{ fontSize: 27 }} />
        </Avatar>
        <Box component="ul" sx={{ m: 0, pl: 3, color: "text.secondary", fontSize: 14 }}>
          <li>对话历史只保存在当前浏览器，可从页面一键清空。</li>
          <li>新的提问和必要的上下文会发送到服务器，并交给配置的模型服务。</li>
          <li>请勿输入密码、证件号码、联系方式等敏感信息。</li>
          <li>回答基于公开资料；资料不足时助手应明确说明，而不是猜测。</li>
        </Box>
        <Link href="https://classic.samuelcheston.com" underline="hover" sx={{ display: "inline-flex", mt: 2 }}>
          返回 Classic Portal
        </Link>
      </DialogContent>
    </Dialog>
  );
}
