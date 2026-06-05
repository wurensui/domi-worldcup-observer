import "./globals.css";

export const metadata = {
  title: "DOMI 多米花园 | 节令手作 H5",
  description: "海口城市节令手作品牌 DOMI 多米花园，把每个节日做成值得分享的手作记忆。",
  icons: {
    icon: "/favicon.svg"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
