# ==============================================================================
# Security headers, added by CloudFront to every response
# ==============================================================================
#
# A file store cannot set these itself. `local.headers` is the single list: the
# policy below is built from it, and the publish workflow checks the live site
# against the same list (output `expected_headers`).

locals {
  hsts_max_age = 31536000 # one year

  content_security_policy = join("; ", [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    # The built pages start themselves with small inline scripts. With no
    # server there is nothing to give each one a nonce, so inline is allowed;
    # scripts from any other site are not.
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    # The voice engine plays and records through blob-backed audio worklets.
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "connect-src 'self' ${join(" ", var.connect_sources)}",
  ])

  content_security_policy_header = (
    var.enforce_content_security_policy
    ? "content-security-policy"
    : "content-security-policy-report-only"
  )

  headers = {
    "strict-transport-security" = "max-age=${local.hsts_max_age}"
    "x-content-type-options"    = "nosniff"
    "x-frame-options"           = "DENY"
    "referrer-policy"           = "strict-origin-when-cross-origin"
    # A viva needs the microphone. Nothing needs the rest.
    "permissions-policy"                   = "camera=(), microphone=(self), geolocation=(), usb=()"
    (local.content_security_policy_header) = local.content_security_policy
  }
}

resource "aws_cloudfront_response_headers_policy" "site" {
  name    = "${local.name_prefix}-web-security-headers"
  comment = "Browser security baseline for the Ambrace ${var.environment} web app."

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = local.hsts_max_age
      include_subdomains         = false
      preload                    = false
      override                   = true
    }
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = local.headers["x-frame-options"]
      override     = true
    }
    referrer_policy {
      referrer_policy = local.headers["referrer-policy"]
      override        = true
    }

    # CloudFront only accepts the enforcing header here. Sent as a custom
    # header it is refused ("a security header ... cannot be set as custom
    # header"); the report-only form, below, is the other way round.
    dynamic "content_security_policy" {
      for_each = var.enforce_content_security_policy ? [local.content_security_policy] : []

      content {
        content_security_policy = content_security_policy.value
        override                = true
      }
    }
  }

  # "Server: AmazonS3" tells a visitor what is behind CloudFront for no benefit.
  remove_headers_config {
    items {
      header = "server"
    }
  }

  custom_headers_config {
    items {
      header   = "permissions-policy"
      value    = local.headers["permissions-policy"]
      override = true
    }
    dynamic "items" {
      for_each = var.enforce_content_security_policy ? [] : [local.content_security_policy]

      content {
        header   = "content-security-policy-report-only"
        value    = items.value
        override = true
      }
    }
  }
}
