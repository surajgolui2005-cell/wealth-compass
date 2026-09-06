output "alb_id" {
  description = "The ID of the Load Balancer"
  value       = aws_lb.main.id
}

output "alb_arn" {
  description = "The ARN of the Load Balancer"
  value       = aws_lb.main.arn
}

output "alb_dns_name" {
  description = "The DNS name of the Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "The canonical hosted zone ID of the load balancer (for Route 53)"
  value       = aws_lb.main.zone_id
}

output "web_target_group_arn" {
  description = "ARN of Web Target Group"
  value       = aws_lb_target_group.web.arn
}

output "api_target_group_arn" {
  description = "ARN of API Target Group"
  value       = aws_lb_target_group.api.arn
}
