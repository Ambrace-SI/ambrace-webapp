locals {
  default_tags = {
    Project     = "Ambrace"
    ManagedBy   = "Terraform"
    Component   = "Web"
    Environment = var.environment
    Repository  = "ambrace-webapp"
  }
}

provider "aws" {
  region = var.aws_region

  # Hard stop if the active credentials belong to a different account than the
  # one this var-file targets (e.g. dev.tfvars applied with the prod role).
  allowed_account_ids = [var.aws_account_id]

  default_tags {
    tags = local.default_tags
  }
}

# CloudFront reads viewer certificates from us-east-1 only. This provider is
# used to look the certificate up; nothing is created there by this stack.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  allowed_account_ids = [var.aws_account_id]

  default_tags {
    tags = local.default_tags
  }
}

data "aws_caller_identity" "current" {}
