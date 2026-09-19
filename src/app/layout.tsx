import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
});

export const metadata: Metadata = {
  title: "PlayNear — Local Sports Tournament & Community Platform",
  description: "Discover, organize, and compete in local sports tournaments near you. Join teams, track live scores, and connect with athletes on PlayNear.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.png",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-full bg-[#b8c5a8] text-[#191314] p-2 sm:p-4 lg:p-6 antialiased selection:bg-[#ecf95a] selection:text-[#191314]`}>
        {/* Main Floating Zen App Canvas */}
        <div className="max-w-[1440px] mx-auto min-h-[calc(100vh-2rem)] sm:min-h-[calc(100vh-3rem)] bg-[#ffffff] rounded-[28px] sm:rounded-[36px] lg:rounded-[42px] border border-[#191314]/[0.08] shadow-[0_24px_70px_-20px_rgba(25,19,20,0.12)] flex flex-col overflow-hidden">
          <Navbar />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
