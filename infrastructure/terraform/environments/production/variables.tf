variable "aws_region" {
  type        = string
  description = "AWS deployment region"
  default     = "ap-south-1"
}

variable "environment" {
  type        = string
  description = "Environment identifier"
  default     = "production"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for production VPC"
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  type        = list(string)
  description = "List of availability zones to use in the selected region (minimum 2 for multi-AZ)"
  default     = ["ap-south-1a", "ap-south-1b", "ap-south-1c"]
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for public subnets (ALB & NAT)"
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "private_app_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for private application subnets (ECS tasks)"
  default     = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
}

variable "private_db_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for private database subnets (RDS PostgreSQL & Redis)"
  default     = ["10.0.21.0/24", "10.0.22.0/24", "10.0.23.0/24"]
}

variable "db_username" {
  type        = string
  description = "Master username for RDS PostgreSQL"
  default     = "wealth_master"
}

variable "db_password" {
  type        = string
  description = "Master password for RDS PostgreSQL"
  sensitive   = true
}

variable "redis_auth_token" {
  type        = string
  description = "Authentication token for ElastiCache Redis (min 16 chars)"
  sensitive   = true
}

variable "api_image" {
  type        = string
  description = "Docker image URI for API service"
  default     = "ghcr.io/wealthcompass/wealthcompass-api:latest"
}

variable "web_image" {
  type        = string
  description = "Docker image URI for Web frontend service"
  default     = "ghcr.io/wealthcompass/wealthcompass-web:latest"
}

variable "analytics_image" {
  type        = string
  description = "Docker image URI for Quant Analytics service"
  default     = "ghcr.io/wealthcompass/wealthcompass-analytics:latest"
}

variable "certificate_arn" {
  type        = string
  description = "ACM Certificate ARN for ALB HTTPS listener"
  default     = ""
}

variable "cloudfront_certificate_arn" {
  type        = string
  description = "ACM Certificate ARN in us-east-1 for CloudFront custom domain"
  default     = ""
}

variable "domain_aliases" {
  type        = list(string)
  description = "Custom domains / CNAMEs for CloudFront"
  default     = []
}

variable "jwt_access_secret" {
  type        = string
  description = "JWT Access Token Secret"
  sensitive   = true
}

variable "jwt_refresh_secret" {
  type        = string
  description = "JWT Refresh Token Secret"
  sensitive   = true
}
