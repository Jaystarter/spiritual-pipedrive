"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

import { useTheme } from "@/lib/theme-client"

const Toaster = ({ ...props }: ToasterProps) => {
  // The app themes via data-theme (light/dark/star), not next-themes.
  // Star mode is a dark-canvas theme, so sonner renders it as "dark".
  const [theme] = useTheme()

  return (
    <Sonner
      theme={theme === "light" ? "light" : "dark"}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--sd-surface-raised)",
          "--normal-text": "var(--sd-ink)",
          "--normal-border": "var(--sd-line-strong)",
          "--border-radius": "var(--sd-r-md)",
          zIndex: "var(--z-toast)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
