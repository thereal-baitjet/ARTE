import { AccountOverview } from "@/components/auth/AccountOverview";

export const metadata = { title: "Your ARTE", robots: { index: false, follow: false } };

export default function ProfilePage() {
  return <AccountOverview />;
}
