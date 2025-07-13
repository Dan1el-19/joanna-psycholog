# Email System Cloud Functions

Comprehensive email system using Firebase Trigger Email extension with TypeScript.

## Features

- ✅ **Welcome emails** for new user registrations
- ✅ **Order confirmations** when orders are created/confirmed  
- ✅ **Cart abandonment reminders** (3-stage automated sequence)
- ✅ **Email templates** with personalization
- ✅ **Email validation** with typo suggestions
- ✅ **Email logging** and status tracking
- ✅ **Bulk email** capabilities with rate limiting
- ✅ **Email statistics** and analytics

## Cloud Functions

### Triggered Functions

1. **sendWelcomeEmail** - Triggers when new user document created
2. **sendOrderConfirmation** - Triggers when order document created
3. **handleOrderStatusUpdate** - Triggers when order status changes
4. **sendCartReminders** - Scheduled daily to send abandonment reminders
5. **cleanupEmailLogs** - Scheduled weekly to cleanup old logs

### Callable Functions

1. **sendCustomEmail** - Admin function to send custom emails
2. **getEmailLogs** - Get email logs for specific recipient/template
3. **getEmailStats** - Get email sending statistics (admin only)

## Email Templates

### 1. Welcome Email (`welcome`)
- Triggered on user registration
- Variables: `firstName`, `userEmail`, `registrationDate`

### 2. Order Confirmation (`order-confirmation`) 
- Triggered on order creation/confirmation
- Variables: `customerName`, `orderId`, `items`, `totalAmount`, etc.

### 3. Cart Reminder (`cart-reminder`)
- Triggered by scheduled function for abandoned carts
- Variables: `customerName`, `items`, `reminderCount`, `daysLeft`

## Services

### EmailService
Main service for sending emails using Firebase extension.

```typescript
// Send welcome email
await EmailService.sendWelcomeEmail(userData);

// Send order confirmation  
await EmailService.sendOrderConfirmation(orderData);

// Send cart reminder
await EmailService.sendCartReminderEmail(reminderData);
```

### EmailValidationService
Validates email addresses and provides suggestions.

```typescript
const result = EmailValidationService.validateEmail('user@gmial.com');
// Returns: { isValid: false, suggestions: ['user@gmail.com'] }
```

### EmailLoggingService
Logs email status and provides analytics.

```typescript
// Log email queued
await EmailLoggingService.logEmailQueued({...});

// Update to sent
await EmailLoggingService.logEmailSent(logId);

// Get statistics
const stats = await EmailLoggingService.getEmailStats(30);
```

### EmailTemplatesService
Manages email templates with variable substitution.

```typescript
const template = EmailTemplatesService.getTemplate('welcome');
const processed = EmailTemplatesService.processTemplate(template.htmlTemplate, variables);
```

## Database Collections

### `mail` 
Firebase extension collection for sending emails.

### `emailLogs`
Tracks all email sending status and analytics.

### `users`
User collection that triggers welcome emails.

### `orders` 
Order collection that triggers confirmations and reminders.

## Environment Configuration

Update these values in `EmailService.CONFIG`:

```typescript
private static readonly CONFIG = {
  companyName: 'Your Company',
  companyAddress: 'Your Address',
  supportEmail: 'support@yourcompany.com',
  appUrl: 'https://yourapp.com',
  unsubscribeUrl: 'https://yourapp.com/unsubscribe'
};
```

## Deployment

1. Install dependencies:
```bash
cd functions
npm install
```

2. Build TypeScript:
```bash
npm run build
```

3. Deploy functions:
```bash
npm run deploy
```

## Cart Abandonment Flow

1. **Day 1**: First reminder with gentle nudge
2. **Day 3**: Second reminder with urgency
3. **Day 7**: Final reminder before removal

## Email Validation Features

- Format validation (RFC 5322 compliant)
- Domain typo detection (`gmial.com` → `gmail.com`)
- Disposable email detection
- Length and character validation
- Suggestions for common mistakes

## Logging and Analytics

All emails are logged with:
- Recipient email
- Subject and template used
- Status (queued → sent → delivered/failed)
- Timestamps for each status
- Error messages if failed
- Custom metadata

## Rate Limiting

Bulk emails are processed in batches with configurable delays to avoid rate limits.

## Security

- Admin-only functions require custom claims
- Email validation prevents malicious input
- Disposable email detection
- Input sanitization

## Error Handling

Comprehensive error handling with:
- Try-catch blocks in all functions
- Detailed error logging
- Graceful fallbacks
- Status tracking for failed emails