import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { AiService } from 'src/features/ai/ai.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  async getConversationsByUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return this.prisma.conversation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        outfit: {
          include: {
            garmentOutfits: {
              include: { garment: true },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });
  }

  async startConversation(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        userId,
        status: 'AWAITING_EVENT',
        messages: {
          create: {
            content:
              '¡Hola! Soy tu asistente de moda. ¿A qué evento u ocasión necesitas asistir?',
            role: 'ASSISTANT',
          },
        },
      },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    return conversation;
  }

  async sendMessage(conversationId: string, content: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversación no encontrada');
    }

    // Save the user message
    await this.prisma.message.create({
      data: {
        content,
        role: 'USER',
        conversationId,
      },
    });

    switch (conversation.status) {
      case 'AWAITING_EVENT':
        return this.handleEvent(conversationId, content);

      case 'AWAITING_WEATHER':
        return this.handleWeather(conversationId, content, conversation.event!, conversation.userId);

      case 'AWAITING_HAIRSTYLE_CHOICE':
        return this.handleHairstyleChoice(conversationId, content);

      case 'AWAITING_FACE_IMAGE':
        throw new BadRequestException(
          'Se espera una imagen de tu rostro. Usa el endpoint POST /chat/conversations/:id/face-image',
        );

      case 'COMPLETED':
        // Add a message indicating the conversation is finished
        await this.prisma.message.create({
          data: {
            content:
              'Esta conversación ya ha finalizado. Si deseas un nuevo outfit, inicia una nueva conversación.',
            role: 'ASSISTANT',
            conversationId,
          },
        });

        return this.getConversationWithRelations(conversationId);

      default:
        throw new BadRequestException('La conversación se encuentra en un estado no válido para recibir mensajes.');
    }
  }

  private async handleEvent(conversationId: string, event: string) {
    await this.prisma.message.create({
      data: {
        content: `¡Genial! Un outfit para "${event}". ¿Cómo está el clima? (por ejemplo: caluroso, frío, templado, lluvioso)`,
        role: 'ASSISTANT',
        conversationId,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { event, status: 'AWAITING_WEATHER' },
    });

    return this.getConversationWithRelations(conversationId);
  }

  private async handleWeather(
    conversationId: string,
    weather: string,
    event: string,
    userId: string,
  ) {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { weather, status: 'GENERATING' },
    });

    // Generate outfit using the existing AI service
    const result = await this.aiService.generateOutfit({ userId, event, weather });

    // Update conversation with the generated outfit
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        outfitId: result.outfit.id,
        status: 'AWAITING_HAIRSTYLE_CHOICE',
      },
    });

    await this.prisma.message.create({
      data: {
        content: `¡Aquí tienes tu outfit recomendado!\n\n**${result.outfit.name}**\n${result.outfit.description}\n\n¿Te gustaría recibir una recomendación de peinado que combine con tu outfit? (sí/no)`,
        role: 'ASSISTANT',
        conversationId,
      },
    });

    return this.getConversationWithRelations(conversationId);
  }

  private async handleHairstyleChoice(conversationId: string, content: string) {
    const positive = /^(s[ií]|si|yes|dale|claro|por supuesto|ok|va|bueno|quiero)$/i;
    const userWants = positive.test(content.trim());

    if (userWants) {
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { status: 'AWAITING_FACE_IMAGE' },
      });

      await this.prisma.message.create({
        data: {
          content: '¡Perfecto! Envía una foto de tu rostro y te recomendaré el peinado ideal para ti.',
          role: 'ASSISTANT',
          conversationId,
        },
      });
    } else {
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { status: 'COMPLETED' },
      });

      await this.prisma.message.create({
        data: {
          content: '¡Listo! Tu outfit está preparado. Si necesitas otro, inicia una nueva conversación.',
          role: 'ASSISTANT',
          conversationId,
        },
      });
    }

    return this.getConversationWithRelations(conversationId);
  }

  async handleFaceImage(conversationId: string, file: Express.Multer.File) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversación no encontrada');
    }

    if (conversation.status !== 'AWAITING_FACE_IMAGE') {
      throw new BadRequestException('La conversación no espera una imagen de rostro en este momento.');
    }

    await this.prisma.message.create({
      data: {
        content: '[Imagen de rostro enviada]',
        role: 'USER',
        conversationId,
      },
    });

    // Get available hairstyles
    const hairstyles = await this.prisma.hairstyle.findMany();

    if (hairstyles.length === 0) {
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { status: 'COMPLETED' },
      });

      await this.prisma.message.create({
        data: {
          content: 'Lo siento, aún no hay peinados disponibles en el catálogo. ¡Tu outfit está listo de todas formas!',
          role: 'ASSISTANT',
          conversationId,
        },
      });

      return this.getConversationWithRelations(conversationId);
    }

    try {
      const result = await this.aiService.recommendHairstyle(
        file.buffer,
        file.mimetype,
        hairstyles.map((h) => ({ id: h.id, description: h.description })),
      );

      const recommended = hairstyles.find((h) => h.id === result.hairstyleId);

      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { status: 'COMPLETED' },
      });

      await this.prisma.message.create({
        data: {
          content: `**Peinado recomendado:**\n\n${recommended?.description || 'Peinado seleccionado'}\n\n**Por que este peinado?**\n${result.explanation}`,
          role: 'ASSISTANT',
          conversationId,
        },
      });

      const conv = await this.getConversationWithRelations(conversationId);

      return {
        ...conv,
        recommendedHairstyle: recommended ?? null,
      };
    } catch (error) {
      // Si la IA falla, completar la conversación con un mensaje de error
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { status: 'COMPLETED' },
      });

      await this.prisma.message.create({
        data: {
          content: 'No se pudo analizar la imagen en este momento. Tu outfit sigue listo.',
          role: 'ASSISTANT',
          conversationId,
        },
      });

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException(`Error al procesar la imagen: ${error.message}`);
    }
  }

  private async getConversationWithRelations(conversationId: string) {
    return this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        outfit: {
          include: {
            garmentOutfits: {
              include: { garment: true },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });
  }
}
