"use client";

/**
 * @author: @kokonutui
 * @description: Inline Alert
 * @version: 1.0.0
 * @date: 2026-11-08
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 *
 * Restyled for GoldPrism: a driven gate alert, not a deploy simulation.
 */

import { ChevronDown, CircleAlert, RefreshCw, X } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface AlertCheck {
  name: string;
  /** Why it failed, shown under the name. */
  detail?: string;
  ok: boolean;
}

export interface InlineAlertProps {
  title: string;
  message: string;
  checks?: AlertCheck[];
  /** `error` blocks the run; `warning` admits it with rejections. */
  tone?: "error" | "warning";
  action?: { label: string; onClick: () => void };
  onDismiss?: () => void;
  className?: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export default function InlineAlert({
  title,
  message,
  checks = [],
  tone = "error",
  action,
  onDismiss,
  className,
}: InlineAlertProps) {
  const [visible, setVisible] = useState(true);
  const [open, setOpen] = useState(true);

  const dismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  const failed = checks.filter((check) => !check.ok);

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("w-full", className)}>
        <AnimatePresence initial={false}>
          {visible ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "relative rounded-sm border-2 bg-card text-foreground shadow-[3px_3px_0_var(--gp-slag-900)]",
                tone === "error"
                  ? "border-[var(--gp-blocked-ink)]"
                  : "border-[var(--gp-watch-ink)]"
              )}
              exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
              initial={{ opacity: 0, y: 6 }}
              key="alert"
              role={tone === "error" ? "alert" : "status"}
              transition={{ duration: 0.22, ease: EASE_OUT }}
            >
              <div className="flex gap-3 p-4">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-sm border",
                    tone === "error"
                      ? "border-[var(--gp-blocked-ink)] text-[var(--gp-blocked-ink)]"
                      : "border-[var(--gp-watch-ink)] text-[var(--gp-watch-ink)]"
                  )}
                >
                  <CircleAlert aria-hidden="true" className="size-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="gp-label">
                        Ingestion gate ·{" "}
                        {tone === "error" ? "Run blocked" : "Partial"}
                      </p>
                      <p className="gp-serif mt-1 text-lg leading-tight">{title}</p>
                      <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                        {message}
                      </p>
                    </div>
                    <button
                      aria-label="Dismiss"
                      className="-mt-1 -mr-1 flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-[var(--gp-gold)]"
                      onClick={dismiss}
                      type="button"
                    >
                      <X aria-hidden="true" className="size-4" />
                    </button>
                  </div>

                  {checks.length > 0 ? (
                    <>
                      <button
                        aria-expanded={open}
                        className="mt-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-[var(--gp-gold)]"
                        onClick={() => setOpen((value) => !value)}
                        type="button"
                      >
                        {failed.length || checks.length}{" "}
                        {(failed.length || checks.length) === 1
                          ? "reason code"
                          : "reason codes"}
                        <ChevronDown
                          aria-hidden="true"
                          className={cn(
                            "size-3 transition-transform duration-200",
                            open && "rotate-180"
                          )}
                        />
                      </button>

                      <AnimatePresence initial={false}>
                        {open ? (
                          <motion.ul
                            animate={{ height: "auto", opacity: 1 }}
                            className="overflow-hidden"
                            exit={{ height: 0, opacity: 0 }}
                            initial={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: EASE_OUT }}
                          >
                            {checks.map((check) => (
                              <li
                                className="flex items-start justify-between gap-3 border-b border-border py-2 last:border-b-0"
                                key={check.name}
                              >
                                <div className="min-w-0">
                                  <p
                                    className={cn(
                                      "font-mono text-[10px] uppercase tracking-[0.12em]",
                                      check.ok
                                        ? "text-[var(--gp-tradable-ink)]"
                                        : "text-[var(--gp-blocked-ink)]"
                                    )}
                                  >
                                    {check.name}
                                  </p>
                                  {check.detail ? (
                                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                                      {check.detail}
                                    </p>
                                  ) : null}
                                </div>
                                <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                                  {check.ok ? "Passed" : "Rejected"}
                                </span>
                              </li>
                            ))}
                          </motion.ul>
                        ) : null}
                      </AnimatePresence>
                    </>
                  ) : null}

                  {action ? (
                    <button
                      className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-sm border border-foreground bg-background px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground outline-none transition-colors duration-150 hover:bg-foreground hover:text-background focus-visible:ring-2 focus-visible:ring-[var(--gp-gold)]"
                      onClick={action.onClick}
                      type="button"
                    >
                      <RefreshCw aria-hidden="true" className="size-3" />
                      {action.label}
                    </button>
                  ) : null}
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
