variable "environment" {
  type        = string
  description = "Environment name (e.g. staging, production)"
}

variable "vpc_id" {
  type        = string
  description = "The ID of the VPC"
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "List of public subnet IDs where ALB will be deployed"
}

variable "alb_security_group_id" {
  type        = string
  description = "Security Group ID for the ALB"
}

variable "certificate_arn" {
  type        = string
  description = "ACM Certificate ARN for HTTPS listener (optional in dev/staging)"
  default     = ""
}

variable "enable_deletion_protection" {
  type        = bool
  description = "Protect ALB from accidental deletion"
  default     = false
}

variable "tags" {
  type        = map(string)
  description = "Common tags applied to all resources"
  default     = {}
}
