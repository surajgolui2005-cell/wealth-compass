import { Test, TestingModule } from "@nestjs/testing";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthController } from "../auth.controller";
import { AuthService } from "../auth.service";
import { JwtAuthGuard } from "../jwt-auth.guard";
import { JwtRefreshAuthGuard } from "../jwt-refresh-auth.guard";

describe("AuthController", () => {
  let controller: AuthController;
  let service: any;

  const mockAuthResult = {
    accessToken: "mock_access_token",
    refreshToken: "mock_refresh_token",
    user: {
      id: "user-uuid-1234",
      email: "investor@example.com",
      fullName: "Test Investor",
      status: "ACTIVE",
      createdAt: new Date(),
    },
  };

  beforeEach(async () => {
    service = {
      register: jest.fn().mockResolvedValue(mockAuthResult),
      login: jest.fn().mockResolvedValue(mockAuthResult),
      refreshTokens: jest.fn().mockResolvedValue(mockAuthResult),
      logout: jest.fn().mockResolvedValue({ message: "Successfully logged out" }),
      getMe: jest.fn().mockResolvedValue(mockAuthResult.user),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          {
            name: "default",
            ttl: 60000,
            limit: 5,
          },
        ]),
      ],
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: service }],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtRefreshAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("should register user and set HTTP-only refresh cookie", async () => {
    const mockRes: any = { cookie: jest.fn() };
    const registerDto = {
      email: "investor@example.com",
      password: "StrongPassword123!",
      fullName: "Test Investor",
    };

    const result = await controller.register(registerDto, mockRes);

    expect(service.register).toHaveBeenCalledWith(registerDto);
    expect(mockRes.cookie).toHaveBeenCalledWith(
      "access_token",
      "mock_access_token",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
    expect(mockRes.cookie).toHaveBeenCalledWith(
      "refresh_token",
      "mock_refresh_token",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
    expect(result).toEqual({
      accessToken: "mock_access_token",
      user: mockAuthResult.user,
    });
  });

  it("should login user and set HTTP-only refresh cookie", async () => {
    const mockRes: any = { cookie: jest.fn() };
    const loginDto = {
      email: "investor@example.com",
      password: "StrongPassword123!",
    };

    const result = await controller.login(loginDto, mockRes);

    expect(service.login).toHaveBeenCalledWith(loginDto);
    expect(mockRes.cookie).toHaveBeenCalledWith(
      "access_token",
      "mock_access_token",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
    expect(mockRes.cookie).toHaveBeenCalledWith(
      "refresh_token",
      "mock_refresh_token",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
    expect(result).toEqual({
      accessToken: "mock_access_token",
      user: mockAuthResult.user,
    });
  });

  it("should logout user and clear HTTP-only refresh cookie", async () => {
    const mockRes: any = { clearCookie: jest.fn() };
    const mockReq: any = { user: { id: "user-uuid-1234" } };

    const result = await controller.logout(mockReq, mockRes);

    expect(mockRes.clearCookie).toHaveBeenCalledWith(
      "access_token",
      expect.objectContaining({ httpOnly: true, path: "/" }),
    );
    expect(mockRes.clearCookie).toHaveBeenCalledWith(
      "refresh_token",
      expect.objectContaining({ httpOnly: true, path: "/" }),
    );
    expect(service.logout).toHaveBeenCalledWith("user-uuid-1234");
    expect(result).toEqual({ message: "Successfully logged out" });
  });

  it("should return profile for authenticated user via getMe", async () => {
    const mockReq: any = { user: { id: "user-uuid-1234" } };
    const result = await controller.getMe(mockReq);

    expect(service.getMe).toHaveBeenCalledWith("user-uuid-1234");
    expect(result).toEqual(mockAuthResult.user);
  });
});
