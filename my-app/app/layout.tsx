import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "TrackSphere",
  description: "TrackSphere helps students and advisers manage capstone milestones, collaboration, and project progress in one place.",
  icons: {
    icon: "/logoTS.png",
    shortcut: "/logoTS.png",
    apple: "/logoTS.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // eslint-disable-next-line react-hooks/purity
  const trustedServerNowMs = Date.now()

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var storageKey = "theme-preference";
                  var authStorageKey = "tracksphere_auth_session";
                  var guestStorageKey = storageKey + ":guest";
                  var sessionValue = window.localStorage.getItem(authStorageKey);
                  var userThemeStorageKey = guestStorageKey;

                  if (sessionValue) {
                    try {
                      var session = JSON.parse(sessionValue);
                      var userId = session && session.user && typeof session.user.id === "string"
                        ? session.user.id
                        : null;

                      if (userId) {
                        userThemeStorageKey = storageKey + ":" + userId;
                      }
                    } catch (error) {}
                  }

                  var storedTheme = window.localStorage.getItem(userThemeStorageKey);
                  var isDark = storedTheme === "dark" || (!storedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches);
                  document.documentElement.classList.toggle("dark", isDark);
                  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
                } catch (error) {}
              })();
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  window.__TRACKSPHERE_TIME_SYNC__ = {
                    serverNowMs: ${trustedServerNowMs},
                    performanceNowMs:
                      typeof window.performance?.now === "function" ? window.performance.now() : 0,
                    timeZone: "Asia/Singapore"
                  };
                } catch (error) {}
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
