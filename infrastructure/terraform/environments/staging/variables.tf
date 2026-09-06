variable "aws_region" {
  type        = string
  description = "AWS deployment region"
  default     = "ap-south-1"
}

variable "environment" {
  type        = string
  description = "Environment identifier"
  default     = "staging"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for staging VPC"
  default     = "10.10.0.0/16"
}

variable "availability_zones" {
  type        = list(string)
  description = "List of availability zones to use in the selected region"
  default     = ["ap-south-1a", "ap-south-1b"]
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for public subnets (ALB & NAT)"
  default     = ["10.10.1.0/24", "10.10.2.0/24"]
}

variable "private_app_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for private application subnets (ECS tasks)"
  default     = ["10.10.11.0/24", "10.10.12.0/24"]
}

variable "private_db_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for private database subnets (RDS PostgreSQL & Redis)"
  default     = ["10.10.21.0/24", "10.10.22.0/24"]
}

variable "db_username" {
  type        = string
  description = "Master username for RDS PostgreSQL"
  default     = "staging_admin"
}

variable "db_password" {
  type        = string
  description = "Master password for RDS PostgreSQL"
  sensitive   = true
  default     = "StagingSecurePass2026!#Postgres"
}

variable "redis_auth_token" {
  type        = string
  description = "Authentication token for ElastiCache Redis (min 16 chars)"
  sensitive   = true
  default     = "StagingRedisAuthToken2026Secure16Chars"
}

variable "api_image" {
  type        = string
  description = "Docker image URI for API service"
  default     = "ghcr.io/wealthcompass/wealthcompass-api:staging"
}

variable "web_image" {
  type        = string
  description = "Docker image URI for Web frontend service"
  default     = "ghcr.io/wealthcompass/wealthcompass-web:staging"
}

variable "analytics_image" {
  type        = string
  description = "Docker image URI for Quant Analytics service"
  default     = "ghcr.io/wealthcompass/wealthcompass-analytics:staging"
}

variable "jwt_access_secret" {
  type        = string
  description = "JWT Access Token Secret"
  sensitive   = true
  default     = "staging_jwt_access_secret_key_at_least_32_chars_long_entropy"
}

variable "jwt_refresh_secret" {
  type        = string
  description = "JWT Refresh Token Secret"
  sensitive   = true
  default     = "staging_jwt_refresh_secret_key_at_least_32_chars_long_entropy"
}
