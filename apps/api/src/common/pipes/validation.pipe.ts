import { ValidationPipe } from '@nestjs/common';

/**
 * Strict global validation pipe configuration.
 * - whitelist: strips properties not in DTO
 * - transform: auto-converts primitives (string → number, string → Date)
 * - forbidNonWhitelisted: throws 400 if extra properties are present
 * - validationError.target: false — keeps error payloads concise
 */
export const buildValidationPipe = (): ValidationPipe =>
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    validationError: { target: false, value: false },
    stopAtFirstError: false,
  });
