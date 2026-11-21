locals {
  account_id = data.aws_caller_identity.current.account_id

  # Everything this stack owns is named ambrace-<env>-*; the deploy role's
  # permissions (ambrace-backend/infra/bootstrap/web_deploy.tf) rely on it.
  name_prefix = "ambrace-${var.environment}"

  # The only bucket name the deploy role may create.
  site_bucket_name = "${local.name_prefix}-web-${local.account_id}"

  # Where the publish workflow finds what it needs. The role may write here and
  # nowhere else in SSM.
  hosting_parameter_prefix = "/ambrace/${var.environment}/web/hosting"
}

# ==============================================================================
# The site's files
# ==============================================================================
#
# Private. The only reader is this stack's CloudFront distribution, and the only
# writer is the publish workflow. Not versioned: every file can be rebuilt from
# Git, so old versions would only cost storage.

resource "aws_s3_bucket" "site" {
  bucket = local.site_bucket_name

  tags = {
    Name = local.site_bucket_name
  }
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket = aws_s3_bucket.site.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Required for CloudFront origin access control: no ACLs, the bucket owns
# every object.
resource "aws_s3_bucket_ownership_controls" "site" {
  bucket = aws_s3_bucket.site.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "site" {
  bucket = aws_s3_bucket.site.id

  rule {
    # SSE-S3: no customer-managed KMS key, so no monthly key charge.
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "site" {
  bucket = aws_s3_bucket.site.id

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

data "aws_iam_policy_document" "site_bucket" {
  # The policy AWS documents for origin access control: CloudFront may read
  # objects, and only on behalf of this one distribution.
  statement {
    sid       = "AllowCloudFrontServicePrincipalReadOnly"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.site.arn]
    }
  }

  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.site.arn,
      "${aws_s3_bucket.site.arn}/*",
    ]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = data.aws_iam_policy_document.site_bucket.json

  depends_on = [aws_s3_bucket_public_access_block.site]
}

# ==============================================================================
# Where to publish: read by the publish workflow
# ==============================================================================
# Names and IDs, not secrets. Plain String, Standard tier: no charge.

resource "aws_ssm_parameter" "site_bucket" {
  name        = "${local.hosting_parameter_prefix}/site_bucket"
  description = "Ambrace ${var.environment} web: bucket the built site is uploaded to."
  type        = "String"
  tier        = "Standard"
  value       = aws_s3_bucket.site.id
}

resource "aws_ssm_parameter" "distribution_id" {
  name        = "${local.hosting_parameter_prefix}/distribution_id"
  description = "Ambrace ${var.environment} web: CloudFront distribution to refresh after an upload."
  type        = "String"
  tier        = "Standard"
  value       = aws_cloudfront_distribution.site.id
}

# The publish workflow checks every response of the live site against this, so
# a header that stops being sent is caught on the next publish.
resource "aws_ssm_parameter" "expected_headers" {
  name        = "${local.hosting_parameter_prefix}/expected_headers"
  description = "Ambrace ${var.environment} web: security headers every response must carry (JSON)."
  type        = "String"
  tier        = "Standard"
  value       = jsonencode(local.headers)
}
