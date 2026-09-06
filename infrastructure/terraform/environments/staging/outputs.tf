output "vpc_id" {
  description = "The ID of the Staging VPC"
  value       = module.vpc.vpc_id
}

output "alb_dns_name" {
  description = "Application Load Balancer DNS name"
  value       = module.alb.alb_dns_name
}

output "cloudfront_domain_name" {
  description = "CloudFront Distribution Domain Name"
  value       = module.cloudfront.domain_name
}

output "rds_endpoint" {
  description = "RDS PostgreSQL connection endpoint"
  value       = module.rds.endpoint
}

output "elasticache_primary_endpoint" {
  description = "ElastiCache Redis primary endpoint"
  value       = module.elasticache.primary_endpoint_address
}

output "s3_bucket_name" {
  description = "S3 reports and document storage bucket name"
  value       = module.s3.bucket_id
}

output "ecs_cluster_name" {
  description = "ECS Cluster Name"
  value       = module.ecs.cluster_name
}

output "ecs_services" {
  description = "ECS Fargate deployed service names"
  value = {
    api       = module.ecs.api_service_name
    web       = module.ecs.web_service_name
    analytics = module.ecs.analytics_service_name
    worker    = module.ecs.worker_service_name
  }
}
