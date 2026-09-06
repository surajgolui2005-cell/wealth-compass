variable "environment" {
  type        = string
  description = "Environment name (e.g. staging, production)"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private database subnet IDs where RDS will be provisioned"
}

variable "rds_security_group_id" {
  type        = string
  description = "Security Group ID allowing access only from ECS tasks"
}

variable "instance_class" {
  type        = string
  description = "RDS instance size class"
  default     = "db.t4g.small"
}

variable "allocated_storage" {
  type        = number
  description = "Initial allocated storage in GB"
  default     = 20
}

variable "max_allocated_storage" {
  type        = number
  description = "Maximum storage limit for auto-scaling in GB"
  default     = 200
}

variable "multi_az" {
  type        = bool
  description = "Enable Multi-AZ replication (MANDATORY for production)"
  default     = false
}

variable "db_name" {
  type        = string
  description = "Initial database name"
  default     = "investor_pm"
}

variable "db_username" {
  type        = string
  description = "Master database username"
  default     = "postgres_admin"
}

variable "db_password" {
  type        = string
  description = "Master database password"
  sensitive   = true
}

variable "backup_retention_period" {
  type        = number
  description = "Number of days to retain automated backups"
  default     = 7
}

variable "tags" {
  type        = map(string)
  description = "Common tags applied to all resources"
  default     = {}
}
