# Production Setup Guide

This document outlines the steps required to configure external services for production deployment.

## Twilio (SMS)

### Free Trial Limitations
Twilio free trial accounts can only send SMS messages to **pre-verified recipient phone numbers**. This means:
- OTP codes cannot reach real donor phone numbers during development testing
- Notification SMS messages cannot reach real donor phone numbers
- This is a functional blocker, not just a cost concern

### Pre-Production Checklist
1. Upgrade Twilio account from Trial to Paid
2. Purchase a phone number capable of sending SMS to any number (not just verified ones)
3. Verify that SMS delivery works to test phone numbers across different Pakistani carriers
4. Update `TWILIO_FROM_NUMBER` in environment config with the purchased number
5. Set `SKIP_OTP_VERIFICATION` to `false` in production

### Cost Considerations
- Each SMS costs ~$0.0079 (varies by destination country)
- Each search that finds matches sends 1 SMS per matched donor
- Monitor usage to stay within budget

## SendGrid (Email)

### Free Tier Limitations
SendGrid free tier allows 100 emails/day. For any real-world deployment:
- Estimate expected daily search volume
- Calculate emails per search (1 per matched donor with email on file)
- Upgrade to a paid tier if expected volume exceeds free tier limits

### Pre-Production Checklist
1. Verify sender email/domain (SPF, DKIM, DMARC records)
2. Test email delivery to common providers (Gmail, Yahoo, local Pakistani providers)
3. Confirm `SENDGRID_FROM_EMAIL` is a verified sender in SendGrid
4. Set up email analytics to monitor deliverability

## Upstash Redis

- Used for: OTP storage, rate limiting, session token budget tracking
- All keys have TTLs so storage is self-cleaning
- Ensure Redis instance is in the same geographic region as the app for low latency
- Monitor for connection limits and data transfer caps

## PostgreSQL (via Prisma)

- Managed PostgreSQL (e.g., Neon, Supabase, RDS, or Vercel Postgres)
- Required extensions: none (Prisma manages schema)
- Run `npx prisma migrate deploy` on deploy, not `prisma db push`
- Set connection pool size appropriate for serverless (5-10 connections recommended)
- Enable SSL/TLS for production connections

## JWT Signing Key

Generate a secure random key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Environment Variables Validation

Before starting in production mode, verify all required env vars are set:
```bash
# Quick validation script
required_vars=(
  "DATABASE_URL"
  "UPSTASH_REDIS_REST_URL"
  "UPSTASH_REDIS_REST_TOKEN"
  "JWT_SIGNING_KEY"
  "TWILIO_ACCOUNT_SID"
  "TWILIO_AUTH_TOKEN"
  "TWILIO_FROM_NUMBER"
  "SENDGRID_API_KEY"
  "SENDGRID_FROM_EMAIL"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "ERROR: $var is not set"
    exit 1
  fi
done
echo "All required environment variables are set."
```
