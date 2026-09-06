# ── DB Subnet Group (Private Database Subnets) ────────────────────────────────
resource "aws_db_subnet_group" "main" {
  name        = "wealthcompass-${var.environment}-db-subnet-group"
  description = "Subnet group for Wealth Compass RDS PostgreSQL instances"
  subnet_ids  = var.private_subnet_ids

  tags = merge(
    var.tags,
    {
      Name        = "wealthcompass-${var.environment}-db-subnet-group"
      Environment = var.environment
    }
  )
}

# ── Parameter Group with Enforced TLS/SSL ────────────────────────────────────
resource "aws_db_parameter_group" "postgres16" {
  name        = "wealthcompass-${var.environment}-pg16-params"
  family      = "postgres16"
  description = "PostgreSQL 16 parameter group with SSL enforcement"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  tags = var.tags
}

# ── RDS PostgreSQL Instance ──────────────────────────────────────────────────
resource "aws_db_instance" "main" {
  identifier     = "wealthcompass-${var.environment}-postgres"
  engine         = "postgres"
  engine_version = "16.3"
  instance_class = var.instance_class

  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  multi_az               = var.multi_az
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.rds_security_group_id]
  parameter_group_name   = aws_db_parameter_group.postgres16.name

  publicly_accessible = false

  backup_retention_period = var.backup_retention_period
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  auto_minor_version_upgrade = true
  allow_major_version_upgrade = false
  copy_tags_to_snapshot      = true

  deletion_protection = var.environment == "production"
  skip_final_snapshot = var.environment != "production"
  final_snapshot_identifier = "wealthcompass-${var.environment}-postgres-final-snapshot"

  tags = merge(
    var.tags,
    {
      Name        = "wealthcompass-${var.environment}-postgres"
      Environment = var.environment
      Engine      = "PostgreSQL-16"
    }
  )
}
