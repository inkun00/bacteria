import type { Metadata } from "next";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Factor Force | 약수와 배수 지구 방어대",
  description: "치료 세균을 지휘해 세계의 숫자 질병 세균을 제거하는 약수와 배수 수학 전략 게임",
  icons: {
    icon: `${basePath}/favicon.png`,
    shortcut: `${basePath}/favicon.png`,
  },
  openGraph: {
    title: "Factor Force | 약수와 배수 지구 방어대",
    description: "11개 세계 작전에서 약수와 배수를 배우고 지구를 해방하세요.",
    images: [`${basePath}/og.png`],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Factor Force | 약수와 배수 지구 방어대",
    description: "약수와 배수로 지구를 구하는 수학 전략 게임",
    images: [`${basePath}/og.png`],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
