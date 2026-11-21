output "site_bucket_name" {
  description = "Bucket the built site is uploaded to."
  value       = aws_s3_bucket.site.id
}

output "distribution_id" {
  description = "CloudFront distribution serving the site."
  value       = aws_cloudfront_distribution.site.id
}

output "distribution_domain_name" {
  description = "Point the app domain's CNAME record at this, at the DNS provider."
  value       = aws_cloudfront_distribution.site.domain_name
}

output "app_url" {
  description = "Public address of the web app."
  value       = "https://${var.app_domain_name}"
}

output "expected_headers" {
  description = "Security headers every response must carry. The publish workflow checks the live site against this."
  value       = local.headers
}
