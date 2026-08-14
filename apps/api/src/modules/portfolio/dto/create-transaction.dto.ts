import { AssetClassCode, TransactionType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateTransactionDto {
  @IsUUID()
  @IsNotEmpty({ message: 'Portfolio ID is required' })
  portfolioId: string;

  @IsOptional()
  @IsUUID()
  holdingId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Asset symbol is required' })
  symbol: string;

  @IsOptional()
  @IsEnum(AssetClassCode)
  assetClassCode?: AssetClassCode;

  @IsEnum(TransactionType, { message: 'Invalid transaction type' })
  @IsNotEmpty({ message: 'Transaction type is required' })
  type: TransactionType;

  @IsNumber()
  @Min(0, { message: 'Quantity cannot be negative' })
  @Type(() => Number)
  quantity: number;

  @IsNumber()
  @Min(0, { message: 'Price per unit cannot be negative' })
  @Type(() => Number)
  pricePerUnit: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  fees?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive({ message: 'Split ratio must be positive' })
  @Type(() => Number)
  splitRatio?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  fxRateToHome?: number;

  @IsDate({ message: 'TransactedAt must be a valid ISO Date' })
  @Type(() => Date)
  transactedAt: Date;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  providerAccountId?: string;
}
