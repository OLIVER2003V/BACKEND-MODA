import { Injectable, BadRequestException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { AskQuestionDto, GenerateOutfitDto } from './dto';
import { envs } from 'src/config/envs';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class AiService {
  private readonly gemini: GoogleGenerativeAI;
  private readonly openrouter: OpenAI;
  private readonly groq: OpenAI;

  constructor(private readonly prisma: PrismaService) {
    this.gemini = new GoogleGenerativeAI(envs.geminiApiKey);
    this.openrouter = new OpenAI({
      apiKey: envs.openrouterApiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: { 'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'StyleApp' },
    });
    this.groq = new OpenAI({
      apiKey: envs.groqApiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
  async askQuestion(_askQuestionDto: AskQuestionDto): Promise<void> {}

  async describeGarment(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<{ name: string; description: string; category: string }> {
    try {
      const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      let cleanMimeType = mimeType?.split(';')[0]?.trim()?.toLowerCase();
      if (!cleanMimeType || !validMimeTypes.includes(cleanMimeType)) {
        cleanMimeType = 'image/jpeg';
      }

      const systemPrompt = `You are a fashion expert AI analyzing garment images for an AI image generation pipeline. Your descriptions will be fed directly into a text-to-image model (FLUX) to visually recreate the garment on a person. Accuracy of visual details is critical.

AVAILABLE CATEGORIES:
- TOP: Main upper body garments (t-shirt, shirt, blouse, polo, tank top)
- OUTERWEAR: Outer layers (jacket, coat, sweater, cardigan, vest, hoodie, blazer)
- BOTTOM: Lower body garments (pants, shorts, skirt, jeans, jogger, leggings)
- DRESS: Full body garments (dress, jumpsuit, overalls, romper)
- FOOTWEAR: Footwear (shoes, sneakers, boots, sandals, loafers, heels)
- ACCESSORY: Accessories (cap, hat, bag, belt, scarf, tie, watch, jewelry, sunglasses)

INSTRUCTIONS:
1. Determine the correct CATEGORY (must be exactly one of the 6 options above).
2. Write a short descriptive NAME in SPANISH (max 5 words, e.g. "Camisa azul slim fit").
3. Write a DETAILED VISUAL DESCRIPTION IN ENGLISH (100-150 words) optimized for image generation. Include ALL of:
   - Exact color(s) with precise shade names (e.g. "lime green", "navy blue", "warm caramel brown" — never just "green" or "brown")
   - Material and texture (e.g. "soft cotton jersey", "suede leather", "raw denim", "nylon ripstop")
   - Silhouette and fit (e.g. "slim fit", "relaxed baggy", "cropped", "high-waisted", "oversized")
   - All visible design details: number of stripes and their exact colors, logo shape/color/position, graphic print, pattern name (plaid, floral, camouflage, etc.)
   - Construction details: collar type (crew neck, v-neck, polo), sleeve length, waistband (elastic/drawstring/belted), closure (zipper/buttons/lace-up/slip-on)
   - Distinctive visual elements: stitching color, pocket placement, brand emblem description, hardware color (gold/silver)

Respond ONLY with JSON: { "category": "CATEGORY", "name": "short name in Spanish", "description": "detailed visual description in English" }
Category MUST be exactly one of: TOP, OUTERWEAR, BOTTOM, DRESS, FOOTWEAR, ACCESSORY`;

      const base64Image = imageBuffer.toString('base64');

      let responseText: string | null = null;

      // 1. Gemini (mejor calidad, cuota diaria, sin restricción para ropa)
      try {
        const geminiModel = this.gemini.getGenerativeModel({
          model: 'gemini-2.5-flash',
          generationConfig: { temperature: 0.2, maxOutputTokens: 700, responseMimeType: 'application/json' },
        });
        const result = await geminiModel.generateContent([
          systemPrompt,
          { inlineData: { data: base64Image, mimeType: cleanMimeType } },
          'Analiza esta prenda de vestir:',
        ]);
        responseText = result.response.text() || null;
        if (responseText) console.log('[Gemini] describeGarment: éxito');
      } catch (geminiErr) {
        console.warn('[Gemini] describeGarment falló:', (geminiErr as Error).message);
      }

      // 2. Groq (cuota diaria generosa, vision con Llama 4)
      if (!responseText) {
        try {
          const groqCompletion = await this.groq.chat.completions.create({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: [
                { type: 'text', text: 'Analiza esta prenda de vestir y responde SOLO con el JSON pedido.' },
                { type: 'image_url', image_url: { url: `data:${cleanMimeType};base64,${base64Image}` } },
              ]},
            ],
            temperature: 0.2,
            max_tokens: 700,
            stream: false,
          });
          responseText = (groqCompletion as OpenAI.Chat.ChatCompletion).choices[0]?.message?.content?.trim() || null;
          if (responseText) console.log('[Groq] describeGarment: éxito');
        } catch (groqErr) {
          console.warn('[Groq] describeGarment falló:', (groqErr as Error).message);
        }
      }

      // 3. OpenRouter (modelos cloud gratuitos)
      if (!responseText) {
        try {
          responseText = await this.callOpenRouterVision(
            systemPrompt,
            'Analiza esta prenda de vestir:',
            imageBuffer,
            cleanMimeType,
            0.2,
            500,
          );
        } catch (orErr) {
          console.warn('[OpenRouter] describeGarment falló:', (orErr as Error).message);
        }
      }

      // 3. Ollama local en CPU — sin límites de cuota (requiere OLLAMA_NUM_GPU=0 en env)
      if (!responseText) {
        const ollamaModels = ['llava-phi3', 'llava'];
        for (const ollamaModel of ollamaModels) {
          try {
            console.log(`[Ollama/${ollamaModel}] Intentando...`);
            const ollamaRes = await fetch('http://localhost:11434/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: ollamaModel,
                stream: false,
                options: { num_predict: 500 },
                messages: [
                  { role: 'system', content: systemPrompt },
                  {
                    role: 'user',
                    content: 'Analiza esta prenda de vestir y responde SOLO con el JSON pedido.',
                    images: [base64Image],
                  },
                ],
              }),
            });
            if (ollamaRes.ok) {
              const ollamaJson = await ollamaRes.json() as { message?: { content?: string } };
              responseText = ollamaJson.message?.content?.trim() || null;
              if (responseText) { console.log(`[Ollama/${ollamaModel}] éxito`); break; }
              else console.warn(`[Ollama/${ollamaModel}] respuesta vacía`);
            } else {
              const errBody = await ollamaRes.text();
              console.warn(`[Ollama/${ollamaModel}] HTTP ${ollamaRes.status}:`, errBody.slice(0, 120));
            }
          } catch (ollamaErr) {
            console.warn(`[Ollama/${ollamaModel}] falló:`, (ollamaErr as Error).message);
          }
        }
      }

      if (!responseText) throw new BadRequestException('No se pudo obtener respuesta de la IA');

      const parsed = this.parseJsonFromLlm<{ category?: string; name?: string; description?: string }>(responseText);

      const validCategories = ['TOP', 'OUTERWEAR', 'BOTTOM', 'DRESS', 'FOOTWEAR', 'ACCESSORY'];
      if (!parsed.category || !validCategories.includes(parsed.category)) {
        parsed.category = 'ACCESSORY';
      }

      return {
        name: parsed.name?.trim() || 'Prenda sin nombre',
        description: parsed.description?.trim() || 'Sin descripción disponible',
        category: parsed.category,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Error al describir la prenda: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async analyzeImage(imageBuffer: Buffer, mimeType: string, additionalContext?: string) {
    try {
      const answer = await this.callOpenRouterVision(
          'Eres un experto en análisis de diagramas UML y generación de diagramas de clases en formato JSON para GoJS.\n\n' +
          '🎯 OBJETIVO: Analizar la imagen y, si contiene un diagrama UML o estructura similar, generar un JSON de GoJS.\n' +
          'Si NO es relevante, responde exactamente: "La imagen no contiene un diagrama UML o estructura que pueda convertirse en un diagrama de clases."\n\n' +
          '🧱 ESTRUCTURA DEL JSON:\n' +
          '{ "class": "GraphLinksModel", "nodeDataArray": [...], "linkDataArray": [...] }\n\n' +
          'Cada nodo debe tener: key (entero negativo único), name (Mayúscula inicial), attribute, methods, loc, nodeType: "standard"\n' +
          'Cada link debe tener: from, to, category, fromMultiplicity ("1" o "*"), toMultiplicity ("1" o "*")\n\n' +
          'NO usar símbolos (+, -, #). Atributos y métodos en minúscula. Responde SOLO con el JSON puro o el mensaje indicado.',
        additionalContext
          ? `Analiza esta imagen. Contexto adicional: ${additionalContext}`
          : 'Analiza esta imagen y devuelve el JSON siguiendo todas las reglas.',
        imageBuffer,
        mimeType,
        0,
        4000
      );

      if (!answer) throw new BadRequestException('No se pudo obtener respuesta de la IA');

      return { imageAnalysis: answer, model: 'grok-4.3' };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Error al analizar la imagen: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async fixMultiplicity(gojsDiagram: unknown) {
    try {
      const diagram = gojsDiagram as { nodeDataArray?: unknown[]; linkDataArray?: unknown[] };
      if (!diagram.nodeDataArray || !diagram.linkDataArray) {
        throw new BadRequestException('El JSON debe contener nodeDataArray y linkDataArray');
      }

      const model = this.gemini.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction:
          'Eres un experto en diagramas UML. Corrige ÚNICAMENTE fromMultiplicity y toMultiplicity del diagrama GoJS.\n\n' +
          'REGLAS:\n' +
          '- Solo usa "1" o "*"\n' +
          '- Composición: parte (*) → todo (1)\n' +
          '- Agregación: elementos (*) → contenedor (1)\n' +
          '- Herencia: hijos (*) → padre (1)\n' +
          '- NO cambies keys, names, attributes, methods, locations, categories\n\n' +
          'Responde SOLO con el JSON corregido, sin markdown ni explicaciones.',
        generationConfig: { temperature: 0.1, maxOutputTokens: 4000, responseMimeType: 'application/json' },
      });

      const result = await model.generateContent(
        `Corrige las multiplicidades:\n\n${JSON.stringify(gojsDiagram, null, 2)}`,
      );

      const correctedDiagram = result.response.text();
      if (!correctedDiagram) throw new BadRequestException('No se pudo corregir el diagrama');

      return { originalDiagram: gojsDiagram, correctedDiagram, model: 'gemini-2.5-flash' };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Error al corregir multiplicidades: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async validateAndCorrectDiagram(gojsDiagram: unknown) {
    try {
      const diagram = gojsDiagram as { nodeDataArray?: unknown[]; linkDataArray?: unknown[] };
      if (!diagram.nodeDataArray || !diagram.linkDataArray) {
        throw new BadRequestException('El JSON debe contener nodeDataArray y linkDataArray');
      }

      const model = this.gemini.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction:
          'Eres un experto en diagramas UML. Analiza el diagrama GoJS y determina si está correctamente construido.\n\n' +
          'CRITERIOS: lógica de relaciones, consistencia de multiplicidades (solo "1" o "*"), ortografía (clases con Mayúscula, atributos en minúscula), estructura GoJS válida.\n\n' +
          'Responde SOLO con JSON: { "perfect": "yes|no", "diagram": <objeto GoJS corregido o igual> }',
        generationConfig: { temperature: 0.1, maxOutputTokens: 4000, responseMimeType: 'application/json' },
      });

      const result = await model.generateContent(
        `Analiza y corrige si es necesario:\n\n${JSON.stringify(gojsDiagram, null, 2)}`,
      );

      const response = result.response.text();
      if (!response) throw new BadRequestException('No se pudo validar el diagrama');

      let parsedResponse: { perfect?: string; diagram?: unknown };
      try {
        parsedResponse = JSON.parse(response);
      } catch {
        throw new BadRequestException('La respuesta de la IA no es un JSON válido');
      }

      if (!parsedResponse.perfect || !parsedResponse.diagram) {
        throw new BadRequestException('La respuesta no tiene la estructura esperada (perfect, diagram)');
      }

      let diagramData: { nodeDataArray?: unknown[]; linkDataArray?: unknown[] };
      if (typeof parsedResponse.diagram === 'string') {
        try {
          diagramData = JSON.parse(parsedResponse.diagram);
        } catch {
          throw new BadRequestException('El diagrama corregido no es un JSON válido');
        }
      } else {
        diagramData = parsedResponse.diagram as typeof diagramData;
      }

      if (!diagramData.nodeDataArray || !diagramData.linkDataArray) {
        throw new BadRequestException('El diagrama corregido no mantiene la estructura GoJS correcta');
      }

      return {
        perfect: parsedResponse.perfect,
        diagram: JSON.stringify(diagramData),
        originalDiagram: gojsDiagram,
        correctedDiagram: diagramData,
        model: 'gemini-2.5-flash',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Error al validar el diagrama: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async describeHairstyle(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<{ description: string; gender: string }> {
    try {
      const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      let cleanMimeType = mimeType?.split(';')[0]?.trim()?.toLowerCase();
      if (!cleanMimeType || !validMimeTypes.includes(cleanMimeType)) cleanMimeType = 'image/jpeg';

      const responseText = await this.callOpenRouterVision(
        `Eres un experto estilista capilar. Analiza imágenes de peinados y descríbelos.

INSTRUCCIONES: Describe tipo de corte, textura, estilo, volumen, para qué tipo de rostro es ideal y género recomendado.

Responde SOLO con JSON: { "description": "descripción (máximo 120 palabras)", "gender": "MALE|FEMALE|UNISEX" }
El gender DEBE ser exactamente: MALE, FEMALE o UNISEX`,
        'Analiza este peinado:',
        imageBuffer,
        cleanMimeType,
        0.2,
        500
      );

      if (!responseText) throw new BadRequestException('No se pudo obtener respuesta de la IA');

      let parsed: { description?: string; gender?: string };
      try {
        parsed = JSON.parse(responseText);
      } catch {
        throw new BadRequestException('La respuesta de la IA no es un JSON válido');
      }

      const validGenders = ['MALE', 'FEMALE', 'UNISEX'];
      if (!parsed.gender || !validGenders.includes(parsed.gender)) parsed.gender = 'UNISEX';

      return {
        description: parsed.description?.trim() || 'Sin descripción disponible',
        gender: parsed.gender,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Error al describir el peinado: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async recommendHairstyle(
    faceImageBuffer: Buffer,
    mimeType: string,
    hairstyles: { id: string; description: string }[],
    userAttributes?: { gender?: string; faceType?: string },
  ): Promise<{ hairstyleId: string; explanation: string }> {
    try {
      const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      let cleanMimeType = mimeType?.split(';')[0]?.trim()?.toLowerCase();
      if (!cleanMimeType || !validMimeTypes.includes(cleanMimeType)) cleanMimeType = 'image/jpeg';

      const hairstylesList = hairstyles
        .map((h, i) => `[${i}] ID: ${h.id}\n    Descripción: ${h.description}`)
        .join('\n\n');

      const userContext = userAttributes
        ? `\nATRIBUTOS DEL USUARIO:\n- Género: ${userAttributes.gender || 'No especificado'}\n- Tipo de rostro: ${userAttributes.faceType || 'No especificado'}`
        : '';

      const responseText = await this.callOpenRouterVision(
        `Eres un experto estilista capilar especializado en análisis facial y recomendación de peinados.
${userContext}

PEINADOS DISPONIBLES:
${hairstylesList}

INSTRUCCIONES:
1. Analiza la forma del rostro (ovalado, redondo, cuadrado, corazón, alargado, diamante)
2. Selecciona el peinado MÁS compatible
3. Explica por qué ese peinado es el ideal

Responde SOLO con JSON: { "hairstyleId": "ID_DEL_PEINADO", "explanation": "explicación (máximo 150 palabras)" }
El hairstyleId DEBE ser un ID válido de la lista.`,
        'Analiza mi rostro y recomiéndame el mejor peinado:',
        faceImageBuffer,
        cleanMimeType,
        0.3,
        600
      );

      if (!responseText) throw new BadRequestException('No se pudo obtener respuesta de la IA');

      let parsed: { hairstyleId?: string; explanation?: string };
      try {
        parsed = JSON.parse(responseText);
      } catch {
        throw new BadRequestException('No se pudo obtener una recomendación válida de la IA');
      }

      const validIds = hairstyles.map((h) => h.id);
      if (!parsed.hairstyleId || !validIds.includes(parsed.hairstyleId)) {
        parsed.hairstyleId = hairstyles[0].id;
      }

      return {
        hairstyleId: parsed.hairstyleId,
        explanation: parsed.explanation?.trim() || 'Peinado recomendado basado en tu tipo de rostro.',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Error al recomendar peinado: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async generateOutfit(generateOutfitDto: GenerateOutfitDto) {
    const { userId, event, weather } = generateOutfitDto;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userAttributes: true, closets: { include: { garments: true } } },
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');

    const allGarments = user.closets.flatMap((c) => c.garments);
    if (allGarments.length === 0) throw new BadRequestException('El usuario no tiene prendas en su closet');

    const garmentsWithDescription = allGarments.filter((g) => g.description);
    if (garmentsWithDescription.length === 0) {
      throw new BadRequestException('Las prendas no tienen descripción. Vuelve a subirlas para que sean analizadas.');
    }

    const userAttr = user.userAttributes[0];
    let userDescription = 'Sin atributos especificados';
    if (userAttr) {
      const parts: string[] = [];
      if (userAttr.gender)   parts.push(`Género: ${userAttr.gender}`);
      if (userAttr.age)      parts.push(`Edad: ${userAttr.age}`);
      if (userAttr.stature)  parts.push(`Estatura: ${userAttr.stature} cm`);
      if (userAttr.bodyType) parts.push(`Tipo de cuerpo: ${userAttr.bodyType}`);
      if (userAttr.skinTone) parts.push(`Tono de piel: ${userAttr.skinTone}`);
      if (userAttr.skinSubtone) parts.push(`Subtono: ${userAttr.skinSubtone}`);
      if (userAttr.faceType) parts.push(`Tipo de rostro: ${userAttr.faceType}`);
      if (userAttr.preferredStyles?.length) parts.push(`Estilos preferidos: ${userAttr.preferredStyles.join(', ')}`);
      if (userAttr.favoriteColors?.length)  parts.push(`Colores favoritos: ${userAttr.favoriteColors.join(', ')}`);
      if (userAttr.avoidColors?.length)     parts.push(`Colores a evitar: ${userAttr.avoidColors.join(', ')}`);
      if (userAttr.profession) parts.push(`Profesión: ${userAttr.profession}`);
      if (userAttr.climate)    parts.push(`Clima habitual: ${userAttr.climate}`);
      userDescription = parts.join(' | ') || 'Sin atributos especificados';
    }

    const garmentsList = garmentsWithDescription
      .map((g, i) => `[${i}] ID: ${g.id} | Categoría: ${g.category || 'SIN_CATEGORIA'}\n    Descripción: ${g.description}`)
      .join('\n\n');

    const formalityLevel = /reuni[oó]n|trabajo|oficina|entrevista|boda|iglesia|gala|cena formal|presentaci[oó]n|graduaci[oó]n|negocios|corporativo/i.test(event)
      ? 'FORMAL'
      : /teatro|cena|evento social|aniversario|cumple|fiesta elegante/i.test(event)
        ? 'SEMI_FORMAL'
        : 'CASUAL';

    const formalityRules =
      formalityLevel === 'FORMAL'
        ? `FORMALIDAD: Este evento es FORMAL.
  ✅ Prefiere: pantalones de vestir, camisas con botones, blazers, zapatos formales, mocasines, botas elegantes
  ❌ Evita shorts: si solo hay shorts disponibles, elige los más sobrios (no deportivos). Evita camisetas con estampados grandes, sneakers deportivos llamativos.
  Si el armario no tiene prendas formales suficientes, elige las más sobrias y crea un outfit presentable.`
        : formalityLevel === 'SEMI_FORMAL'
          ? `FORMALIDAD: Este evento es SEMI-FORMAL.
  ✅ Combina prendas elegantes con otras más relajadas; una camisa con pantalón chino o jeans oscuros está bien.
  ❌ Evita ropa muy deportiva o playera.`
          : `FORMALIDAD: Este evento es CASUAL. Puedes usar shorts, sneakers, camisetas y ropa cómoda.`;

    const outfitSystemPrompt = `Eres un experto estilista de moda. Selecciona un outfit completo y coherente de las prendas disponibles.

USUARIO: ${userDescription}
EVENTO: ${event}
CLIMA: ${weather}

${formalityRules}

PRENDAS DISPONIBLES:
${garmentsList}

REGLAS DE COMPOSICIÓN:
- Máximo 1 TOP, 1 OUTERWEAR, 1 BOTTOM, 1 DRESS (si hay DRESS no incluyas TOP ni BOTTOM), 1 FOOTWEAR, varios ACCESSORY
- Solo incluye IDs que existan exactamente en la lista de arriba
- Respeta el nivel de formalidad indicado arriba al escoger cada prenda
- Nombre del outfit: máximo 5 palabras
- Descripción: máximo 15 palabras

Responde SOLO con JSON válido:
{ "outfit": { "name": "nombre corto", "description": "descripción breve", "garments": [{ "id": "ID_EXACTO", "order": 1 }] } }`;

    const outfitUserPrompt = 'Genera un outfit apropiado basándote en las prendas disponibles.';

    type OutfitAiResponse = { outfit?: { name?: string; description?: string; garments?: { id: string; order?: number }[] } };

    let responseText: string | null = null;

    // 1. Groq — Llama 3.3 70B (primario por disponibilidad)
    try {
      const completion = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: outfitSystemPrompt },
          { role: 'user',   content: outfitUserPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        stream: false,
      });
      responseText = (completion as OpenAI.Chat.ChatCompletion).choices[0]?.message?.content?.trim() ?? null;
      if (responseText) console.log('[generateOutfit] Groq OK');
    } catch (err) {
      console.warn('[generateOutfit] Groq falló:', (err as Error).message.slice(0, 120));
    }

    // 2. Gemini 2.5 Flash
    if (!responseText) {
      try {
        const model = this.gemini.getGenerativeModel({
          model: 'gemini-2.5-flash',
          systemInstruction: outfitSystemPrompt,
          generationConfig: { temperature: 0.7, maxOutputTokens: 2000, responseMimeType: 'application/json' },
        });
        const result = await model.generateContent(outfitUserPrompt);
        responseText = result.response.text() ?? null;
        if (responseText) console.log('[generateOutfit] Gemini OK');
      } catch (err) {
        console.warn('[generateOutfit] Gemini falló:', (err as Error).message.slice(0, 120));
      }
    }

    if (!responseText) throw new BadRequestException('No se pudo generar el outfit. Los servicios de IA están ocupados, intenta de nuevo.');

    try {
      const outfitData = this.parseJsonFromLlm<OutfitAiResponse>(responseText);

      const garmentMap = new Map(garmentsWithDescription.map((g) => [g.id, g]));
      const selectedGarments = (outfitData.outfit?.garments ?? []).filter((g) => garmentMap.has(g.id));
      if (selectedGarments.length === 0) throw new BadRequestException('La IA no seleccionó prendas válidas del armario');

      const finalGarments = this.filterGarmentsByCategory(selectedGarments, garmentMap);
      if (finalGarments.length === 0) throw new BadRequestException('No se pudo armar un outfit válido con las prendas disponibles');

      const newOutfit = await this.prisma.outfit.create({
        data: {
          name: outfitData.outfit?.name ?? 'Outfit generado',
          description: outfitData.outfit?.description ?? '',
          garmentOutfits: {
            create: finalGarments.map((g: { id: string; order?: number }, i: number) => ({
              garmentId: g.id,
              order: g.order ?? i + 1,
            })),
          },
        },
        include: { garmentOutfits: { include: { garment: true }, orderBy: { order: 'asc' } } },
      });

      return { success: true, outfit: newOutfit, aiSuggestion: outfitData.outfit };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      throw new BadRequestException(`Error al procesar el outfit: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async analyzeSelfie(
    imageBuffer: Buffer,
    mimeType: string,
    isFullBody = false,
  ): Promise<{
    faceType?: string; skinTone?: string; skinSubtone?: string;
    hairColor?: string; hairType?: string; eyeColor?: string;
    gender?: string; bodyType?: string;
    confidence: Record<string, number>;
  }> {
    const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    let cleanMimeType = mimeType?.split(';')[0]?.trim()?.toLowerCase();
    if (!cleanMimeType || !validMimeTypes.includes(cleanMimeType)) cleanMimeType = 'image/jpeg';

    const bodyTypeField = isFullBody
      ? `- "bodyType": uno exacto de PEAR | RECTANGLE | HOURGLASS | APPLE | INVERTED_TRIANGLE`
      : `- "bodyType": null (foto de cara/busto, no visible)`;

    const systemInstruction = `Eres un experto en análisis físico para recomendaciones de moda. Analiza la foto y devuelve atributos físicos en JSON.

CAMPOS REQUERIDOS (devuelve TODOS, nunca omitas ninguno):
- "faceType": uno exacto de OVAL | ROUND | SQUARE | HEART | OBLONG
- "skinTone": uno exacto de LIGHT | MEDIUM_LIGHT | MEDIUM | MEDIUM_DARK | DARK
- "skinSubtone": uno exacto de WARM | COOL | NEUTRAL
- "hairColor": uno exacto de BLACK | DARK_BROWN | BROWN | LIGHT_BROWN | BLONDE | PLATINUM | RED | GRAY | WHITE
- "hairType": uno exacto de STRAIGHT | WAVY | CURLY | COILY
- "eyeColor": uno exacto de DARK_BROWN | BROWN | LIGHT_BROWN | HAZEL | AMBER | BLUE | LIGHT_BLUE | GREEN | LIGHT_GREEN | GRAY | BLACK
- "gender": uno exacto de MALE | FEMALE | NON_BINARY
${bodyTypeField}
- "confidence": objeto con puntuación 0-100 por campo (ej: {"faceType":80,"skinTone":90,...})

REGLAS:
- Siempre da un valor, nunca null excepto bodyType cuando la foto es solo de cara.
- Si algo no es claramente visible, elige el más probable y baja la confianza por debajo de 50.
- WARM=tonos dorados/amarillos, COOL=tonos rosados/azulados, NEUTRAL=mezcla.
- Responde ÚNICAMENTE con JSON válido, sin markdown ni texto extra.`;

    const text = await this.callOpenRouterVision(
      systemInstruction,
      'Analiza los atributos físicos de esta persona. Responde SOLO con el objeto JSON completo:',
      imageBuffer,
      cleanMimeType,
      0.1,
      2048
    );

    if (!text) throw new BadRequestException('Sin respuesta de la IA');

    // parseJsonFromLlm will throw a BadRequestException with detailed error if it fails
    const parsed = this.parseJsonFromLlm<Record<string, unknown>>(text);

    const pick = (val: unknown, opts: string[]): string | undefined =>
      opts.includes(val as string) ? (val as string) : undefined;

    return {
      faceType:    pick(parsed.faceType,    ['OVAL','ROUND','SQUARE','HEART','OBLONG']),
      skinTone:    pick(parsed.skinTone,    ['LIGHT','MEDIUM_LIGHT','MEDIUM','MEDIUM_DARK','DARK']),
      skinSubtone: pick(parsed.skinSubtone, ['WARM','COOL','NEUTRAL']),
      hairColor:   pick(parsed.hairColor,   ['BLACK','DARK_BROWN','BROWN','LIGHT_BROWN','BLONDE','PLATINUM','RED','GRAY','WHITE']),
      hairType:    pick(parsed.hairType,    ['STRAIGHT','WAVY','CURLY','COILY']),
      eyeColor:    pick(parsed.eyeColor,    ['DARK_BROWN','BROWN','LIGHT_BROWN','HAZEL','AMBER','BLUE','LIGHT_BLUE','GREEN','LIGHT_GREEN','GRAY','BLACK']),
      gender:      pick(parsed.gender,      ['MALE','FEMALE','NON_BINARY']),
      bodyType:    isFullBody ? pick(parsed.bodyType, ['PEAR','RECTANGLE','HOURGLASS','APPLE','INVERTED_TRIANGLE']) : undefined,
      confidence:  typeof parsed.confidence === 'object' && parsed.confidence !== null
        ? parsed.confidence as Record<string, number>
        : {},
    };
  }

  private async callOpenRouterVision(
    systemInstruction: string,
    promptText: string,
    imageBuffer: Buffer,
    mimeType: string,
    temperature = 0.1,
    maxTokens = 500,
  ): Promise<string> {
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: [
        { type: 'text', text: promptText },
        { type: 'image_url', image_url: { url: dataUrl } },
      ]},
    ];

    // Free vision models on OpenRouter — tried in order until one succeeds
    const models = [
      'nvidia/nemotron-nano-12b-v2-vl:free',
      'google/gemma-4-26b-a4b-it:free',
      'google/gemma-4-31b-it:free',
      'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      'baidu/qianfan-ocr-fast:free',
    ];

    for (let i = 0; i < models.length; i++) {
      try {
        console.log(`[OpenRouter] Intentando modelo ${i + 1}/${models.length}: ${models[i]}`);
        const completion = await this.openrouter.chat.completions.create({
          model: models[i],
          messages,
          temperature,
          max_tokens: maxTokens,
          // response_format omitido: no todos los modelos lo soportan (causa 400)
          stream: false,
        });
        const text = (completion as OpenAI.Chat.ChatCompletion).choices[0]?.message?.content;
        if (text) {
          console.log(`[OpenRouter] Éxito con modelo: ${models[i]}`);
          return text;
        }
        // Empty response — try next model
        if (i < models.length - 1) continue;
        break;
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status;
        console.warn(`[OpenRouter] Modelo ${models[i]} falló con status ${status ?? 'desconocido'}`);
        if ((status === 400 || status === 404 || status === 429) && i < models.length - 1) continue;
        if (status === 429) {
          throw new HttpException(
            'El servicio de IA está temporalmente sobrecargado. Esperá unos segundos e intentá de nuevo.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        throw err;
      }
    }
    throw new HttpException('No hay modelos de visión disponibles en este momento.', HttpStatus.SERVICE_UNAVAILABLE);
  }

  private filterGarmentsByCategory(
    garments: { id: string; order?: number }[],
    garmentMap: Map<string, { id: string; category?: string | null }>,
  ): { id: string; order?: number }[] {
    const categoryCount: Record<string, number> = {};
    const filtered: { id: string; order?: number }[] = [];

    for (const garment of garments) {
      const category = garmentMap.get(garment.id)?.category ?? 'ACCESSORY';
      if (category === 'ACCESSORY') {
        filtered.push(garment);
        continue;
      }
      categoryCount[category] = categoryCount[category] ?? 0;
      if (categoryCount[category] < 1) {
        categoryCount[category]++;
        filtered.push(garment);
      }
    }

    const hasDress = filtered.some((g) => garmentMap.get(g.id)?.category === 'DRESS');
    if (!hasDress) return filtered;
    return filtered.filter((g) => !['TOP', 'BOTTOM'].includes(garmentMap.get(g.id)?.category ?? ''));
  }

  async translateToSpanish(text: string): Promise<{ translated: string }> {
    try {
      const model = this.gemini.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { temperature: 0.1, maxOutputTokens: 400 },
      });
      const result = await model.generateContent(
        `Translate this fashion garment description to natural Spanish. Return ONLY the translated text, no explanations, no quotes:\n\n${text}`
      );
      const translated = result.response.text().trim();
      if (!translated) throw new Error('Empty response');
      return { translated };
    } catch {
      throw new BadRequestException('No se pudo traducir el texto');
    }
  }


  async generateOutfitPreview(prompt: string, userId?: string, outfitName?: string): Promise<{ imageBase64: string; mimeType: string }> {
    // ── Recopilar datos del usuario ──────────────────────────────────────────
    let attr: Awaited<ReturnType<typeof this.prisma.userAttribute.findFirst>> = null;
    let profilePhotoUrl: string | null = null;

    if (userId) {
      const [attrResult, user] = await Promise.all([
        this.prisma.userAttribute.findFirst({ where: { userId } }).catch(() => null),
        this.prisma.user.findUnique({ where: { id: userId }, select: { profilePhoto: true } }).catch(() => null),
      ]);
      attr = attrResult;
      profilePhotoUrl = user?.profilePhoto ?? null;
    }

    // ── Descripción de la persona a partir de atributos ─────────────────────
    const buildPersonDesc = () => {
      if (!attr) return 'person';
      const p: string[] = [];
      if (attr.age)      p.push(`${attr.age}-year-old`);
      if (attr.gender)   p.push(attr.gender.toLowerCase());
      p.push('person');
      if (attr.stature)  p.push(`${attr.stature}cm tall`);
      if (attr.bodyType) p.push(attr.bodyType.toLowerCase().replace('_', ' ') + ' body type');
      const skin = [attr.skinTone?.toLowerCase().replace('_', ' '), attr.skinSubtone ? attr.skinSubtone.toLowerCase() + ' undertone' : ''].filter(Boolean);
      if (skin.length)   p.push(skin.join(', ') + ' skin');
      const hair = [attr.hairColor?.toLowerCase(), attr.hairType?.toLowerCase()].filter(Boolean);
      if (hair.length)   p.push(hair.join(' ') + ' hair');
      if (attr.eyeColor) p.push(attr.eyeColor.toLowerCase() + ' eyes');
      return p.join(', ');
    };

    const personDesc = buildPersonDesc();

    // ── Negative prompt compartido ───────────────────────────────────────────
    const negativePrompt =
      'wrong clothing, extra accessories not described, bad anatomy, mutations, deformed, ' +
      'blurry, incorrect colors, distorted fabric, ugly, low quality, cropped body, ' +
      'missing limbs, extra limbs, missing accessories, additional unspecified clothing';

    // ── Intento 1: img2img con la foto de perfil del usuario ────────────────
    if (profilePhotoUrl) {
      try {
        console.log('[CF img2img] Intentando con foto de perfil del usuario...');

        // Redimensionar via Cloudinary si es posible (512x512 JPEG, ~20-50KB)
        const fetchUrl = profilePhotoUrl.includes('cloudinary.com')
          ? profilePhotoUrl.replace('/upload/', '/upload/w_512,h_512,c_fill,f_jpg,q_70/')
          : profilePhotoUrl;

        const photoRes = await fetch(fetchUrl);
        if (!photoRes.ok) throw new Error(`No se pudo descargar foto: HTTP ${photoRes.status}`);

        const photoBuffer = Buffer.from(await photoRes.arrayBuffer());
        const imageArray = Array.from(new Uint8Array(photoBuffer));

        // Prompt estilo SD: ropa primero con énfasis, persona después
        const styleContext = outfitName ? `outfit style: "${outfitName}", ` : '';
        const sdPrompt =
          `${styleContext}(${prompt}:1.3), ` +
          `full body shot head to toe, ${personDesc}, ` +
          `white studio background, photorealistic, sharp focus, ` +
          `professional fashion photography, 8k`;

        const url = `https://api.cloudflare.com/client/v4/accounts/${envs.cfAccountId}/ai/run/@cf/runwayml/stable-diffusion-v1-5-img2img`;

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${envs.cfApiToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: sdPrompt,
            image: imageArray,
            strength: 0.38,
            guidance: 9.0,
            num_inference_steps: 20,
            negative_prompt: negativePrompt,
          }),
        });

        if (!res.ok) {
          const err = await res.text();
          throw new Error(`HTTP ${res.status}: ${err.slice(0, 200)}`);
        }

        const contentType = res.headers.get('content-type') ?? 'image/jpeg';
        const arrayBuffer = await res.arrayBuffer();
        const imageBase64 = Buffer.from(arrayBuffer).toString('base64');
        if (imageBase64.length < 100) throw new Error('Imagen vacía');

        console.log('[CF img2img] Éxito con foto de perfil');
        return { imageBase64, mimeType: contentType.split(';')[0] || 'image/jpeg' };
      } catch (e) {
        console.warn('[CF img2img] Falló, usando FLUX como fallback:', (e as Error).message.slice(0, 100));
      }
    }

    // ── Intento 2 (fallback): text-to-image con FLUX.1-schnell ──────────────
    console.log('[CF FLUX] Generando con text-to-image...');

    const nameContext = outfitName ? `Outfit style: "${outfitName}". ` : '';
    const fluxPrompt =
      `${nameContext}Professional full-body fashion photograph of a ${personDesc}, ` +
      `wearing ${prompt}. ` +
      `All garments rendered with exact colors, fabric textures, logos, correct body placement. ` +
      `Complete head-to-toe view, nothing cropped. ` +
      `Clean white studio background, soft diffused lighting. ` +
      `Ultra-sharp, 8k resolution, high-end fashion editorial photography.`;

    const fluxUrl = `https://api.cloudflare.com/client/v4/accounts/${envs.cfAccountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`;

    const res = await fetch(fluxUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${envs.cfApiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: fluxPrompt, num_steps: 8 }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[CF FLUX] Error HTTP', res.status, err.slice(0, 300));
      throw new BadRequestException('No se pudo generar la imagen. Intentá de nuevo.');
    }

    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    if (contentType.includes('application/json')) {
      const json = await res.json() as { result?: { image?: string } };
      const imageBase64 = json?.result?.image;
      if (!imageBase64) throw new BadRequestException('Respuesta inesperada de Cloudflare AI');
      return { imageBase64, mimeType: 'image/jpeg' };
    }

    const arrayBuffer = await res.arrayBuffer();
    const imageBase64 = Buffer.from(arrayBuffer).toString('base64');
    if (imageBase64.length < 100) throw new BadRequestException('Imagen vacía recibida');

    console.log('[CF FLUX] Imagen generada exitosamente');
    return { imageBase64, mimeType: contentType.split(';')[0] };
  }

  async fashionChat(params: {
    messages: { role: 'USER' | 'ASSISTANT'; content: string }[];
    userProfile: {
      gender?: string | null; age?: number | null; stature?: number | null;
      bodyType?: string | null; skinTone?: string | null; skinSubtone?: string | null;
      preferredStyles?: string[]; favoriteColors?: string[]; avoidColors?: string[];
      profession?: string | null; climate?: string | null; climateCity?: string | null;
    } | null;
    garments: { id: string; name: string | null; description: string | null; category: string | null }[];
    hasOutfit: boolean;
    savedEvent?: string | null;
    savedWeather?: string | null;
  }): Promise<{ reply: string; action: 'chat' | 'generate_outfit' | 'request_face_photo'; event?: string; weather?: string }> {
    const { messages, userProfile, garments, hasOutfit, savedEvent, savedWeather } = params;

    // Perfil del usuario en texto
    const profileParts: string[] = [];
    if (userProfile) {
      if (userProfile.gender)   profileParts.push(`Género: ${userProfile.gender}`);
      if (userProfile.age)      profileParts.push(`Edad: ${userProfile.age}`);
      if (userProfile.stature)  profileParts.push(`Estatura: ${userProfile.stature}cm`);
      if (userProfile.bodyType) profileParts.push(`Cuerpo: ${userProfile.bodyType}`);
      if (userProfile.skinTone) profileParts.push(`Tono de piel: ${userProfile.skinTone}`);
      if (userProfile.skinSubtone) profileParts.push(`Subtono: ${userProfile.skinSubtone}`);
      if (userProfile.preferredStyles?.length) profileParts.push(`Estilos preferidos: ${userProfile.preferredStyles.join(', ')}`);
      if (userProfile.favoriteColors?.length)  profileParts.push(`Colores favoritos: ${userProfile.favoriteColors.join(', ')}`);
      if (userProfile.avoidColors?.length)     profileParts.push(`Evita colores: ${userProfile.avoidColors.join(', ')}`);
      if (userProfile.profession) profileParts.push(`Profesión: ${userProfile.profession}`);
      if (userProfile.climate)    profileParts.push(`Clima habitual: ${userProfile.climate}${userProfile.climateCity ? ` (${userProfile.climateCity})` : ''}`);
    }
    const profileDesc = profileParts.length ? profileParts.join(' | ') : 'Sin datos de perfil';

    // Lista de prendas resumida
    const garmentsList = garments.length
      ? garments.map(g => `[${g.id}] ${g.name ?? 'Sin nombre'} (${g.category ?? '?'}): ${(g.description ?? '').slice(0, 90)}`).join('\n')
      : 'Sin prendas disponibles';

    // Historial de conversación formateado
    const historyText = messages.slice(-14)
      .map(m => `${m.role === 'USER' ? 'Usuario' : 'Stylist'}: ${m.content}`)
      .join('\n\n');

    // Clima efectivo: puede venir de la conversación guardada o del perfil
    const effectiveWeather = savedWeather ?? userProfile?.climate ?? null;
    const effectiveWeatherLabel = effectiveWeather
      ? `${effectiveWeather}${!savedWeather && userProfile?.climateCity ? ` (${userProfile.climateCity})` : ''}`
      : null;

    // Construir secciones de datos confirmados vs pendientes
    const confirmedLines: string[] = [];
    const pendingLines:   string[] = [];

    if (savedEvent)           confirmedLines.push(`✅ EVENTO: "${savedEvent}" — confirmado, NO preguntes`);
    else                       pendingLines.push(`❌ EVENTO: desconocido — necesitas que el usuario te lo diga`);

    if (effectiveWeatherLabel) confirmedLines.push(`✅ CLIMA: "${effectiveWeatherLabel}" — ${savedWeather ? 'confirmado por el usuario' : 'tomado del perfil'}, NO preguntes`);
    else                        pendingLines.push(`❌ CLIMA: desconocido — necesitas que el usuario te lo diga`);

    const dataSection = [...confirmedLines, ...pendingLines].join('\n');
    const canGenerateNow = !!effectiveWeather; // si hay clima, solo falta evento

    const systemInstruction = `Eres "Stylist", un asistente de moda personal cálido y experto. Ayudas al usuario a elegir outfits de su propio armario.

PERFIL DEL USUARIO:
${profileDesc}

PRENDAS DISPONIBLES:
${garmentsList}

${hasOutfit ? `
ESTADO: Ya generaste un outfit para "${savedEvent ?? 'el evento'}" (clima: ${effectiveWeatherLabel ?? 'desconocido'}).

QUÉ PUEDES HACER AHORA:

CASO A — El usuario rechaza el outfit o pide otro diferente/más formal/menos formal
→ Usa action "generate_outfit" CON event="${savedEvent ?? ''}" y weather="${effectiveWeatherLabel ?? ''}"
→ HAZLO DE INMEDIATO. NO digas "voy a generar" y devuelvas action "chat". Si vas a generar, genera YA.
→ Señales: "no me gusta", "dame otro", "algo más formal", "quiero otro estilo", "sí" (después de que prometiste generar), "ok", "generalo", "hazlo", confirmaciones

CASO B — El usuario pregunta sobre adaptaciones / otra ocasión / complementos
→ Usa action "chat", da consejos útiles y concretos
→ Señales: "y para la iglesia?", "si hace frío?", "tengo alguna prenda?", preguntas de adaptación

CASO C — El usuario quiere recomendación de peinado y lo confirma
→ action "request_face_photo"

⚠️ CRÍTICO: Si ya en mensajes anteriores dijiste que ibas a generar un nuevo outfit y el usuario confirmó (sí, ok, dale, generalo, hazlo) → usa generate_outfit AHORA, no hagas más preguntas.
` : `
DATOS PARA GENERAR EL OUTFIT:
${dataSection}
${canGenerateNow ? `
⚡ REGLA CRÍTICA: El clima YA está confirmado ("${effectiveWeatherLabel}"). En cuanto el usuario mencione el EVENTO, devuelve action "generate_outfit" DE INMEDIATO sin más preguntas.` : ''}
`}

REGLAS GENERALES:
- Responde siempre en español, de forma cálida y natural — máximo 2 oraciones
- NUNCA preguntes por datos marcados como ✅ confirmados
- NUNCA digas "(sí/no)" ni seas robótico

RESPONDE ÚNICAMENTE CON ESTE JSON (sin markdown, sin texto extra):
{
  "reply": "tu respuesta natural",
  "action": "chat",
  "event": null,
  "weather": null
}

action posibles: "chat" | "generate_outfit" | "request_face_photo"
Cuando action = "generate_outfit": incluye "event" y "weather"
Clima por defecto si lo necesitas: "${effectiveWeatherLabel ?? 'templado'}"
Evento por defecto si lo necesitas: "${savedEvent ?? ''}"` ;

    const fullPrompt = `HISTORIAL DE CONVERSACIÓN:\n${historyText}\n\n---\nResponde al último mensaje del Usuario siguiendo todas las reglas del sistema.`;

    const parseResponse = (raw: string) => {
      const parsed = this.parseJsonFromLlm<{
        reply?: string; action?: string; event?: string | null; weather?: string | null;
      }>(raw);
      return {
        reply: parsed.reply?.trim() || '¿En qué puedo ayudarte?',
        action: (['chat', 'generate_outfit', 'request_face_photo'].includes(parsed.action ?? '')
          ? parsed.action as 'chat' | 'generate_outfit' | 'request_face_photo'
          : 'chat'),
        event:   parsed.event   ?? undefined,
        weather: parsed.weather ?? undefined,
      };
    };

    // 1. Groq — Llama 3.3 70B (rápido, gratuito, muy capaz para conversación)
    try {
      const groqMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemInstruction },
        { role: 'user',   content: fullPrompt },
      ];
      const completion = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: groqMessages,
        temperature: 0.85,
        max_tokens: 400,
        stream: false,
      });
      const raw = (completion as OpenAI.Chat.ChatCompletion).choices[0]?.message?.content?.trim();
      if (raw) { console.log('[fashionChat] Groq OK'); return parseResponse(raw); }
    } catch (err) {
      console.warn('[fashionChat] Groq falló:', (err as Error).message.slice(0, 120));
    }

    // 2. Gemini 2.5 Flash
    try {
      const model = this.gemini.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction,
        generationConfig: { temperature: 0.85, maxOutputTokens: 400 },
      });
      const result = await model.generateContent(fullPrompt);
      const raw = result.response.text();
      if (raw) { console.log('[fashionChat] Gemini OK'); return parseResponse(raw); }
    } catch (err) {
      console.warn('[fashionChat] Gemini falló:', (err as Error).message.slice(0, 120));
    }

    // 3. OpenRouter — fallback final
    try {
      const orMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemInstruction },
        { role: 'user',   content: fullPrompt },
      ];
      const completion = await this.openrouter.chat.completions.create({
        model: 'google/gemma-4-27b-it:free',
        messages: orMessages,
        temperature: 0.85,
        max_tokens: 400,
        stream: false,
      });
      const raw = (completion as OpenAI.Chat.ChatCompletion).choices[0]?.message?.content?.trim();
      if (raw) { console.log('[fashionChat] OpenRouter OK'); return parseResponse(raw); }
    } catch (err) {
      console.warn('[fashionChat] OpenRouter falló:', (err as Error).message.slice(0, 120));
    }

    return { reply: 'Lo siento, los servicios de IA están ocupados en este momento. ¿Puedes intentarlo de nuevo en un segundo?', action: 'chat' };
  }

  async detectAffirmative(text: string): Promise<boolean> {
    try {
      const model = this.gemini.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { temperature: 0, maxOutputTokens: 5 },
      });
      const result = await model.generateContent(
        `Does this message express agreement, "yes", or a positive response in any language or informal style? Answer ONLY "yes" or "no".\n\nMessage: "${text.trim()}"`,
      );
      return result.response.text().trim().toLowerCase().startsWith('yes');
    } catch {
      return /^(s[ií]|si|yes|dale|claro|por supuesto|ok|va|bueno|quiero|adelante|obvio|sisi|yep|yeah|aha)/i.test(text.trim());
    }
  }

  async fashionFreeChat(userMessage: string, recentMessages: string): Promise<string> {
    try {
      const model = this.gemini.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction:
          'Eres un asistente experto en moda y estilo personal. Ya ayudaste al usuario a elegir un outfit. ' +
          'La conversación puede continuar sobre moda, consejos de estilo, combinaciones, tendencias o cualquier duda que tenga. ' +
          'Responde de forma natural, amigable y concisa (máximo 150 palabras). ' +
          'Si el usuario pregunta algo completamente ajeno a la moda, guíalo suavemente de vuelta al tema.',
        generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
      });

      const prompt = recentMessages
        ? `Historial reciente de la conversación:\n${recentMessages}\n\nUsuario: ${userMessage}`
        : userMessage;

      const result = await model.generateContent(prompt);
      const reply = result.response.text().trim();
      if (!reply) throw new Error('empty');
      return reply;
    } catch {
      return '¡Claro! Estoy aquí para ayudarte con cualquier duda sobre moda y estilo. ¿En qué más puedo ayudarte?';
    }
  }

  private parseJsonFromLlm<T>(text: string): T {
    let cleanText = text.trim();

    // Strip markdown code fences
    if (cleanText.startsWith('```json')) cleanText = cleanText.substring(7);
    else if (cleanText.startsWith('```')) cleanText = cleanText.substring(3);
    if (cleanText.endsWith('```')) cleanText = cleanText.substring(0, cleanText.length - 3);
    cleanText = cleanText.trim();

    // First attempt — valid JSON
    try { return JSON.parse(cleanText) as T; } catch { /* fall through to repair */ }

    // Second attempt — repair truncated JSON
    // Remove trailing incomplete key (e.g. "key": or "key": partial_value)
    let repaired = cleanText.replace(/,?\s*"[^"]*"\s*:\s*[^{[}\]"]*$/, '');
    // Remove trailing comma
    repaired = repaired.replace(/,\s*$/, '');
    // Close unclosed string
    let inStr = false; let esc = false;
    for (let i = 0; i < repaired.length; i++) {
      const c = repaired[i];
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') inStr = !inStr;
    }
    if (inStr) repaired += '"';
    repaired = repaired.replace(/,\s*$/, '');
    // Use a stack so nested structures close in the correct order ({} before [] etc.)
    const stack: string[] = [];
    inStr = false; esc = false;
    for (let i = 0; i < repaired.length; i++) {
      const c = repaired[i];
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === '{') stack.push('}');
      else if (c === '[') stack.push(']');
      else if (c === '}' || c === ']') stack.pop();
    }
    while (stack.length > 0) repaired += stack.pop()!;

    try { return JSON.parse(repaired) as T; } catch { /* fall through to error */ }

    // Nothing worked — log and throw
    console.error('--- ERROR PARSING JSON FROM LLM ---');
    console.error('RAW:', text);
    console.error('REPAIRED ATTEMPT:', repaired);
    console.error('-----------------------------------');
    throw new BadRequestException('La IA devolvió una respuesta que no pudo procesarse. Intentá de nuevo.');
  }
}
