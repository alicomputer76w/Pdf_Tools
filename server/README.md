# WhatsApp Number Verification Server (Optional)

This optional backend enables advanced verification to check whether a phone number is registered on WhatsApp before letting the visitor submit the feedback.

Client-only websites cannot reliably verify WhatsApp registration; WhatsApp decides the sender account based on the user logged into the device/browser. To verify numbers programmatically, you must use the WhatsApp Business Cloud API.

## What this server does

- Exposes `POST /api/verify-whatsapp` endpoint
- Accepts JSON `{ "number": "923001234567" }` (international format without `+`)
- Calls Meta’s WhatsApp Business Cloud API Contacts endpoint to verify
- Returns `{ status: "valid", wa_id: "<whatsapp_id>" }` or `{ status: "invalid" }`

## Prerequisites

1. Create a Meta Developer account and set up WhatsApp Business Cloud API:
   - https://developers.facebook.com/docs/whatsapp/cloud-api
2. Get your WhatsApp **Phone Number ID** and a **Permanent Access Token**.
3. Keep your token secret — never commit it to source control.

## Setup

1. Copy `.env.example` to `.env` and fill values:

```
WABA_TOKEN=YOUR_PERMANENT_ACCESS_TOKEN
WABA_PHONE_NUMBER_ID=YOUR_PHONE_NUMBER_ID
PORT=8080
ALLOWED_ORIGIN=https://your-frontend-domain
```

2. Install dependencies and run:

```
cd server
npm install
npm start
```

3. Deploy on your preferred platform (Render, Railway, Fly.io, etc.). Make sure environment variables are configured.

## Endpoint usage

POST `/api/verify-whatsapp`

Request body:

```json
{ "number": "923001234567" }
```

Response (valid):

```json
{ "status": "valid", "wa_id": "1234567890" }
```

Response (invalid):

```json
{ "status": "invalid" }
```

## Connect frontend

In `feedback.html`, set:

```js
const WA_VERIFY_ENDPOINT = 'https://your-deployed-host/api/verify-whatsapp';
```

When configured, the Verify button and Submit will call the backend to check the number. If invalid, the UI will show: "This number is not on WhatsApp" and prevent submission.

## Notes

- The verification uses Meta’s Contacts API: `POST https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/contacts` with body `{"blocking":"wait","contacts":["+923001234567"],"force_check":true}`.
- Rate limits and access control apply. Use CORS carefully (restrict `ALLOWED_ORIGIN`).
- Do not expose your token. Keep the server separate from the static site.