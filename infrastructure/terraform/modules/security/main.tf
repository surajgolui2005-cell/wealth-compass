# ── 1. Application Load Balancer Security Group ──────────────────────────────
resource "aws_security_group" "alb" {
  name        = "wealthcompass-${var.environment}-alb-sg"
  description = "Controls inbound traffic to public ALB"
  vpc_id      = var.vpc_id

  ingress {
    description = "Allow inbound HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow inbound HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow outbound traffic to ECS tasks"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name        = "wealthcompass-${var.environment}-alb-sg"
      Environment = var.environment
    }
  )
}

# ── 2. ECS Application Workloads Security Group ──────────────────────────────
resource "aws_security_group" "ecs" {
  name        = "wealthcompass-${var.environment}-ecs-sg"
  description = "Controls traffic for ECS Fargate tasks (api, web, analytics, worker)"
  vpc_id      = var.vpc_id

  # Inbound traffic from ALB on container port 3000 (API & Web)
  ingress {
    description     = "Allow inbound HTTP from ALB to container port 3000"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Inbound internal microservice traffic: API -> Quant Engine (port 8001)
  ingress {
    description = "Allow inter-service communication from ECS tasks to Quant Engine port 8001"
    from_port   = 8001
    to_port     = 8001
    protocol    = "tcp"
    self        = true
  }

  # Inbound internal traffic: ECS tasks calling each other on port 3000
  ingress {
    description = "Allow inter-service communication within ECS cluster on port 3000"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    self        = true
  }

  # Outbound egress to internet (via NAT Gateway for market data feeds, broker APIs, and notifications)
  egress {
    description = "Allow all outbound traffic via NAT gateway"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name        = "wealthcompass-${var.environment}-ecs-sg"
      Environment = var.environment
    }
  )
}

# ── 3. RDS PostgreSQL Security Group (STRICTLY LIMITED TO ECS) ───────────────
resource "aws_security_group" "rds" {
  name        = "wealthcompass-${var.environment}-rds-sg"
  description = "Strictly limits PostgreSQL database access exclusively to ECS application security group"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Allow PostgreSQL access strictly and exclusively from ECS application tasks"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  tags = merge(
    var.tags,
    {
      Name        = "wealthcompass-${var.environment}-rds-sg"
      Environment = var.environment
      Security    = "ZeroInternetExposure"
    }
  )
}

# ── 4. ElastiCache Redis Security Group (STRICTLY LIMITED TO ECS) ────────────
resource "aws_security_group" "elasticache" {
  name        = "wealthcompass-${var.environment}-elasticache-sg"
  description = "Strictly limits Redis cache cluster access exclusively to ECS application security group"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Allow Redis access strictly and exclusively from ECS application tasks"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  tags = merge(
    var.tags,
    {
      Name        = "wealthcompass-${var.environment}-elasticache-sg"
      Environment = var.environment
      Security    = "ZeroInternetExposure"
    }
  )
}
