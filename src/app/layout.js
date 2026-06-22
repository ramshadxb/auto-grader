import "./globals.css";

export const metadata = {
  title: "AutoGrader AI",
  description: "Automated Assignment Grader utilizing AI and Plagiarism Checks",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
