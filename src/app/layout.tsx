import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Emma AI",
  description: "Trợ lý luyện giao tiếp tiếng Anh bằng giọng nói cho trẻ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: browser extensions often inject attributes
    // (e.g. data-yd-*) onto <html>/<body> before React hydrates.
    <html lang="vi" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
