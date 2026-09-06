# ── Application Load Balancer ────────────────────────────────────────────────
resource "aws_lb" "main" {
  name               = "wealthcompass-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = var.enable_deletion_protection
  drop_invalid_header_fields = true

  tags = merge(
    var.tags,
    {
      Name        = "wealthcompass-${var.environment}-alb"
      Environment = var.environment
    }
  )
}

# ── Target Groups (target_type = "ip" for Fargate) ───────────────────────────
# 1. Web Frontend Target Group
resource "aws_lb_target_group" "web" {
  name        = "wc-${var.environment}-web-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/"
    protocol            = "HTTP"
    matcher             = "200-399"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 3
    unhealthy_threshold = 3
  }

  deregistration_delay = 30

  tags = merge(
    var.tags,
    {
      Name        = "wealthcompass-${var.environment}-web-tg"
      Environment = var.environment
      Service     = "Web"
    }
  )
}

# 2. Backend API Target Group
resource "aws_lb_target_group" "api" {
  name        = "wc-${var.environment}-api-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/health"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 4
  }

  deregistration_delay = 30

  tags = merge(
    var.tags,
    {
      Name        = "wealthcompass-${var.environment}-api-tg"
      Environment = var.environment
      Service     = "API"
    }
  )
}

# ── HTTP Listener (Port 80) ──────────────────────────────────────────────────
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  # If certificate ARN is provided, redirect HTTP to HTTPS; otherwise forward to web
  dynamic "default_action" {
    for_each = var.certificate_arn != "" ? [1] : []
    content {
      type = "redirect"

      redirect {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }

  dynamic "default_action" {
    for_each = var.certificate_arn == "" ? [1] : []
    content {
      type             = "forward"
      target_group_arn = aws_lb_target_group.web.arn
    }
  }
}

# Path rule on HTTP if no SSL (e.g. dev/local test environments)
resource "aws_lb_listener_rule" "http_api" {
  count        = var.certificate_arn == "" ? 1 : 0
  listener_arn = aws_lb_listener.http.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/api/*", "/health*"]
    }
  }
}

# ── HTTPS Listener (Port 443) ─────────────────────────────────────────────────
resource "aws_lb_listener" "https" {
  count             = var.certificate_arn != "" ? 1 : 0
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}

resource "aws_lb_listener_rule" "https_api" {
  count        = var.certificate_arn != "" ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/api/*", "/health*"]
    }
  }
}
