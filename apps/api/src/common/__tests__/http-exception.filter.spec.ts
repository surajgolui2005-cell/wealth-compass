import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpExceptionFilter } from '../filters/http-exception.filter';

function buildMockHost(url = '/api/v1/test') {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const mockResponse = { status };
  const mockRequest = { url };

  const host = {
    switchToHttp: () => ({
      getResponse: () => mockResponse,
      getRequest: () => mockRequest,
    }),
  } as any;

  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  it('should return structured 400 error for BadRequestException', () => {
    const { host, status, json } = buildMockHost();
    filter.catch(new BadRequestException('Name is required'), host);

    expect(status).toHaveBeenCalledWith(400);
    const body = json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('BAD_REQUEST');
    expect(body.error.message).toBe('Name is required');
    expect(body.timestamp).toBeDefined();
    expect(body.path).toBe('/api/v1/test');
  });

  it('should return structured 404 error for NotFoundException', () => {
    const { host, status, json } = buildMockHost('/api/v1/portfolios/missing');
    filter.catch(new NotFoundException('Portfolio not found'), host);

    expect(status).toHaveBeenCalledWith(404);
    const body = json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('Portfolio not found');
    expect(body.path).toBe('/api/v1/portfolios/missing');
  });

  it('should return structured 401 error for UnauthorizedException', () => {
    const { host, status, json } = buildMockHost();
    filter.catch(new UnauthorizedException('Invalid token'), host);

    expect(status).toHaveBeenCalledWith(401);
    const body = json.mock.calls[0][0];
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('should return structured 403 error for ForbiddenException', () => {
    const { host, status, json } = buildMockHost();
    filter.catch(new ForbiddenException(), host);

    expect(status).toHaveBeenCalledWith(403);
    const body = json.mock.calls[0][0];
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('should flatten class-validator array messages into details', () => {
    const { host, status, json } = buildMockHost();
    const exception = new BadRequestException({
      message: ['name must be a string', 'currency must be length 3'],
      error: 'Bad Request',
      statusCode: 400,
    });
    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(400);
    const body = json.mock.calls[0][0];
    expect(body.error.message).toBe('Validation failed');
    expect(body.error.details).toEqual([
      'name must be a string',
      'currency must be length 3',
    ]);
  });

  it('should return 500 for unhandled non-HTTP errors', () => {
    const { host, status, json } = buildMockHost();
    filter.catch(new Error('Unexpected database failure'), host);

    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('should return 500 with generic message for unknown exceptions', () => {
    const { host, status, json } = buildMockHost();
    filter.catch('something weird', host);

    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.error.message).toBe('An unexpected error occurred');
  });

  it('should return custom HTTP status and code for custom HttpException', () => {
    const { host, status, json } = buildMockHost();
    filter.catch(new HttpException('Rate limit hit', HttpStatus.TOO_MANY_REQUESTS), host);

    expect(status).toHaveBeenCalledWith(429);
    const body = json.mock.calls[0][0];
    expect(body.error.code).toBe('TOO_MANY_REQUESTS');
  });
});
