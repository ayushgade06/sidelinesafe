import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Public_Sans } from "next/font/google";
import "./globals.css";

const barlow = Barlow_Condensed({ variable: "--font-barlow", subsets: ["latin"], weight: ["600", "800"] });
const publicSans = Public_Sans({ variable: "--font-public", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SidelineSafe: heat-safety practice planner",
  description:
    "Plan youth sports practices around the heat. Forecast WBGT, US Soccer/KSI flag guidelines, safest practice windows, break schedules and family messages. Free, no meter, no login.",
};

export const viewport: Viewport = { themeColor: "#0c1e33" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${barlow.variable} ${publicSans.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
