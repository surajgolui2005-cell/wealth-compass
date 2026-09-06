output "cluster_id" {
  description = "The ID of the ECS Cluster"
  value       = aws_ecs_cluster.main.id
}

output "cluster_name" {
  description = "The name of the ECS Cluster"
  value       = aws_ecs_cluster.main.name
}

output "cluster_arn" {
  description = "The ARN of the ECS Cluster"
  value       = aws_ecs_cluster.main.arn
}

output "api_service_name" {
  description = "The name of the API ECS Service"
  value       = aws_ecs_service.api.name
}

output "web_service_name" {
  description = "The name of the Web ECS Service"
  value       = aws_ecs_service.web.name
}

output "analytics_service_name" {
  description = "The name of the Analytics ECS Service"
  value       = aws_ecs_service.analytics.name
}

output "worker_service_name" {
  description = "The name of the Worker ECS Service"
  value       = aws_ecs_service.worker.name
}
