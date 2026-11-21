# ==============================================================================
# CloudFront: the public face of the site
# ==============================================================================

locals {
  site_origin_id = "site-bucket"
}

# The certificate is requested by the bootstrap stack and validated by a DNS
# record added by hand. Planning fails here, on purpose, until it is ISSUED.
data "aws_acm_certificate" "app" {
  provider    = aws.us_east_1
  domain      = var.app_domain_name
  statuses    = ["ISSUED"]
  most_recent = true
}

# AWS-managed policy: cache by path only, and obey the Cache-Control each file
# was uploaded with. The publish workflow sets those: hashed assets for a year,
# pages never.
data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

# CloudFront signs every request to the bucket, which is what lets the bucket
# stay private. AWS recommends this over the older origin access identity.
resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "${local.name_prefix}-web"
  description                       = "Lets the Ambrace ${var.environment} web distribution read its private bucket."
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_function" "clean_addresses" {
  name    = "${local.name_prefix}-web-clean-addresses"
  comment = "Maps a clean address (/viva) to the file the build wrote (viva.html)."
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = file("${path.module}/functions/clean-addresses.js")
}

resource "aws_cloudfront_distribution" "site" {
  enabled         = true
  comment         = "Ambrace ${var.environment} web app"
  aliases         = [var.app_domain_name]
  is_ipv6_enabled = true
  http_version    = "http2and3"

  # Class 100 has no edge locations in India. Class 200 is the cheapest that
  # serves Indian students from India.
  price_class = "PriceClass_200"

  origin {
    origin_id                = local.site_origin_id
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  default_cache_behavior {
    target_origin_id       = local.site_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id            = data.aws_cloudfront_cache_policy.caching_optimized.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.site.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.clean_addresses.arn
    }
  }

  # A private bucket answers "forbidden" for a file it does not have, so it
  # never reveals what exists. Either answer means "no such page" here, and the
  # visitor gets the app's own not-found page.
  dynamic "custom_error_response" {
    for_each = toset([403, 404])

    content {
      error_code            = custom_error_response.value
      response_code         = 404
      response_page_path    = "/404.html"
      error_caching_min_ttl = 10
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = data.aws_acm_certificate.app.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Name = "${local.name_prefix}-web"
  }
}
