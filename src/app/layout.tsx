import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "FindStacks | Modern Technology Stack Analyzer",
  description: "Discover the frontend frameworks, backend runtimes, and external tools used by any website. High-performance signature detection with ChatGPT, Claude, and Gemini engines.",
  keywords: ["tech stack", "website analyzer", "react", "nextjs", "stack finder", "web discovery"],
  authors: [{ name: "FindStacks Team" }],
  openGraph: {
    title: "FindStacks | Tech Stack Discovery",
    description: "Reveal the hidden technology behind any URL.",
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
    title: "FindStacks | Tech Stack Discovery",
    description: "Reveal the hidden technology behind any URL.",
    images: ["/logo.png"],
  },
  icons: {
    icon: "/logo.png",
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
