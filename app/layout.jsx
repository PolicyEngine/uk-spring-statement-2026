import "./globals.css";

export const metadata = {
  title: "Spring Statement 2026 | PolicyEngine",
  description:
    "PolicyEngine analysis of the OBR's March 2026 economic forecast revisions and their projected impact on UK household incomes.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
