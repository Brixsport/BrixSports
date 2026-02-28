# 📧 Email Service Setup Guide - Gmail with Nodemailer

**Last Updated:** January 2026

---

## 🚀 Quick Setup

### Step 1: Enable 2-Step Verification

1. Go to your Google Account: https://myaccount.google.com/security
2. Enable **2-Step Verification** if not already enabled
3. Follow the setup process (usually involves your phone)

### Step 2: Generate App Password

1. Go to: https://myaccount.google.com/apppasswords
2. Select **"Mail"** as the app
3. Select **"Other (Custom name)"** as the device
4. Enter **"Brixsport"** as the name
5. Click **"Generate"**
6. Copy the **16-character password** (it will look like: `abcd efgh ijkl mnop`)

### Step 3: Configure Environment Variables

Add these to your `.env.local` file:

```bash
# Gmail Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=abcdefghijklmnop
```

**Important Notes:**
- `EMAIL_USER` should be your full Gmail address
- `EMAIL_PASS` should be the 16-character App Password (remove spaces if present)
- Never commit these values to version control

---

## ✅ Verify Email Configuration

### Option 1: Test via API Endpoint

**Check Connection:**
```bash
curl http://localhost:3000/api/email/test
```

**Send Test Email:**
```bash
curl -X POST http://localhost:3000/api/email/test \
  -H "Content-Type: application/json" \
  -d '{"to": "your-email@gmail.com"}'
```

### Option 2: Test via Browser

1. Visit: `http://localhost:3000/api/email/test` (GET request)
2. You should see a JSON response indicating if the connection is successful

---

## 📝 Available Email Functions

The email service is located in `src/lib/email.ts` and provides the following functions:

### 1. `sendEmail(config)` - General Purpose
Send any email with custom content.

```typescript
import { sendEmail } from '@/lib/email';

await sendEmail({
    to: 'user@example.com',
    subject: 'Your Subject',
    html: '<h1>Hello!</h1>',
    text: 'Hello!', // Optional plain text version
});
```

### 2. `sendPasswordResetEmail(to, resetLink)` - Password Reset
Send a password reset email with a styled template.

```typescript
import { sendPasswordResetEmail } from '@/lib/email';

await sendPasswordResetEmail(
    'user@example.com',
    'https://yourapp.com/reset-password?token=abc123'
);
```

### 3. `sendWelcomeEmail(to, userName)` - Welcome Email
Send a welcome email to new users.

```typescript
import { sendWelcomeEmail } from '@/lib/email';

await sendWelcomeEmail('user@example.com', 'John Doe');
```

### 4. `sendNotificationEmail(to, title, message, actionUrl?, actionText?)` - Notifications
Send notification emails with optional action buttons.

```typescript
import { sendNotificationEmail } from '@/lib/email';

await sendNotificationEmail(
    'user@example.com',
    'New Match Scheduled',
    'Your team has a match tomorrow at 3 PM.',
    'https://yourapp.com/matches/123',
    'View Match'
);
```

### 5. `verifyEmailConnection()` - Connection Test
Verify that the email transporter is configured correctly.

```typescript
import { verifyEmailConnection } from '@/lib/email';

const isConnected = await verifyEmailConnection();
if (isConnected) {
    console.log('Email service is ready!');
}
```

---

## 🔧 Usage Examples

### Example 1: Password Reset Flow

```typescript
// In your API route (e.g., src/app/api/auth/forgot-password/route.ts)
import { sendPasswordResetEmail } from '@/lib/email';

// Generate reset token and link
const resetToken = crypto.randomBytes(32).toString('hex');
const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

// Send email
try {
    await sendPasswordResetEmail(user.email, resetLink);
    console.log('Password reset email sent successfully');
} catch (error) {
    console.error('Failed to send email:', error);
}
```

### Example 2: Custom Email

```typescript
import { sendEmail } from '@/lib/email';

await sendEmail({
    to: ['user1@example.com', 'user2@example.com'],
    subject: 'Match Reminder',
    html: `
        <h1>Match Reminder</h1>
        <p>Your match starts in 1 hour!</p>
    `,
    cc: 'coach@example.com',
});
```

### Example 3: Email with Attachments

```typescript
import { sendEmail } from '@/lib/email';

await sendEmail({
    to: 'user@example.com',
    subject: 'Match Report',
    html: '<p>Please find the match report attached.</p>',
    attachments: [
        {
            filename: 'report.pdf',
            path: '/path/to/report.pdf',
        },
    ],
});
```

---

## 🐛 Troubleshooting

### Error: "Invalid login"
- **Cause:** Wrong App Password or email address
- **Solution:** 
  1. Verify `EMAIL_USER` is your full Gmail address
  2. Generate a new App Password and update `EMAIL_PASS`
  3. Make sure there are no spaces in the App Password

### Error: "Connection timeout"
- **Cause:** Network issues or Gmail blocking the connection
- **Solution:**
  1. Check your internet connection
  2. Verify Gmail is accessible
  3. Check if your IP is blocked by Google

### Error: "Less secure app access"
- **Cause:** This error shouldn't occur with App Passwords
- **Solution:** Make sure you're using an App Password, not your regular Gmail password

### Email not received
- **Check spam folder:** Gmail might mark test emails as spam
- **Check email logs:** Look at server console for error messages
- **Verify recipient:** Make sure the email address is correct
- **Rate limiting:** Gmail has sending limits (500 emails/day for free accounts)

---

## 📊 Gmail Sending Limits

- **Free Gmail accounts:** 500 emails per day
- **Google Workspace:** 2,000 emails per day
- **Rate limit:** ~100 emails per hour

For production with high volume, consider:
- Using a dedicated email service (SendGrid, Mailgun, AWS SES)
- Implementing email queuing
- Using OAuth2 instead of App Passwords for better security

---

## 🔒 Security Best Practices

1. **Never commit credentials:** Always use environment variables
2. **Use App Passwords:** Never use your regular Gmail password
3. **Rotate passwords:** Change App Passwords periodically
4. **Monitor usage:** Check Gmail activity for suspicious access
5. **Rate limiting:** Implement rate limiting in your application
6. **Error handling:** Don't expose sensitive error messages to users

---

## 🚀 Production Deployment

### Environment Variables for Production

```bash
EMAIL_USER=your-production-email@gmail.com
EMAIL_PASS=your-production-app-password
```

### Considerations

1. **Use a dedicated Gmail account** for production emails
2. **Set up email monitoring** to track delivery rates
3. **Implement retry logic** for failed sends
4. **Use email templates** for consistent branding
5. **Monitor Gmail sending limits** and upgrade if needed

---

## 📚 Additional Resources

- [Nodemailer Documentation](https://nodemailer.com/about/)
- [Gmail App Passwords Guide](https://support.google.com/accounts/answer/185833)
- [Google Account Security](https://myaccount.google.com/security)

---

## ✅ Verification Checklist

- [ ] 2-Step Verification enabled on Google Account
- [ ] App Password generated
- [ ] Environment variables set in `.env.local`
- [ ] Email connection test passes (`/api/email/test`)
- [ ] Test email received successfully
- [ ] Password reset emails working
- [ ] Error handling implemented

---

**Status:** ✅ **READY TO USE**  
**Service:** Gmail with Nodemailer  
**Location:** `src/lib/email.ts`
