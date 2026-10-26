import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Banner } from "@/components/Banner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Uber 2016 GRC prototype",
  description: "Governance, risk and compliance demonstrator (synthetic data)",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Banner />
        {children}
      </body>
    </html>
  );
}
