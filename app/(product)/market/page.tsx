import type { Metadata } from "next";
import { MarketExplorer } from "@/components/market/MarketExplorer";

export const metadata: Metadata = { title: "Market", description: "Explore ARTE’s clearly labeled demo market, compare sample prices, and keep a private inquiry draft." };

export default function MarketPage() {
  return <MarketExplorer />;
}
