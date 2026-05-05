import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MembershipRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { ensureWorkspaceDefaultCrmSetup } from '../crm/default-workspace-setup';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new BadRequestException('Email already in use.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: dto.workspaceName
        }
      });

      const user = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email.toLowerCase().trim(),
          passwordHash
        }
      });

      await tx.membership.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: MembershipRole.OWNER
        }
      });

      await ensureWorkspaceDefaultCrmSetup(tx, workspace.id);

      return user;
    });

    return this.buildAuthResponse(result.id);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    return this.buildAuthResponse(user.id);
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      memberships: user.memberships.map((membership) => ({
        id: membership.id,
        role: membership.role,
        workspace: {
          id: membership.workspace.id,
          name: membership.workspace.name
        }
      }))
    };
  }

  private async buildAuthResponse(userId: string) {
    const profile = await this.getProfile(userId);
    const accessToken = await this.jwtService.signAsync({
      sub: profile.id,
      email: profile.email
    });

    return {
      accessToken,
      user: {
        id: profile.id,
        name: profile.name,
        email: profile.email
      }
    };
  }
}
