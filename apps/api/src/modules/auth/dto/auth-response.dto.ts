export class UserDto {
  id: string;
  email: string;
  fullName?: string | null;
  status: string;
  createdAt: Date;
}

export class AuthResponseDto {
  accessToken: string;
  user: UserDto;
}
