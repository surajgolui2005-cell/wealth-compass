import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ArgonService } from './argon.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly argonService: ArgonService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Computes SHA-256 hash of a plain refresh token string
   */
  private hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Issues short-lived access token and long-lived refresh token
   */
  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const accessSecret =
      this.configService.get<string>('JWT_SECRET') ||
      'dev_jwt_secret_key_must_be_at_least_32_characters_long_for_security';
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      'dev_jwt_refresh_secret_key_must_be_at_least_32_characters_long';

    const accessExpiresIn =
      this.configService.get<string>('JWT_EXPIRES_IN') || '1d';
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: accessExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Saves SHA-256 hashed refresh token into UserPreferences notificationSettings metadata
   */
  private async updateRefreshTokenHash(userId: string, refreshToken: string | null) {
    const hashedToken = refreshToken ? this.hashRefreshToken(refreshToken) : null;

    const existingPref = await this.prisma.userPreferences.findUnique({
      where: { userId },
    });

    const currentSettings =
      typeof existingPref?.notificationSettings === 'object' &&
      existingPref?.notificationSettings !== null
        ? (existingPref.notificationSettings as Record<string, any>)
        : {};

    const updatedSettings = {
      ...currentSettings,
      refreshTokenHash: hashedToken,
    };

    if (existingPref) {
      await this.prisma.userPreferences.update({
        where: { userId },
        data: { notificationSettings: updatedSettings },
      });
    } else {
      await this.prisma.userPreferences.create({
        data: {
          userId,
          homeCurrency: 'INR',
          riskTolerance: 'MODERATE',
          timezone: 'Asia/Kolkata',
          notificationSettings: updatedSettings,
        },
      });
    }
  }

  async register(registerDto: RegisterDto): Promise<AuthResponseDto & { refreshToken: string }> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email.toLowerCase().trim() },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await this.argonService.hash(registerDto.password);

    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email.toLowerCase().trim(),
        passwordHash,
        fullName: registerDto.fullName?.trim() || null,
        status: 'ACTIVE',
        preferences: {
          create: {
            homeCurrency: 'INR',
            riskTolerance: 'MODERATE',
            timezone: 'Asia/Kolkata',
            notificationSettings: {},
          },
        },
      },
    });

    const { accessToken, refreshToken } = await this.generateTokens(user.id, user.email);
    await this.updateRefreshTokenHash(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        status: user.status,
        createdAt: user.createdAt,
      },
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto & { refreshToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email.toLowerCase().trim() },
    });

    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await this.argonService.verify(user.passwordHash, loginDto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { accessToken, refreshToken } = await this.generateTokens(user.id, user.email);
    await this.updateRefreshTokenHash(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        status: user.status,
        createdAt: user.createdAt,
      },
    };
  }

  async refreshTokens(userId: string, refreshToken: string): Promise<AuthResponseDto & { refreshToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { preferences: true },
    });

    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    const settings = user.preferences?.notificationSettings as Record<string, any> | null;
    const storedHash = settings?.refreshTokenHash;

    if (!storedHash) {
      throw new UnauthorizedException('Access Denied - Refresh token revoked');
    }

    const incomingHash = this.hashRefreshToken(refreshToken);
    if (storedHash !== incomingHash) {
      // Invalidate stored refresh token on hash mismatch (token reuse detection)
      await this.updateRefreshTokenHash(user.id, null);
      throw new UnauthorizedException('Access Denied - Invalid refresh token signature');
    }

    const { accessToken, refreshToken: newRefreshToken } = await this.generateTokens(user.id, user.email);
    await this.updateRefreshTokenHash(user.id, newRefreshToken);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        status: user.status,
        createdAt: user.createdAt,
      },
    };
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.updateRefreshTokenHash(userId, null);
    return { message: 'Successfully logged out' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
        createdAt: true,
        preferences: {
          select: {
            homeCurrency: true,
            riskTolerance: true,
            timezone: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
