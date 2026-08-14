import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePortfolioDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;
}
