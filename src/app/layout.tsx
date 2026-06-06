import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  metadataBase: new URL('https://findstacks.vercel.app'),
  title: "FindStacks | Stack + Public ENV Analyzer",
  description: "Discover hidden tech stacks, browser-visible public environment variables, and client-side build clues with ChatGPT, Claude, and Gemini engines.",
  keywords: ["tech stack", "website analyzer", "public env", "runtime config", "nextjs", "stack finder", "web discovery"],
  authors: [{ name: "FindStacks Team" }],
  openGraph: {
    title: "FindStacks | Stack + Public ENV Discovery",
    description: "Reveal hidden technologies and public runtime config behind any URL.",
    url: "https://findstacks.vercel.app",
    siteName: "FindStacks",
    images: [
      {
        url: "/logo.png",
        width: 800,
        height: 800,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FindStacks | Stack + Public ENV Discovery",
    description: "Reveal hidden technologies and public runtime config behind any URL.",
    images: ["/logo.png"],
  },
  icons: {
    icon: "/logo.png",
  },
  other: {
    "backendlab-verify": "bl_v_molbtwr7_ugd6d5dx",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${outfit.variable}`}>
        {children}
      </body>
    </html>
  );
}
