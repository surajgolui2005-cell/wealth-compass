import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePortfolioDto {
  @IsString()
  @IsNotEmpty({ message: 'Portfolio name is required' })
  @MaxLength(128, { message: 'Portfolio name cannot exceed 128 characters' })
  name: string;

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
