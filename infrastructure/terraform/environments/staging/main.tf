# ── WealthCompass Staging Infrastructure ────────────────────────────────────────

module "vpc" {
  source = "../../modules/vpc"

  environment              = var.environment
  vpc_cidr                 = var.vpc_cidr
  availability_zones       = var.availability_zones
  public_subnet_cidrs      = var.public_subnet_cidrs
  private_app_subnet_cidrs = var.private_app_subnet_cidrs
  private_db_subnet_cidrs  = var.private_db_subnet_cidrs
  single_nat_gateway       = true
  enable_flow_logs         = true

  tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
    Tier        = "Staging"
  }
}

module "security" {
  source = "../../modules/security"

  environment = var.environment
  vpc_id      = module.vpc.vpc_id

  tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

module "s3" {
  source = "../../modules/s3"

  environment        = var.environment
  bucket_prefix      = "wealthcompass"
  versioning_enabled = true

  tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

module "rds" {
  source = "../../modules/rds"

  environment             = var.environment
  private_subnet_ids      = module.vpc.private_db_subnet_ids
  rds_security_group_id   = module.security.rds_security_group_id
  instance_class          = "db.t4g.small"
  allocated_storage       = 20
  max_allocated_storage   = 100
  multi_az                = false
  db_name                 = "investor_pm"
  db_username             = var.db_username
  db_password             = var.db_password
  backup_retention_period = 7

  tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

module "elasticache" {
  source = "../../modules/elasticache"

  environment                  = var.environment
  private_subnet_ids           = module.vpc.private_db_subnet_ids
  elasticache_security_group_id = module.security.elasticache_security_group_id
  node_type                    = "cache.t4g.micro"
  num_cache_clusters           = 1
  multi_az                     = false
  auth_token                   = var.redis_auth_token

  tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

module "alb" {
  source = "../../modules/alb"

  environment           = var.environment
  vpc_id                = module.vpc.vpc_id
  public_subnet_ids     = module.vpc.public_subnet_ids
  alb_security_group_id = module.security.alb_security_group_id

  tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

module "ecs" {
  source = "../../modules/ecs"

  environment            = var.environment
  vpc_id                 = module.vpc.vpc_id
  private_subnet_ids     = module.vpc.private_app_subnet_ids
  ecs_security_group_id  = module.security.ecs_security_group_id
  api_target_group_arn   = module.alb.api_target_group_arn
  web_target_group_arn   = module.alb.web_target_group_arn

  api_image              = var.api_image
  web_image              = var.web_image
  analytics_image        = var.analytics_image

  api_min_capacity       = 1
  api_max_capacity       = 4
  web_min_capacity       = 1
  web_max_capacity       = 4
  analytics_min_capacity = 1
  analytics_max_capacity = 3
  worker_min_capacity    = 1
  worker_max_capacity    = 2

  database_url       = "postgresql://${var.db_username}:${var.db_password}@${module.rds.endpoint}/${module.rds.db_name}?sslmode=require"
  redis_url          = "rediss://:${var.redis_auth_token}@${module.elasticache.primary_endpoint_address}:${module.elasticache.port}"
  s3_bucket_name     = module.s3.bucket_id
  jwt_access_secret  = var.jwt_access_secret
  jwt_refresh_secret = var.jwt_refresh_secret

  tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

module "cloudfront" {
  source = "../../modules/cloudfront"

  environment  = var.environment
  alb_dns_name = module.alb.alb_dns_name

  tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}
