terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # In production and CI/CD, remote S3 state backend is configured:
  # backend "s3" {
  #   bucket         = "wealthcompass-terraform-state-staging"
  #   key            = "staging/terraform.tfstate"
  #   region         = "ap-south-1"
  #   dynamodb_table = "wealthcompass-terraform-locks-staging"
  #   encrypt        = true
  # }
}

provider "aws" {
  region                      = var.aws_region
  skip_credentials_validation = true
  skip_requesting_account_id  = true
  skip_metadata_api_check     = true

  default_tags {
    tags = {
      Project     = "WealthCompass"
      Environment = "staging"
      ManagedBy   = "Terraform"
    }
  }
}
