"use client";

import { useEffect } from "react";
import { startAccountActivity } from "@/lib/analytics/client";

export function AccountSession({ children }: { children: React.ReactNode }) {
  useEffect(() => startAccountActivity(), []);
  return children;
}
