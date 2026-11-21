# Offline contract tests: no AWS credentials or network calls to AWS are needed.
# Run with: terraform test

mock_provider "aws" {
  # The mock provider cannot render real policy JSON; give resources a valid
  # empty document so plan-time JSON validation passes.
  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }

  mock_data "aws_caller_identity" {
    defaults = {
      account_id = "798299234172"
    }
  }

  mock_data "aws_cloudfront_cache_policy" {
    defaults = {
      id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
    }
  }
}

mock_provider "aws" {
  alias = "us_east_1"

  mock_data "aws_acm_certificate" {
    defaults = {
      arn = "arn:aws:acm:us-east-1:798299234172:certificate/00000000-0000-0000-0000-000000000000"
    }
  }
}

variables {
  environment     = "dev"
  aws_account_id  = "798299234172"
  app_domain_name = "app-dev.ambrace.in"
  connect_sources = [
    "https://api-dev.ambrace.in",
    "wss://generativelanguage.googleapis.com",
  ]
}

run "names_match_what_the_deploy_role_may_manage" {
  command = plan

  assert {
    condition     = aws_s3_bucket.site.bucket == "ambrace-dev-web-798299234172"
    error_message = "The deploy role may only create ambrace-<env>-web-<account_id>."
  }

  assert {
    condition     = aws_cloudfront_function.clean_addresses.name == "ambrace-dev-web-clean-addresses"
    error_message = "The deploy role may only manage functions named ambrace-<env>-*."
  }

  assert {
    condition     = aws_ssm_parameter.site_bucket.name == "/ambrace/dev/web/hosting/site_bucket"
    error_message = "The deploy role may only write under /ambrace/<env>/web/hosting/."
  }

  assert {
    condition     = aws_ssm_parameter.distribution_id.name == "/ambrace/dev/web/hosting/distribution_id"
    error_message = "The deploy role may only write under /ambrace/<env>/web/hosting/."
  }
}

run "the_publish_workflow_is_told_which_headers_to_expect" {
  command = plan

  assert {
    condition     = aws_ssm_parameter.expected_headers.name == "/ambrace/dev/web/hosting/expected_headers"
    error_message = "The deploy role may only write under /ambrace/<env>/web/hosting/."
  }

  assert {
    condition     = jsondecode(aws_ssm_parameter.expected_headers.value) == output.expected_headers
    error_message = "The live check must use the same list the header policy is built from."
  }

  assert {
    condition     = length(aws_ssm_parameter.expected_headers.value) < 4096
    error_message = "A Standard-tier (free) parameter holds at most 4 KB."
  }
}

run "the_bucket_is_private" {
  command = plan

  assert {
    condition = alltrue([
      aws_s3_bucket_public_access_block.site.block_public_acls,
      aws_s3_bucket_public_access_block.site.block_public_policy,
      aws_s3_bucket_public_access_block.site.ignore_public_acls,
      aws_s3_bucket_public_access_block.site.restrict_public_buckets,
    ])
    error_message = "Every kind of public access to the site bucket must be blocked."
  }

  assert {
    condition     = aws_s3_bucket_ownership_controls.site.rule[0].object_ownership == "BucketOwnerEnforced"
    error_message = "Origin access control needs bucket-owner-enforced ownership."
  }

  assert {
    condition     = aws_cloudfront_origin_access_control.site.signing_behavior == "always"
    error_message = "CloudFront must sign every request to the bucket."
  }
}

run "the_distribution_serves_india_over_https_on_the_app_domain" {
  command = plan

  assert {
    condition     = aws_cloudfront_distribution.site.price_class == "PriceClass_200"
    error_message = "Class 100 has no edge locations in India."
  }

  assert {
    condition     = aws_cloudfront_distribution.site.aliases == toset(["app-dev.ambrace.in"])
    error_message = "The distribution must answer on the app domain only."
  }

  assert {
    condition     = aws_cloudfront_distribution.site.default_cache_behavior[0].viewer_protocol_policy == "redirect-to-https"
    error_message = "Plain HTTP must be redirected."
  }

  assert {
    condition     = aws_cloudfront_distribution.site.viewer_certificate[0].minimum_protocol_version == "TLSv1.2_2021"
    error_message = "Nothing older than TLS 1.2."
  }

  assert {
    condition     = toset(aws_cloudfront_distribution.site.default_cache_behavior[0].allowed_methods) == toset(["GET", "HEAD"])
    error_message = "The site is read-only: nothing but GET and HEAD reaches the bucket."
  }
}

run "a_missing_file_is_answered_with_the_apps_not_found_page" {
  command = plan

  assert {
    condition = alltrue([
      for response in aws_cloudfront_distribution.site.custom_error_response :
      response.response_code == 404 && response.response_page_path == "/404.html"
    ])
    error_message = "Both of the bucket's answers for a missing file must become the app's 404 page."
  }

  assert {
    condition     = toset([for response in aws_cloudfront_distribution.site.custom_error_response : response.error_code]) == toset([403, 404])
    error_message = "A private bucket says 403 for a missing file; 404 is covered too."
  }
}

run "the_content_security_policy_starts_as_report_only" {
  command = plan

  assert {
    condition     = contains(keys(output.expected_headers), "content-security-policy-report-only")
    error_message = "Until switched on, the policy must only report."
  }

  assert {
    condition     = !contains(keys(output.expected_headers), "content-security-policy")
    error_message = "Report-only and enforced must not both be sent."
  }

  assert {
    condition     = strcontains(output.expected_headers["content-security-policy-report-only"], "connect-src 'self' https://api-dev.ambrace.in wss://generativelanguage.googleapis.com")
    error_message = "The browser may talk to exactly the configured origins."
  }

  assert {
    condition     = strcontains(output.expected_headers["permissions-policy"], "microphone=(self)")
    error_message = "A viva needs the microphone."
  }
}

run "the_content_security_policy_can_be_enforced" {
  command = plan

  variables {
    enforce_content_security_policy = true
  }

  assert {
    condition     = contains(keys(output.expected_headers), "content-security-policy")
    error_message = "Enforcing must send the enforcing header."
  }

  assert {
    condition     = !contains(keys(output.expected_headers), "content-security-policy-report-only")
    error_message = "Report-only and enforced must not both be sent."
  }
}

run "rejects_unknown_environment" {
  command = plan

  variables {
    environment = "staging"
  }

  expect_failures = [var.environment]
}

run "rejects_a_wildcard_connection" {
  command = plan

  variables {
    connect_sources = ["https://*.amazonaws.com"]
  }

  expect_failures = [var.connect_sources]
}

run "rejects_a_wildcard_domain" {
  command = plan

  variables {
    app_domain_name = "*.ambrace.in"
  }

  expect_failures = [var.app_domain_name]
}
