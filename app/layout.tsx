import type { Metadata } from "next";
import { Noto_Serif_KR } from "next/font/google";
import { AuthProvider } from "@/lib/AuthContext";
import "./globals.css";

const notoSerifKR = Noto_Serif_KR({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "900"],
  variable: "--font-noto-serif",
});

export const metadata: Metadata = {
  title: "한국문학도서관",
  description: "아름다운 한국 문학을 만나보세요.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${notoSerifKR.className} antialiased bg-[#fdfbf7]`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
