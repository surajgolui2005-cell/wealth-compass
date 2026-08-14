import { Test, TestingModule } from '@nestjs/testing';
import { ArgonService } from '../argon.service';

describe('ArgonService', () => {
  let service: ArgonService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ArgonService],
    }).compile();

    service = module.get<ArgonService>(ArgonService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should hash password using Argon2id format', async () => {
    const password = 'StrongPassword123!';
    const hash = await service.hash(password);

    expect(hash).toBeDefined();
    expect(hash).toContain('$argon2id$');
  });

  it('should verify correct password against hash', async () => {
    const password = 'StrongPassword123!';
    const hash = await service.hash(password);

    const isValid = await service.verify(hash, password);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const password = 'StrongPassword123!';
    const wrongPassword = 'WrongPassword999!';
    const hash = await service.hash(password);

    const isValid = await service.verify(hash, wrongPassword);
    expect(isValid).toBe(false);
  });
});
