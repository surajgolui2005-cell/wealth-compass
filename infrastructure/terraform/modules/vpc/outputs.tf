output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "The CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_app_subnet_ids" {
  description = "List of private application subnet IDs (for ECS)"
  value       = aws_subnet.private_app[*].id
}

output "private_db_subnet_ids" {
  description = "List of private database subnet IDs (for RDS and Redis)"
  value       = aws_subnet.private_db[*].id
}

output "nat_gateway_ips" {
  description = "List of Public Elastic IPs allocated to NAT Gateways"
  value       = aws_eip.nat[*].public_ip
}
