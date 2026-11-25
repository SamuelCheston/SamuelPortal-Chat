"use client";

import { CssBaseline, ThemeProvider, createTheme, useMediaQuery } from "@mui/material";
import { useMemo, type ReactNode } from "react";

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const dark = useMediaQuery("(prefers-color-scheme: dark)");

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: dark ? "dark" : "light",
          primary: dark
            ? { main: "#9bd5b2", dark: "#7fb998", light: "#234b34", contrastText: "#003820" }
            : { main: "#246c4c", dark: "#185338", light: "#b7efca", contrastText: "#ffffff" },
          secondary: dark
            ? { main: "#234b34", dark: "#193824", light: "#4d7a60", contrastText: "#b7efca" }
            : { main: "#b7efca", dark: "#91d9aa", light: "#d9f8e4", contrastText: "#06351e" },
          error: dark
            ? { main: "#ffb4ab", dark: "#ff8d80", light: "#5c1f1b", contrastText: "#690005" }
            : { main: "#ba1a1a", dark: "#8f1212", light: "#ffdad6", contrastText: "#ffffff" },
          warning: dark
            ? { main: "#f2bd52", dark: "#c99a32", light: "#4a3814", contrastText: "#201600" }
            : { main: "#9a6700", dark: "#704d00", light: "#fff1cc", contrastText: "#ffffff" },
          background: dark
            ? { default: "#101511", paper: "#1a201b" }
            : { default: "#f7faf4", paper: "#ffffff" },
          text: dark
            ? { primary: "#e0e8de", secondary: "#b6c3b4", disabled: "#8e9b8d" }
            : { primary: "#191d19", secondary: "#414942", disabled: "#717971" },
          divider: dark ? "#4c584b" : "#c1c9bf",
        },
        shape: { borderRadius: 16 },
        typography: {
          fontFamily: 'Roboto, "Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
          button: { fontWeight: 600 },
        },
        components: {
          MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: {
              root: { borderRadius: 999, textTransform: "none" },
            },
          },
          MuiIconButton: {
            styleOverrides: {
              root: { borderRadius: 999 },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: { backgroundImage: "none" },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: { borderRadius: 20 },
            },
          },
          MuiDialog: {
            styleOverrides: {
              paper: { borderRadius: 28 },
            },
          },
          MuiAlert: {
            styleOverrides: {
              root: { borderRadius: 14 },
            },
          },
          MuiChip: {
            styleOverrides: {
              root: { borderRadius: 999 },
            },
          },
          MuiLink: {
            styleOverrides: {
              root: { textUnderlineOffset: "3px" },
            },
          },
        },
      }),
    [dark],
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}
