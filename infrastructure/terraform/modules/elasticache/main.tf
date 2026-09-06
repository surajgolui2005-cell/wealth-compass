# ── ElastiCache Subnet Group ──────────────────────────────────────────────────
resource "aws_elasticache_subnet_group" "main" {
  name        = "wealthcompass-${var.environment}-redis-subnet-group"
  description = "Subnet group for Wealth Compass Redis cluster"
  subnet_ids  = var.private_subnet_ids

  tags = merge(
    var.tags,
    {
      Name        = "wealthcompass-${var.environment}-redis-subnet-group"
      Environment = var.environment
    }
  )
}

# ── ElastiCache Redis Replication Group ───────────────────────────────────────
resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "wc-${var.environment}-redis"
  description          = "Redis cache & queue cluster for Wealth Compass ${var.environment}"
  node_type            = var.node_type
  num_cache_clusters   = var.num_cache_clusters
  port                 = 6379
  parameter_group_name = "default.redis7"

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [var.elasticache_security_group_id]

  automatic_failover_enabled = var.multi_az
  multi_az_enabled           = var.multi_az

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.auth_token

  auto_minor_version_upgrade = true
  maintenance_window         = "sun:05:00-sun:06:00"
  snapshot_retention_limit   = var.environment == "production" ? 7 : 0
  snapshot_window            = "04:00-05:00"

  tags = merge(
    var.tags,
    {
      Name        = "wealthcompass-${var.environment}-redis"
      Environment = var.environment
      Engine      = "Redis-7"
    }
  )
}
