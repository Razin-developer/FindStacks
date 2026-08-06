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

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'FindStacks',
  url: 'https://findstacks.vercel.app',
  description:
    'Discover hidden tech stacks, browser-visible public environment variables, and client-side build clues with ChatGPT, Claude, and Gemini engines.',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Any',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${inter.variable} ${outfit.variable}`}>
        {children}
        <script
          type="text/javascript"
          dangerouslySetInnerHTML={{
            __html: `
              (function(c,l,a,r,i,t,y){
                  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "xy725v8gtw");
            `,
          }}
        />
      </body>
    </html>
  );
}
