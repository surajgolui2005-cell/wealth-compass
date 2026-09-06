variable "environment" {
  type        = string
  description = "Environment name (e.g. staging, production)"
}

variable "bucket_prefix" {
  type        = string
  description = "Prefix for the S3 bucket name (max 20 chars)"
  default     = "wealthcompass"
}

variable "versioning_enabled" {
  type        = bool
  description = "Enable object versioning"
  default     = true
}

variable "tags" {
  type        = map(string)
  description = "Common tags applied to all resources"
  default     = {}
}
