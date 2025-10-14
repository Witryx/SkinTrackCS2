import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SkinTrack CS2",
  description: "Databáze a sledování cen CS2 skinů",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        {/* App Shell */}
        <Header />
        <main className="flex-1 container-max py-8">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
