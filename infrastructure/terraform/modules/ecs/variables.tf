variable "environment" {
  type        = string
  description = "Environment name (e.g. staging, production)"
}

variable "vpc_id" {
  type        = string
  description = "The ID of the VPC"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private application subnet IDs where ECS tasks will run"
}

variable "ecs_security_group_id" {
  type        = string
  description = "Security Group ID for the ECS Fargate tasks"
}

variable "api_target_group_arn" {
  type        = string
  description = "ARN of ALB target group for the API service"
}

variable "web_target_group_arn" {
  type        = string
  description = "ARN of ALB target group for the Web service"
}

variable "api_image" {
  type        = string
  description = "Docker image URI for API service"
  default     = "ghcr.io/wealthcompass/wealthcompass-api:latest"
}

variable "web_image" {
  type        = string
  description = "Docker image URI for Web service"
  default     = "ghcr.io/wealthcompass/wealthcompass-web:latest"
}

variable "analytics_image" {
  type        = string
  description = "Docker image URI for Quant Analytics service"
  default     = "ghcr.io/wealthcompass/wealthcompass-analytics:latest"
}

variable "api_min_capacity" {
  type        = number
  description = "Minimum number of API tasks"
  default     = 2
}

variable "api_max_capacity" {
  type        = number
  description = "Maximum number of API tasks for auto-scaling"
  default     = 10
}

variable "web_min_capacity" {
  type        = number
  description = "Minimum number of Web tasks"
  default     = 2
}

variable "web_max_capacity" {
  type        = number
  description = "Maximum number of Web tasks for auto-scaling"
  default     = 10
}

variable "analytics_min_capacity" {
  type        = number
  description = "Minimum number of Analytics tasks"
  default     = 2
}

variable "analytics_max_capacity" {
  type        = number
  description = "Maximum number of Analytics tasks for auto-scaling"
  default     = 8
}

variable "worker_min_capacity" {
  type        = number
  description = "Minimum number of Worker tasks"
  default     = 1
}

variable "worker_max_capacity" {
  type        = number
  description = "Maximum number of Worker tasks for auto-scaling"
  default     = 6
}

variable "database_url" {
  type        = string
  description = "PostgreSQL connection string"
  sensitive   = true
}

variable "redis_url" {
  type        = string
  description = "Redis connection string"
  sensitive   = true
}

variable "s3_bucket_name" {
  type        = string
  description = "S3 bucket name for reports and document storage"
}

variable "jwt_access_secret" {
  type        = string
  description = "JWT Access Token Secret"
  sensitive   = true
  default     = "staging_super_secret_jwt_key_at_least_32_characters"
}

variable "jwt_refresh_secret" {
  type        = string
  description = "JWT Refresh Token Secret"
  sensitive   = true
  default     = "staging_super_secret_refresh_key_at_least_32_char"
}

variable "tags" {
  type        = map(string)
  description = "Common tags applied to all resources"
  default     = {}
}
