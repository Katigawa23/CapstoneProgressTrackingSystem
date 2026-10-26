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
                  var storedTheme = window.localStorage.getItem(storageKey);

                  // Migrate the preference saved by older versions of TrackSphere.
                  if (storedTheme !== "dark" && storedTheme !== "light") {
                    var authStorageKey = "tracksphere_auth_session";
                    var sessionValue = window.localStorage.getItem(authStorageKey);
                    var legacyKeys = [];

                    if (sessionValue) {
                      try {
                        var session = JSON.parse(sessionValue);
                        var userId = session && session.user && typeof session.user.id === "string"
                          ? session.user.id
                          : null;
                        if (userId) legacyKeys.push(storageKey + ":" + userId);
                      } catch (error) {}
                    }

                    legacyKeys.push(storageKey + ":guest");
                    for (var index = 0; index < legacyKeys.length; index += 1) {
                      var legacyTheme = window.localStorage.getItem(legacyKeys[index]);
                      if (legacyTheme === "dark" || legacyTheme === "light") {
                        storedTheme = legacyTheme;
                        window.localStorage.setItem(storageKey, legacyTheme);
                        break;
                      }
                    }
                  }

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
