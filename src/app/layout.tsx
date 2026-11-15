import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Newsreader } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/store";
import { Shell } from "@/components/Shell";

const serif = Newsreader({ subsets: ["latin"], variable: "--font-serif", axes: ["opsz"], style: ["normal", "italic"], display: "swap" });
const sans = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Trojan Mentor — The Trojan Network, activated", template: "%s · Trojan Mentor" },
  description:
    "Trojan Mentor pairs USC students with opt-in alumni mentors and helps turn one introduction into a lasting relationship. Independent AI@USC hackathon project; not affiliated with USC.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#7d1428", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <AppProvider>
          <Shell>{children}</Shell>
        </AppProvider>
      </body>
    </html>
  );
}
