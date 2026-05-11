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
    if (!user) throw new NotFoundException('Usuario no encontrado');

    return this.prisma.conversation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        outfit: {
          include: {
            garmentOutfits: { include: { garment: true }, orderBy: { order: 'asc' } },
          },
        },
      },
    });
  }

  async startConversation(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    return this.prisma.conversation.create({
      data: {
        userId,
        status: 'CHATTING',
        messages: {
          create: {
            content: '¡Hola! ✨ Soy tu estilista personal. Cuéntame, ¿para qué ocasión te estás preparando?',
            role: 'ASSISTANT',
          },
        },
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async sendMessage(conversationId: string, content: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) throw new NotFoundException('Conversación no encontrada');

    if (conversation.status === 'AWAITING_FACE_IMAGE') {
      throw new BadRequestException('Usa el botón de cámara para subir tu foto de rostro.');
    }

    if (conversation.status === 'GENERATING') {
      throw new BadRequestException('Estoy generando tu outfit, por favor espera un momento...');
    }

    // Guardar mensaje del usuario
    await this.prisma.message.create({
      data: { content, role: 'USER', conversationId },
    });

    // Cargar perfil y prendas del usuario
    const [userAttr, userWithClosets] = await Promise.all([
      this.prisma.userAttribute.findFirst({ where: { userId: conversation.userId } }),
      this.prisma.user.findUnique({
        where: { id: conversation.userId },
        include: { closets: { include: { garments: true } } },
      }),
    ]);

    const allGarments = userWithClosets?.closets.flatMap((c) => c.garments) ?? [];
    const hasOutfit   = !!conversation.outfitId;

    // Historial completo incluyendo el mensaje recién guardado
    const allMessages = [
      ...conversation.messages,
      { role: 'USER' as const, content },
    ];

    // Gemini decide qué hacer
    const ai = await this.aiService.fashionChat({
      messages:     allMessages,
      userProfile:  userAttr,
      garments:     allGarments,
      hasOutfit,
      savedEvent:   conversation.event,
      savedWeather: conversation.weather,
    });

    const effectiveWeather = conversation.weather ?? userAttr?.climate ?? null;

    // ── Guardia: si la IA quiere generar outfit y ya hay uno, verificar que
    // el usuario realmente lo pidió (no fue una inferencia errónea).
    // Si el mensaje del usuario no pide explícitamente otro outfit → chat.
    if (ai.action === 'generate_outfit' && hasOutfit) {
      const lastAssistantMsg = conversation.messages.filter(m => m.role === 'ASSISTANT').at(-1)?.content ?? '';
      const aiPromisedGeneration = /voy a (generar|armar|crear)|vamos a generar|te (voy a|armo|creo) (el|un) outfit|generar.*outfit|armar.*outfit|creo.*outfit/i.test(lastAssistantMsg);
      const userConfirmed = /^(s[ií]|si|sí|yes|dale|ok|okey|claro|perfecto|bueno|va|genial|adelante|hazlo|generalo|gen[eé]ralo|está bien|de acuerdo|listo|vamos|venga)\b/i.test(content.trim());
      const explicitRetry =
        /otro|diferente|cambiar|no me gusta|no.*gust|opci[oó]n|alternativa|algo m[aá]s|nueva propuesta|nuevo outfit|dame otro|quiero otro|mu[eé]strame otro/i.test(content) ||
        (aiPromisedGeneration && userConfirmed);
      if (!explicitRetry) {
        console.log('[chat.service] IA intentó generate_outfit pero usuario no lo pidió explícitamente → convirtiendo a chat');
        ai.action = 'chat';
      }
    }

    // ── Corrección 2: forzar generate_outfit si la IA preguntó el clima (que ya tenemos) ──
    if (ai.action === 'chat' && !hasOutfit && effectiveWeather) {
      const detectedEvent = ai.event ?? conversation.event ?? content;
      const replyAskingWeather = /clima|temperatura|tiempo (que hace|habrá)|calor|frío|lluvi/i.test(ai.reply);

      if (replyAskingWeather || conversation.event) {
        console.log('[chat.service] Corrección clima: forzando generate_outfit. evento=%s clima=%s', detectedEvent, effectiveWeather);
        ai.action  = 'generate_outfit';
        ai.event   = detectedEvent;
        ai.weather = effectiveWeather;
        ai.reply   = `¡Perfecto! Voy a armar tu outfit para ${detectedEvent} ahora mismo ✨`;
      } else if (conversation.messages.length <= 3 && !conversation.event) {
        console.log('[chat.service] Corrección early: asumiendo mensaje como evento. evento=%s clima=%s', content, effectiveWeather);
        ai.action  = 'generate_outfit';
        ai.event   = content;
        ai.weather = effectiveWeather;
        if (replyAskingWeather) {
          ai.reply = `¡Perfecto! Con eso ya tengo todo para tu outfit ✨`;
        }
      }
    }

    switch (ai.action) {
      case 'generate_outfit': {
        // Para nuevo outfit: usa el evento/clima ya guardados si la IA no envió nuevos
        const event   = ai.event   ?? conversation.event   ?? 'un evento especial';
        const weather = ai.weather ?? conversation.weather ?? userAttr?.climate ?? 'templado';

        // Guardar la respuesta conversacional primero
        await this.prisma.message.create({
          data: { content: ai.reply, role: 'ASSISTANT', conversationId },
        });

        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { event, weather, status: 'GENERATING' },
        });

        try {
          const result = await this.aiService.generateOutfit({
            userId: conversation.userId,
            event,
            weather,
          });

          await this.prisma.conversation.update({
            where: { id: conversationId },
            data: { outfitId: result.outfit.id, status: 'CHATTING' },
          });

          await this.prisma.message.create({
            data: {
              content:
                `✨ **${result.outfit.name}**\n${result.outfit.description ?? ''}\n\n` +
                `¿Qué te parece? Si quieres también puedo recomendarte un peinado que combine perfectamente 💇`,
              role: 'ASSISTANT',
              conversationId,
            },
          });
        } catch (err) {
          // ── Retry automático una vez antes de mostrar error ──────────────
          console.warn('[chat.service] generateOutfit falló, reintentando...', (err as Error).message.slice(0, 80));
          try {
            const result2 = await this.aiService.generateOutfit({ userId: conversation.userId, event, weather });
            await this.prisma.conversation.update({
              where: { id: conversationId },
              data: { outfitId: result2.outfit.id, status: 'CHATTING' },
            });
            await this.prisma.message.create({
              data: {
                content:
                  `✨ **${result2.outfit.name}**\n${result2.outfit.description ?? ''}\n\n` +
                  `¿Qué te parece? Si quieres también puedo recomendarte un peinado 💇`,
                role: 'ASSISTANT',
                conversationId,
              },
            });
          } catch {
            await this.prisma.conversation.update({
              where: { id: conversationId },
              data: { status: 'CHATTING' },
            });
            await this.prisma.message.create({
              data: {
                content: 'Lo siento, los servicios de IA están muy ocupados ahora mismo 😅 Escríbeme en un momento e intento de nuevo.',
                role: 'ASSISTANT',
                conversationId,
              },
            });
          }
        }
        break;
      }

      case 'request_face_photo': {
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { status: 'AWAITING_FACE_IMAGE' },
        });
        await this.prisma.message.create({
          data: { content: ai.reply, role: 'ASSISTANT', conversationId },
        });
        break;
      }

      default: {
        await this.prisma.message.create({
          data: { content: ai.reply, role: 'ASSISTANT', conversationId },
        });
        break;
      }
    }

    return this.getConversationWithRelations(conversationId);
  }

  async handleFaceImage(conversationId: string, file: Express.Multer.File) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException('Conversación no encontrada');

    if (conversation.status !== 'AWAITING_FACE_IMAGE') {
      throw new BadRequestException('La conversación no espera una imagen de rostro en este momento.');
    }

    await this.prisma.message.create({
      data: { content: '[Imagen de rostro enviada]', role: 'USER', conversationId },
    });

    const hairstyles = await this.prisma.hairstyle.findMany();

    if (hairstyles.length === 0) {
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { status: 'CHATTING' },
      });
      await this.prisma.message.create({
        data: {
          content: 'Aún no hay peinados en el catálogo, pero tu outfit está listo. ¿Puedo ayudarte con algo más?',
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
        data: { status: 'CHATTING' },
      });

      await this.prisma.message.create({
        data: {
          content:
            `**Peinado recomendado:**\n\n${recommended?.description ?? 'Peinado seleccionado'}\n\n` +
            `**¿Por qué este peinado?**\n${result.explanation}\n\n` +
            `¿Hay algo más en lo que te pueda ayudar? 😊`,
          role: 'ASSISTANT',
          conversationId,
        },
      });

      const conv = await this.getConversationWithRelations(conversationId);
      return { ...conv, recommendedHairstyle: recommended ?? null };
    } catch {
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { status: 'CHATTING' },
      });
      await this.prisma.message.create({
        data: {
          content: 'No pude analizar la imagen ahora mismo 😕 Pero tu outfit sigue listo. ¿Puedo ayudarte con algo más?',
          role: 'ASSISTANT',
          conversationId,
        },
      });
      return this.getConversationWithRelations(conversationId);
    }
  }

  private async getConversationWithRelations(conversationId: string) {
    return this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        outfit: {
          include: {
            garmentOutfits: { include: { garment: true }, orderBy: { order: 'asc' } },
          },
        },
      },
    });
  }
}
