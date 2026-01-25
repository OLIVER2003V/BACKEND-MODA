import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { NotificationsService } from 'src/common/notifications/notifications.service';
import { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(createPostDto: CreatePostDto) {
    const outfit = await this.prisma.outfit.findUnique({
      where: { id: createPostDto.outfitId },
    });

    if (!outfit) {
      throw new NotFoundException('Outfit not found');
    }

    return this.prisma.post.create({
      data: {
        outfitId: createPostDto.outfitId,
      },
      include: {
        outfit: {
          include: {
            garmentOutfits: {
              include: {
                garment: true,
              },
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
      },
    });
  }

  async findAll() {
    return this.prisma.post.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        outfit: {
          include: {
            garmentOutfits: {
              include: {
                garment: true,
              },
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        outfit: {
          include: {
            garmentOutfits: {
              include: {
                garment: true,
              },
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  async react(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        outfit: {
          include: {
            garmentOutfits: {
              include: {
                garment: {
                  include: {
                    closet: {
                      include: {
                        user: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const existingInteraction = await this.prisma.postInteraction.findFirst({
      where: {
        postId,
        userId,
      },
    });

    if (existingInteraction) {
      return existingInteraction;
    }

    const reactingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const [interaction] = await this.prisma.$transaction([
      this.prisma.postInteraction.create({
        data: {
          postId,
          userId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.post.update({
        where: { id: postId },
        data: {
          reactionCount: {
            increment: 1,
          },
        },
      }),
    ]);

    // Send notification to the post owner
    const postOwner = post.outfit.garmentOutfits[0]?.garment?.closet?.user;
    if (postOwner && postOwner.fcmToken && postOwner.id !== userId) {
      try {
        await this.notificationsService.sendNotification({
          token: postOwner.fcmToken,
          title: 'Nueva reaccion',
          body: `${reactingUser?.name || 'Alguien'} le ha gustado tu outfit`,
          data: {
            postId,
            type: 'reaction',
          },
        });
      } catch (error) {
        this.logger.warn(`Failed to send notification: ${error.message}`);
      }
    }

    return interaction;
  }

  async unreact(postId: string, userId: string) {
    const interaction = await this.prisma.postInteraction.findFirst({
      where: {
        postId,
        userId,
      },
    });

    if (!interaction) {
      throw new NotFoundException('You have not reacted to this post');
    }

    await this.prisma.$transaction([
      this.prisma.postInteraction.delete({
        where: { id: interaction.id },
      }),
      this.prisma.post.update({
        where: { id: postId },
        data: {
          reactionCount: {
            decrement: 1,
          },
        },
      }),
    ]);

    return { message: 'Reaction removed successfully' };
  }

  async getReactions(postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return this.prisma.postInteraction.findMany({
      where: { postId },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    await this.prisma.$transaction([
      this.prisma.postInteraction.deleteMany({
        where: { postId: id },
      }),
      this.prisma.post.delete({
        where: { id },
      }),
    ]);

    return { message: 'Post deleted successfully' };
  }
}
