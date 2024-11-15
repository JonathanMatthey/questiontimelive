import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "LiveQuestionTime | Interactive Q&A for Podcasters",
  description:
    "Host live Q&A sessions where your audience pays micropayments to submit questions. Powered by Open Payments.",
  keywords: ["podcast", "Q&A", "live", "micropayments", "Open Payments", "Interledger"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} font-sans min-h-screen bg-background`}>
        {children}
      </body>
    </html>
  );
}
