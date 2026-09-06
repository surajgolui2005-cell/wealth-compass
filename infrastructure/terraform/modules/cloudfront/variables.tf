variable "environment" {
  type        = string
  description = "Environment name (e.g. staging, production)"
}

variable "alb_dns_name" {
  type        = string
  description = "DNS name of the Application Load Balancer"
}

variable "domain_aliases" {
  type        = list(string)
  description = "Custom domain CNAMEs for the CloudFront distribution"
  default     = []
}

variable "acm_certificate_arn" {
  type        = string
  description = "ACM Certificate ARN in us-east-1 for custom domain SSL"
  default     = ""
}

variable "tags" {
  type        = map(string)
  description = "Common tags applied to all resources"
  default     = {}
}
