import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as crypto from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { ArgonService } from '../argon.service';
import { AuthService } from '../auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let argon: any;
  let jwt: any;

  const mockUser = {
    id: 'user-uuid-1234',
    email: 'investor@example.com',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$mockHash',
    fullName: 'Test Investor',
    status: 'ACTIVE',
    createdAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      userPreferences: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    argon = {
      hash: jest.fn().mockResolvedValue('$argon2id$v=19$m=65536,t=3,p=4$mockHash'),
      verify: jest.fn().mockResolvedValue(true),
    };

    jwt = {
      signAsync: jest.fn().mockResolvedValue('mock.jwt.token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: ArgonService, useValue: argon },
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'JWT_SECRET') return 'test_jwt_secret_key_32_chars_long!!';
              if (key === 'JWT_REFRESH_SECRET') return 'test_jwt_refresh_secret_key_32_chars!';
              return null;
            },
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user and return tokens with hashed refresh token storage', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);
      prisma.userPreferences.findUnique.mockResolvedValue(null);
      prisma.userPreferences.create.mockResolvedValue({ id: 'pref-1' });

      const result = await service.register({
        email: 'investor@example.com',
        password: 'StrongPassword123!',
        fullName: 'Test Investor',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'investor@example.com' },
      });
      expect(argon.hash).toHaveBeenCalledWith('StrongPassword123!');
      expect(prisma.user.create).toHaveBeenCalled();
      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.user.email).toBe('investor@example.com');
    });

    it('should throw ConflictException if email is already registered', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'investor@example.com',
          password: 'StrongPassword123!',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should authenticate valid user credentials and issue tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      argon.verify.mockResolvedValue(true);
      prisma.userPreferences.findUnique.mockResolvedValue({ id: 'pref-1' });
      prisma.userPreferences.update.mockResolvedValue({});

      const result = await service.login({
        email: 'investor@example.com',
        password: 'StrongPassword123!',
      });

      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.user.id).toBe(mockUser.id);
    });

    it('should throw UnauthorizedException on invalid password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      argon.verify.mockResolvedValue(false);

      await expect(
        service.login({
          email: 'investor@example.com',
          password: 'WrongPassword999!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException on non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'notfound@example.com',
          password: 'StrongPassword123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    it('should rotate tokens if SHA-256 refresh token hash matches stored preference', async () => {
      const plainRefreshToken = 'valid_refresh_token_string';
      const expectedHash = crypto.createHash('sha256').update(plainRefreshToken).digest('hex');

      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        preferences: {
          notificationSettings: {
            refreshTokenHash: expectedHash,
          },
        },
      });

      prisma.userPreferences.findUnique.mockResolvedValue({
        id: 'pref-1',
        notificationSettings: { refreshTokenHash: expectedHash },
      });
      prisma.userPreferences.update.mockResolvedValue({});

      const result = await service.refreshTokens(mockUser.id, plainRefreshToken);

      expect(result.accessToken).toBe('mock.jwt.token');
      expect(prisma.userPreferences.update).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if stored refresh token hash does not match', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        preferences: {
          notificationSettings: {
            refreshTokenHash: 'different_stored_hash',
          },
        },
      });
      prisma.userPreferences.findUnique.mockResolvedValue({ id: 'pref-1' });

      await expect(
        service.refreshTokens(mockUser.id, 'tampered_refresh_token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should clear stored refresh token hash in user preferences', async () => {
      prisma.userPreferences.findUnique.mockResolvedValue({ id: 'pref-1' });
      prisma.userPreferences.update.mockResolvedValue({});

      const result = await service.logout(mockUser.id);
      expect(result.message).toContain('Successfully logged out');
      expect(prisma.userPreferences.update).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        data: expect.objectContaining({
          notificationSettings: expect.objectContaining({ refreshTokenHash: null }),
        }),
      });
    });
  });
});
