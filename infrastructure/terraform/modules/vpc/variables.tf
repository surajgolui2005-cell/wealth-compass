variable "environment" {
  type        = string
  description = "Environment name (e.g. staging, production)"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC"
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  type        = list(string)
  description = "List of availability zones to use"
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for public subnets (ALB & NAT)"
}

variable "private_app_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for private application subnets (ECS tasks)"
}

variable "private_db_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for private database subnets (RDS & Redis)"
}

variable "single_nat_gateway" {
  type        = bool
  description = "Deploy a single NAT Gateway for cost-savings (recommended for staging), or one per AZ (for production)"
  default     = false
}

variable "enable_flow_logs" {
  type        = bool
  description = "Enable VPC flow logs to CloudWatch"
  default     = true
}

variable "tags" {
  type        = map(string)
  description = "Common tags applied to all resources"
  default     = {}
}
