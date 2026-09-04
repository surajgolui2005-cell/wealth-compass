import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { ResponseTransformInterceptor } from '../interceptors/transform.interceptor';

describe('ResponseTransformInterceptor', () => {
  let interceptor: ResponseTransformInterceptor<any>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ResponseTransformInterceptor],
    }).compile();
    interceptor = module.get<ResponseTransformInterceptor<any>>(
      ResponseTransformInterceptor,
    );
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should wrap plain data in success envelope', (done) => {
    const mockResponse = { __paginationMeta: undefined };
    const mockContext = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;

    const mockCallHandler: CallHandler = {
      handle: () => of({ id: '1', name: 'Test Portfolio' }),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: '1', name: 'Test Portfolio' });
      expect(result.meta).toHaveProperty('timestamp');
      expect(result.meta.pagination).toBeUndefined();
      done();
    });
  });

  it('should include pagination meta when controller sets __paginationMeta', (done) => {
    const paginationMeta = { page: 2, limit: 10, total: 55, totalPages: 6 };
    const mockResponse = { __paginationMeta: paginationMeta };
    const mockContext = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;

    const mockCallHandler: CallHandler = {
      handle: () => of([{ id: '1' }, { id: '2' }]),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
      expect(result.success).toBe(true);
      expect(result.meta.pagination).toEqual(paginationMeta);
      expect(result.meta.pagination!.totalPages).toBe(6);
      done();
    });
  });

  it('should handle null data gracefully', (done) => {
    const mockResponse = { __paginationMeta: undefined };
    const mockContext = {
      switchToHttp: () => ({ getResponse: () => mockResponse }),
    } as unknown as ExecutionContext;
    const mockCallHandler: CallHandler = { handle: () => of(null) };

    interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      done();
    });
  });
});
