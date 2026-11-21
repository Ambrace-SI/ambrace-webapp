terraform {
  required_version = ">= 1.11.4, < 2.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.81"
    }
  }

  # Partial configuration: the bucket differs per AWS account, so it is supplied
  # at init time with `-backend-config=<env>.backend.hcl`. The bucket, and this
  # stack's right to use the web/ prefix in it, come from the bootstrap stack in
  # ambrace-backend/infra/bootstrap.
  backend "s3" {}
}
