output "alb_security_group_id" {
  description = "Security Group ID for the Application Load Balancer"
  value       = aws_security_group.alb.id
}

output "ecs_security_group_id" {
  description = "Security Group ID for the ECS Fargate application workloads"
  value       = aws_security_group.ecs.id
}

output "rds_security_group_id" {
  description = "Security Group ID strictly protecting RDS PostgreSQL"
  value       = aws_security_group.rds.id
}

output "elasticache_security_group_id" {
  description = "Security Group ID strictly protecting ElastiCache Redis"
  value       = aws_security_group.elasticache.id
}
