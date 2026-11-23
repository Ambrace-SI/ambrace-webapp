# Ambrace Dev account. No secrets belong in this file.
environment     = "dev"
aws_account_id  = "798299234172"
app_domain_name = "app-dev.ambrace.in"

# Everything the browser talks to besides the app itself.
connect_sources = [
  "https://api-dev.ambrace.in",
  # Sign-in: the Cognito API, and the hosted pages that finish a Google sign-in.
  "https://cognito-idp.ap-south-1.amazonaws.com",
  "https://ambrace-dev.auth.ap-south-1.amazoncognito.com",
  # The live viva: the browser streams audio straight to Gemini.
  "wss://generativelanguage.googleapis.com",
  # Analytics (PostHog), only when the build has a key: events and recordings
  # go to the first, and the project's settings are read from the second.
  "https://us.i.posthog.com",
  "https://us-assets.i.posthog.com",
]

# The browser enforces the policy on dev. Prod stays report-only until a full
# viva has run here with a clean console.
enforce_content_security_policy = true
