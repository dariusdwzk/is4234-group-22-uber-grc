import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
        <div
          role="note"
          className="bg-amber-200 px-4 py-2 text-center text-sm font-medium text-black"
        >
          Demonstration — synthetic data
        </div>
        {children}
      </body>
    </html>
  );
}
