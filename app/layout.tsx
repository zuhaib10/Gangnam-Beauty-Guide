import type { Metadata } from "next";
import { Geist_Mono, Poppins, Roboto } from "next/font/google";
import "./globals.css";

const siteUrl = new URL("https://gangnam-review-passport.anonymousboy-yu.chatgpt.site");

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: "Review Passport — Gangnam Beauty Guide",
  description: "A provenance-first agent workflow for Korean clinic reviews.",
  openGraph: {
    title: "Review Passport — Gangnam Beauty Guide",
    description: "Four agents turn Korean clinic reviews into source-bound, auditable evidence.",
    type: "website",
    url: siteUrl,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Review Passport — trust is a chain of evidence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Review Passport — Gangnam Beauty Guide",
    description: "Four agents turn Korean clinic reviews into source-bound, auditable evidence.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${roboto.variable} ${geistMono.variable} ${poppins.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
