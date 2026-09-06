output "bucket_id" {
  description = "The name of the bucket"
  value       = aws_s3_bucket.reports.id
}

output "bucket_arn" {
  description = "The ARN of the bucket"
  value       = aws_s3_bucket.reports.arn
}

output "bucket_domain_name" {
  description = "The bucket domain name"
  value       = aws_s3_bucket.reports.bucket_regional_domain_name
}
