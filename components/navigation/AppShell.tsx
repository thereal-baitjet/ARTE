import { DesktopNavigation } from "./DesktopNavigation";
import { MobileNavigation } from "./MobileNavigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:flex">
      <DesktopNavigation />
      <main className="min-w-0 flex-1 pb-24 lg:pb-0">{children}</main>
      <MobileNavigation />
    </div>
  );
}
