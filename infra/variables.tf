variable "environment" {
  type        = string
  description = "Short environment name. One AWS account per environment."

  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "environment must be \"dev\" or \"prod\"."
  }
}

variable "aws_account_id" {
  type        = string
  description = "The AWS account this environment lives in. The provider refuses to run against any other account."

  validation {
    condition     = can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "aws_account_id must be a 12-digit AWS account ID."
  }
}

variable "aws_region" {
  type        = string
  description = "Region of the site bucket and the SSM parameters."
  default     = "ap-south-1"
}

variable "app_domain_name" {
  type        = string
  description = "Public hostname of the web app (e.g. app-dev.ambrace.in). Its certificate is requested by the bootstrap stack and must be ISSUED before this stack can plan."

  validation {
    condition     = can(regex("^[a-z0-9-]+(\\.[a-z0-9-]+)+$", var.app_domain_name))
    error_message = "app_domain_name must be one exact hostname, with no scheme, path or wildcard."
  }
}

variable "connect_sources" {
  type        = list(string)
  description = "Every origin the browser may talk to besides the app itself: the API, Cognito, the Gemini Live socket. Becomes the connect-src of the content security policy."

  validation {
    condition = alltrue([
      for source in var.connect_sources : can(regex("^(https|wss)://[a-z0-9.-]+$", source))
    ])
    error_message = "Each source must be an exact https:// or wss:// origin, with no path or wildcard."
  }
}

variable "enforce_content_security_policy" {
  type        = bool
  description = "false: the policy is sent as report-only, so a mistake in it shows up in the browser console instead of breaking the app. true: the browser enforces it. Turn on once the app has been exercised with a clean console."
  default     = false
}
