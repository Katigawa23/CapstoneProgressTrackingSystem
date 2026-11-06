# TrackSphere task emails

Sender: `TrackSphere Notifications <tracksphere.notifications@gmail.com>`.
Recipients are the registered school email addresses stored for students, group advisers, or program coordinators. They can read the messages in Outlook; no Microsoft mail permission is required for this Gmail transport. Microsoft school login is unchanged.

## Configure locally

The following fields are in `.env.local` (gitignored):

```dotenv
TASK_EMAIL_ENABLED=true
SMTP_USER=tracksphere.notifications@gmail.com
SMTP_PASS=
```

Paste the Gmail **App Password** into `SMTP_PASS` on your own computer. Do not use the normal Google password, commit the credential, or paste it into chat. Spaces in Google's grouped App Password are removed by the transport.

`APP_URL` must point to this running app. For recipients on other devices, use the public deployed HTTPS address; a localhost link only works on the development computer.

Run `npm run email:verify` from `my-app`. This checks Gmail authentication without sending any mail. Restart the dev server after configuring credentials.

## Trigger an end-to-end test

1. Use registered, real school accounts and a group visible to the intended recipient.
2. Assign a new task to a student. The student's school mailbox should receive a task assignment email.
3. Upload a file or add a web link as a student. The group's adviser should receive a submission email.
4. Mark the task Completed or Revision as the assigned adviser. The assigned student should receive the review email.
5. Assign, replace, or remove a coordinator as superadmin. The newly assigned faculty receives the program assignment; the previous coordinator receives a removal notice. Saving the unchanged assignment sends nothing.
6. Create a group with an adviser. The assigned adviser receives the group assignment email.
7. Submit a weekly journal as a student. Only the group's advisers receive the review notice; saving a draft sends nothing. Add feedback as the assigned adviser: the group's students receive a feedback notice with the group name and week, without the private feedback content in the email.
8. Open the email button. Logged-out recipients go to the landing page first, then back to the destination after Microsoft login. Notification ownership and current project access are checked. Journal links select the group and week; coordinator notices open the dashboard.

Check Outlook's Junk folder as well as the Inbox. SMTP acceptance does not guarantee inbox placement or final delivery by the receiving school server.

## Deployment

Add `TASK_EMAIL_ENABLED`, `SMTP_USER`, `SMTP_PASS`, and the public HTTPS `APP_URL` to Vercel's environment variables, then redeploy. Store `SMTP_PASS` as a server-only secret. No Gmail password goes into any `NEXT_PUBLIC_` variable.

## Delivery behavior

- Enabled types: task assignment, student file/link submission, adviser completion/revision, coordinator assignment/removal, group adviser assignment, weekly journal submission, and weekly journal adviser feedback.
- Deadline reminder emails are not enabled. Existing in-app deadline notifications keep working.
- A new notification and its email queue record are inserted atomically. Duplicate notification dedupe keys do not create another email.
- The first notification operation initializes `notification_email_deliveries` using the existing runtime schema setup. No historical notifications are backfilled.
- The request attempts its own queued email before responding when credentials are configured. Missing configuration leaves messages pending and does not fail the task operation.
- New queue records identify their environment (local, preview, or production). A local worker cannot consume a production email. Legacy records without an environment are reserved for the production worker.
- Gmail acceptance is recorded with its SMTP message ID and response. `sent` means Gmail accepted the message, not that the school inbox delivered it. Runtime logs report the environment and notification ID without passwords or email bodies.
- Failed deliveries may retry through the protected worker endpoint (up to three attempts, at least five minutes apart).
- For retries independent of user activity, configure a scheduler to call `GET /api/internal/notification-emails` with `Authorization: Bearer <CRON_SECRET>` and add that server-side secret to the environment. A call processes at most five messages; no scheduler has been provisioned automatically.
- Unconfirmed SMTP network failures, or a database failure after SMTP acceptance, are not automatically resent to avoid duplicates. Inspect `notification_email_deliveries` statuses (`sending`/`uncertain`) before manually retrying those records.
- Each delivery uses a stable Message-ID for troubleshooting. This is not an exactly-once guarantee across SMTP/network failures.

Official references: [Google App Passwords](https://support.google.com/accounts/answer/185833), [Nodemailer Gmail](https://nodemailer.com/usage/using-gmail/), [Nodemailer SMTP](https://nodemailer.com/smtp).
