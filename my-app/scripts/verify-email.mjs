import nextEnv from "@next/env"
import nodemailer from "nodemailer"

const { loadEnvConfig } = nextEnv

loadEnvConfig(process.cwd())
async function main() {
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.replace(/\s/g, "")
  if (!user || !pass) {
    console.error("Set SMTP_USER and SMTP_PASS in .env.local first. Do not paste the password in chat.")
    process.exitCode = 1
    return
  }
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  })
  try {
    await transport.verify()
    console.log("Gmail SMTP connection and authentication passed. No email was sent.")
  } catch (error) {
    console.error("Gmail SMTP verification failed.", { code: error.code ?? "UNKNOWN", responseCode: error.responseCode })
    process.exitCode = 1
  } finally { transport.close() }
}
main().catch(() => { console.error("Email configuration verification failed."); process.exitCode = 1 })
