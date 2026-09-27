import { AppShell } from "@/components/navigation/AppShell";

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
