variable "environment" {
  type        = string
  description = "Environment name (e.g. staging, production)"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private database subnet IDs where Redis will be provisioned"
}

variable "elasticache_security_group_id" {
  type        = string
  description = "Security Group ID allowing access only from ECS tasks"
}

variable "node_type" {
  type        = string
  description = "ElastiCache node instance type"
  default     = "cache.t4g.micro"
}

variable "num_cache_clusters" {
  type        = number
  description = "Number of cache clusters (nodes) in the replication group"
  default     = 1
}

variable "multi_az" {
  type        = bool
  description = "Enable Multi-AZ automatic failover (recommended for production)"
  default     = false
}

variable "auth_token" {
  type        = string
  description = "Redis AUTH password token (min 16 chars)"
  sensitive   = true
}

variable "tags" {
  type        = map(string)
  description = "Common tags applied to all resources"
  default     = {}
}
