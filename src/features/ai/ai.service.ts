import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AskQuestionDto, GenerateOutfitDto } from './dto';
import { envs } from 'src/config/envs';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class AiService {
  private openai: OpenAI;
  private gemini: GoogleGenerativeAI;

  constructor(private readonly prisma: PrismaService) {
    this.openai = new OpenAI({
      apiKey: envs.openaiApiKey,
    });
    this.gemini = new GoogleGenerativeAI(envs.geminiApiKey);
  }

  async askQuestion(askQuestionDto: AskQuestionDto) {
    const { question } = askQuestionDto;


  }

  /**
   * Describe una prenda de vestir a partir de su imagen y determina su categoría
   * @param imageBuffer Buffer de la imagen
   * @param mimeType Tipo MIME de la imagen
   * @returns Objeto con descripción y categoría de la prenda
   */
  async describeGarment(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<{ description: string; category: string }> {
    try {
      // Validar y normalizar el tipo MIME
      const validImageMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
      ];

      // Limpiar el mimeType (puede venir con charset u otros parámetros)
      let cleanMimeType = mimeType?.split(';')[0]?.trim()?.toLowerCase();

      // Si no es válido, usar jpeg por defecto
      if (!cleanMimeType || !validImageMimeTypes.includes(cleanMimeType)) {
        cleanMimeType = 'image/jpeg';
      }

      const base64Image = imageBuffer.toString('base64');
      const dataUrl = `data:${cleanMimeType};base64,${base64Image}`;

      const systemMessage = `Eres un experto en moda y prendas de vestir. Tu tarea es analizar prendas de ropa, describirlas y clasificarlas.

CATEGORÍAS DISPONIBLES:
- TOP: Prendas superiores principales (camiseta, camisa, blusa, polo, top, playera, polera)
- OUTERWEAR: Capas exteriores (chaqueta, abrigo, suéter, cardigan, chaleco, hoodie, blazer)
- BOTTOM: Prendas inferiores (pantalón, short, falda, jeans, bermuda, jogger, leggings)
- DRESS: Prendas de cuerpo completo (vestido, mono, jumpsuit, overol, enterizo)
- FOOTWEAR: Calzado (zapatos, tenis, zapatillas, botas, sandalias, mocasines, tacones)
- ACCESSORY: Accesorios (gorra, sombrero, bolso, cinturón, bufanda, corbata, pañuelo, reloj, joyería)

INSTRUCCIONES:
1. Analiza la imagen de la prenda
2. Determina la CATEGORÍA correcta (debe ser exactamente una de las 6 opciones anteriores)
3. Proporciona una descripción detallada que incluya:
   - Tipo específico de prenda
   - Color(es) principal(es)
   - Material aparente
   - Estilo (casual, formal, deportivo, elegante)
   - Características especiales
   - Ocasiones apropiadas
   - Temporada/clima recomendado

FORMATO DE RESPUESTA (JSON estricto):
{
  "category": "CATEGORIA_AQUI",
  "description": "Descripción en un párrafo conciso (máximo 80 palabras)"
}

REGLAS:
- La categoría DEBE ser exactamente una de: TOP, OUTERWEAR, BOTTOM, DRESS, FOOTWEAR, ACCESSORY
- Responde SOLO con el JSON, sin texto adicional ni bloques de código markdown`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemMessage,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analiza esta prenda de vestir:',
              },
              {
                type: 'image_url',
                image_url: {
                  url: dataUrl,
                },
              },
            ],
          },
        ],
        temperature: 0.2,
        max_tokens: 400,
      });

      const responseText = completion.choices[0]?.message?.content;

      if (!responseText) {
        throw new BadRequestException('No se pudo obtener respuesta de la IA');
      }

      // Limpiar y parsear el JSON
      const cleanedResponse = responseText
        .replace(/^```json\s*/, '')
        .replace(/^```\s*/, '')
        .replace(/\s*```$/, '')
        .trim();

      let result;
      try {
        result = JSON.parse(cleanedResponse);
      } catch {
        throw new BadRequestException('La respuesta de la IA no es un JSON válido');
      }

      // Validar que la categoría sea válida
      const validCategories = ['TOP', 'OUTERWEAR', 'BOTTOM', 'DRESS', 'FOOTWEAR', 'ACCESSORY'];
      if (!result.category || !validCategories.includes(result.category)) {
        result.category = 'ACCESSORY'; // Default si no se puede determinar
      }

      return {
        description: result.description?.trim() || 'Sin descripción disponible',
        category: result.category,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error.response?.status === 401) {
        throw new BadRequestException('API key de OpenAI inválida');
      }
      if (error.response?.status === 429) {
        throw new BadRequestException('Límite de solicitudes excedido. Intenta más tarde.');
      }
      throw new BadRequestException(`Error al describir la prenda: ${error.message}`);
    }
  }

  async analyzeImage(
    imageBuffer: Buffer,
    mimeType: string,
    additionalContext?: string,
  ) {
    try {
      // Convertir imagen a base64
      const base64Image = imageBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64Image}`;

      // Contexto especializado para análisis de imágenes y generación de diagramas UML
      const systemMessage =
        'Eres un experto en análisis de diagramas UML y generación de diagramas de clases en formato JSON para GoJS.\n\n' +
        '────────────────────────────\n' +
        '🎯 OBJETIVO\n' +
        '────────────────────────────\n' +
        'Tu tarea es:\n' +
        '1. ANALIZAR la imagen proporcionada.\n' +
        '2. IDENTIFICAR si contiene un diagrama UML, esquema o estructura similar que pueda representarse como un diagrama de clases.\n' +
        '3. SI ES RELEVANTE, generar un JSON de GoJS siguiendo las REGLAS EXACTAS definidas más abajo.\n' +
        '4. SI NO ES RELEVANTE, responde exactamente con: "La imagen no contiene un diagrama UML o estructura que pueda convertirse en un diagrama de clases."\n\n' +
        '────────────────────────────\n' +
        '📘 TIPOS DE IMÁGENES QUE PUEDES PROCESAR\n' +
        '────────────────────────────\n' +
        '- Diagramas UML dibujados a mano\n' +
        '- Diagramas UML digitales\n' +
        '- Esquemas de base de datos\n' +
        '- Organigramas empresariales\n' +
        '- Diagramas conceptuales\n' +
        '- Bocetos o mapas de entidades\n' +
        '- Mapas mentales con relaciones\n\n' +
        '────────────────────────────\n' +
        '📦 FORMATO DE RESPUESTA\n' +
        '────────────────────────────\n' +
        '- Si la imagen contiene un diagrama relevante: devuelve **SOLO** el JSON válido, sin texto adicional.\n' +
        '- Si no contiene un diagrama relevante: devuelve exactamente el mensaje indicado.\n' +
        '- NO incluyas explicaciones, texto extra ni bloques de código markdown.\n\n' +
        '────────────────────────────\n' +
        '🧱 ESTRUCTURA DEL JSON\n' +
        '────────────────────────────\n' +
        'El JSON debe tener esta estructura:\n' +
        '{ "class": "GraphLinksModel", "nodeDataArray": [...], "linkDataArray": [...] }\n\n' +
        'Cada clase en "nodeDataArray" debe tener:\n' +
        '- key: número entero negativo único (-1, -2, -3, ...)\n' +
        '- name: nombre de la clase, con primera letra MAYÚSCULA y el resto minúscula (ejemplo: "Persona")\n' +
        '- attribute: lista de atributos en minúscula, con tipo, separados por saltos de línea. Ejemplo: "nombre: string\\nedad: int"\n' +
        '- methods: lista de métodos en minúscula, con tipo, separados por saltos de línea. Ejemplo: "getnombre(): string\\nsetedad(): void"\n' +
        '- loc: posición estimada en formato "x y"\n' +
        '- nodeType: siempre "standard"\n\n' +
        'IMPORTANTE:\n' +
        '- NO usar símbolos (+, -, #) en atributos o métodos.\n' +
        '- Todos los nombres de atributos y métodos deben estar en minúscula.\n\n' +
        '────────────────────────────\n' +
        '🔗 ESTRUCTURA DE linkDataArray\n' +
        '────────────────────────────\n' +
        'Cada relación debe tener:\n' +
        '- from: key de la clase origen\n' +
        '- to: key de la clase destino\n' +
        '- category: tipo de relación ("asociacion", "agregacion", "composicion", "generalizacion", "muchos-a-muchos")\n' +
        '- fromMultiplicity: "1" o "*"\n' +
        '- toMultiplicity: "1" o "*"\n\n' +
        // '────────────────────────────\n' +
        // '⚙️ REGLAS DE MULTIPLICIDAD\n' +
        // '────────────────────────────\n' +
        // '1. Siempre usa SOLO "1" y "*", sin otros valores.\n' +
        // '2. La dirección de la relación debe reflejar la dependencia o la clave foránea (por ejemplo, si una clase contiene a otra, la clase contenedora tiene "1" y la contenida "*").\n' +
        // '3. No mezcles otros símbolos ni valores de multiplicidad.\n\n' +
        '────────────────────────────\n' +
        '📄 EJEMPLO DE SALIDA CORRECTA\n' +
        '────────────────────────────\n' +
        '{ "class": "GraphLinksModel",\n' +
        '  "nodeDataArray": [\n' +
        '    {"key":-1,"name":"Persona","attribute":"nombre: string\\nemail: string","methods":"metodo1(): tipo","loc":"-293.5 -168","nodeType":"standard"},\n' +
        '    {"key":-2,"name":"Edificio","attribute":"nombre: string\\ndireccion: string","methods":"metodo1(): tipo\\nmetodo2(): tipo","loc":"132.5 -169","nodeType":"standard"},\n' +
        '    {"key":-3,"name":"Aula","attribute":"numero: int","methods":"metodo1(): tipo","loc":"139.5 94","nodeType":"standard"},\n' +
        '    {"key":-4,"name":"Curso","attribute":"atributo1: tipo\\natributo2: tipo","methods":"metodo1(): tipo\\nmetodo2(): tipo","loc":"-510.5 -166","nodeType":"standard"},\n' +
        '    {"key":-5,"name":"Profesor","attribute":"atributo1: tipo\\natributo2: tipo","methods":"metodo1(): tipo\\nmetodo2(): tipo","loc":"-111.5 -90","nodeType":"standard"},\n' +
        '    {"key":-78516,"name":"CursoProfesor","attributes":"-","loc":"-272 -341","nodeType":"intermediate"}\n' +
        '  ],\n' +
        '  "linkDataArray": [\n' +
        '    {"from":-3,"to":-2,"fromMultiplicity":"*","toMultiplicity":"1","category":"composicion"},\n' +
        '    {"from":-1,"to":-2,"fromMultiplicity":"1","toMultiplicity":"*","category":"asociacion"},\n' +
        '    {"from":-4,"to":-78516,"fromMultiplicity":"*","toMultiplicity":"1","category":"muchos-a-muchos"},\n' +
        '    {"from":-5,"to":-78516,"fromMultiplicity":"*","toMultiplicity":"1","category":"muchos-a-muchos"}\n' +
        '  ]\n' +
        '}\n' +
        '\n' +
        'NO OLVIDES: las reglas de nomenclatura (clases con Mayúscula inicial, atributos y métodos en minúscula)';

      const userMessage = additionalContext
        ? `Analiza esta imagen buscando diagramas o estructuras. Contexto adicional: ${additionalContext}`
        : 'Analiza esta imagen y devuelve el JSON siguiendo estrictamente todas las reglas establecidas.';

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o', // Necesitamos GPT-4 Vision para análisis de imágenes
        messages: [
          {
            role: 'system',
            content: systemMessage,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: userMessage,
              },
              {
                type: 'image_url',
                image_url: {
                  url: dataUrl,
                },
              },
            ],
          },
        ],
        temperature: 0, // Más determinístico para análisis técnico
        max_tokens: 4000,
        seed: 1234,
      });

      const answer = completion.choices[0]?.message?.content;

      if (!answer) {
        throw new BadRequestException(
          'No se pudo obtener una respuesta de OpenAI Vision',
        );
      }

      return {
        imageAnalysis: answer,
        model: completion.model,
        usage: {
          promptTokens: completion.usage?.prompt_tokens,
          completionTokens: completion.usage?.completion_tokens,
          totalTokens: completion.usage?.total_tokens,
        },
      };
    } catch (error) {
      if (error.response?.status === 401) {
        throw new BadRequestException('API key de OpenAI inválida');
      }
      if (error.response?.status === 429) {
        throw new BadRequestException(
          'Límite de solicitudes excedido. Intenta más tarde.',
        );
      }
      if (
        error.response?.status === 400 &&
        error.response?.data?.error?.message?.includes('image')
      ) {
        throw new BadRequestException(
          'Formato de imagen no válido o imagen demasiado grande',
        );
      }
      throw new BadRequestException(
        `Error al analizar la imagen: ${error.message}`,
      );
    }
  }

  async fixMultiplicity(gojsDiagram: any) {
    try {
      // Validar que el JSON tenga la estructura correcta
      if (!gojsDiagram.nodeDataArray || !gojsDiagram.linkDataArray) {
        throw new BadRequestException(
          'El JSON debe contener nodeDataArray y linkDataArray',
        );
      }

      // Contexto especializado para corregir multiplicidades en diagramas GoJS
      const systemMessage =
        'Eres un experto en diagramas UML y relaciones entre entidades. Tu tarea es corregir ÚNICAMENTE las multiplicidades (fromMultiplicity y toMultiplicity) de un diagrama GoJS siguiendo la lógica UML correcta.\n\n' +
        '**REGLAS PARA CORREGIR MULTIPLICIDADES:**\n\n' +
        '1. **SOLO usa "1" o "*" para las multiplicidades** (nunca 0..1, 1..*, etc.)\n\n' +
        '2. **Composición** (rombo negro - "es parte de"):\n' +
        '   - Las partes pertenecen al todo\n' +
        '   - Ejemplo: Habitacion es parte de Edificio\n' +
        '   - Regla: from=Habitacion, to=Edificio, fromMultiplicity="*", toMultiplicity="1"\n' +
        '   - La llave foránea va en la parte (Habitacion)\n\n' +
        '3. **Agregación** (rombo blanco - "tiene/contiene"):\n' +
        '   - El todo tiene partes, pero pueden existir independientemente\n' +
        '   - Ejemplo: Departamento tiene Empleados\n' +
        '   - Regla: from=Empleado, to=Departamento, fromMultiplicity="*", toMultiplicity="1"\n\n' +
        '4. **Generalización/Herencia** (flecha vacía):\n' +
        '   - Siempre 1:1 entre hijo y padre\n' +
        '   - Ejemplo: Perro hereda de Animal\n' +
        '   - Regla: from=Perro, to=Animal, fromMultiplicity="*", toMultiplicity="1"\n\n' +
        '5. **Asociación** (línea simple):\n' +
        '   - Analiza el contexto y nombres de clases para determinar la relación\n' +
        '   - Ejemplos:\n' +
        '     • Cliente-Pedido: 1 Cliente puede tener * Pedidos → from=Pedido, to=Cliente, "*" a "1"\n' +
        '     • Usuario-Rol: * Usuarios pueden tener * Roles → from y to depende del contexto\n' +
        '     • Persona-Pasaporte: 1 Persona tiene 1 Pasaporte → "1" a "1"\n\n' +
        '6. **Si la category es de tipo muchos-a-muchos, pon en el nodo intermedio de 1 a *, por ejemplo:\n**' +
        'User y Role la tabla intermedia UserRole tiene dos relaciones de asociacion de 1 a * cada una.\n\n' +
        '**LÓGICA DE ANÁLISIS:**\n' +
        'Usa el SENTIDO COMÚN basado en los nombres de las clases:\n' +
        '- Si una entidad "contiene" o "posee" otra: 1 a *\n' +
        '- Si una entidad "pertenece a" otra: * a 1\n' +
        '- Si es herencia: * a 1 (hijos a padre)\n' +
        '- Si es una relación de uso/referencia: analiza el contexto\n\n' +
        '**EJEMPLOS DE CORRECCIÓN:**\n' +
        'Edificio-Habitacion (composición): Habitacion pertenece a Edificio\n' +
        '→ from=Habitacion, to=Edificio, fromMultiplicity="*", toMultiplicity="1"\n\n' +
        'Cliente-Pedido (asociación): Cliente hace Pedidos\n' +
        '→ from=Pedido, to=Cliente, fromMultiplicity="*", toMultiplicity="1"\n\n' +
        'Perro-Animal (herencia): Perro es un Animal\n' +
        '→ from=Perro, to=Animal, fromMultiplicity="*", toMultiplicity="1"\n\n' +
        '**FORMATO DE RESPUESTA:**\n' +
        'Devuelve ÚNICAMENTE el JSON corregido, manteniendo TODA la estructura original pero con las multiplicidades corregidas.\n' +
        'NO cambies: keys, names, attributes, methods, locations, categories.\n' +
        'SOLO corrige: fromMultiplicity y toMultiplicity en linkDataArray.\n' +
        '⚠️ CRÍTICO: NO incluyas explicaciones, texto adicional, ni bloques de código markdown (```json).\n' +
        '⚠️ CRÍTICO: Responde SOLO con el JSON puro, sin formateo markdown.\n' +
        '⚠️ CRÍTICO: El primer carácter de tu respuesta debe ser "{" y el último "}".';

      const userMessage = `Corrige las multiplicidades de este diagrama GoJS siguiendo la lógica UML. Mantén toda la estructura original, solo cambia fromMultiplicity y toMultiplicity:\n\n${JSON.stringify(gojsDiagram, null, 2)}`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemMessage,
          },
          {
            role: 'user',
            content: userMessage,
          },
        ],
        temperature: 0.1, // Muy determinístico para correcciones técnicas
        max_tokens: 4000,
      });

      let correctedDiagram = completion.choices[0]?.message?.content;

      if (!correctedDiagram) {
        throw new BadRequestException('No se pudo corregir el diagrama');
      }

      // Limpiar cualquier bloque de código markdown que pueda aparecer
      correctedDiagram = correctedDiagram
        .replace(/^```json\s*/, '') // Remover ```json al inicio
        .replace(/^```\s*/, '') // Remover ``` al inicio
        .replace(/\s*```$/, '') // Remover ``` al final
        .trim(); // Remover espacios en blanco

      return {
        originalDiagram: gojsDiagram,
        correctedDiagram: correctedDiagram, // String JSON limpio (sin markdown)
        model: completion.model,
        usage: {
          promptTokens: completion.usage?.prompt_tokens,
          completionTokens: completion.usage?.completion_tokens,
          totalTokens: completion.usage?.total_tokens,
        },
      };
    } catch (error) {
      if (error.response?.status === 401) {
        throw new BadRequestException('API key de OpenAI inválida');
      }
      if (error.response?.status === 429) {
        throw new BadRequestException(
          'Límite de solicitudes excedido. Intenta más tarde.',
        );
      }
      throw new BadRequestException(
        `Error al corregir multiplicidades: ${error.message}`,
      );
    }
  }

  private analyzeChanges(original: any, corrected: any) {
    const changes: any[] = [];

    if (!original.linkDataArray || !corrected.linkDataArray) {
      return changes;
    }

    for (
      let i = 0;
      i < original.linkDataArray.length && i < corrected.linkDataArray.length;
      i++
    ) {
      const originalLink = original.linkDataArray[i];
      const correctedLink = corrected.linkDataArray[i];

      if (
        originalLink.fromMultiplicity !== correctedLink.fromMultiplicity ||
        originalLink.toMultiplicity !== correctedLink.toMultiplicity
      ) {
        // Buscar nombres de las entidades involucradas
        const fromEntity = original.nodeDataArray.find(
          (node) => node.key === originalLink.from,
        );
        const toEntity = original.nodeDataArray.find(
          (node) => node.key === originalLink.to,
        );

        changes.push({
          relationship: `${fromEntity?.name || 'Unknown'} → ${toEntity?.name || 'Unknown'}`,
          category: originalLink.category,
          from: {
            original: originalLink.fromMultiplicity,
            corrected: correctedLink.fromMultiplicity,
          },
          to: {
            original: originalLink.toMultiplicity,
            corrected: correctedLink.toMultiplicity,
          },
        });
      }
    }

    
    return changes;
  }

  async validateAndCorrectDiagram(gojsDiagram: any) {
    try {
      // Validar que el JSON tenga la estructura correcta
      if (!gojsDiagram.nodeDataArray || !gojsDiagram.linkDataArray) {
        throw new BadRequestException('El JSON debe contener nodeDataArray y linkDataArray');
      }

      // Contexto especializado para validar y corregir diagramas GoJS
      const systemMessage = 
        'Eres un experto en diagramas UML y modelado de bases de datos. Tu tarea es analizar un diagrama GoJS y determinar si está correctamente construido o si requiere correcciones.\n\n' +
        
        '**CRITERIOS DE VALIDACIÓN:**\n\n' +
        
        '1. **LÓGICA DE RELACIONES:**\n' +
        '   - Verificar que las multiplicidades tengan sentido lógico\n' +
        '   - Ejemplo INCORRECTO: "Post pertenece a muchos Users" → debe ser "User tiene muchos Posts"\n' +
        '   - Ejemplo CORRECTO: User (1) → Posts (*), Cliente (1) → Pedidos (*)\n\n' +
        
        '2. **CONSISTENCIA DE MULTIPLICIDADES:**\n' +
        '   - Solo usar "1" o "*" (nunca 0..1, 1..*, etc.)\n' +
        '   - Composición: parte (*) → todo (1)\n' +
        '   - Agregación: elementos (*) → contenedor (1)\n' +
        '   - Herencia: hijos (*) → padre (1)\n\n' +
        
        '3. **ERRORES ORTOGRÁFICOS:**\n' +
        '   - Nombres de clases con primera letra mayúscula\n' +
        '   - Atributos en minúscula\n' +
        '   - Corregir errores de escritura en nombres\n' +
        '   - Nombres en singular para clases (User, Post, no Users, Posts)\n\n' +
        
        '4. **ESTRUCTURA GOJS VÁLIDA:**\n' +
        '   - Verificar keys únicos y negativos\n' +
        '   - Coordenadas válidas en "loc"\n' +
        '   - Referencias correctas en from/to de linkDataArray\n\n' +
        
        '5. **CONVENCIONES UML:**\n' +
        '   - Atributos con tipo especificado (nombre: String, edad: int)\n' +
        '   - Métodos con tipo de retorno (getName(): String)\n' +
        '   - Relaciones semánticamente correctas\n\n' +
        
        '**EJEMPLOS DE CORRECCIONES:**\n\n' +
        
        'INCORRECTO:\n' +
        '```\n' +
        'User → Post (1 a *) donde "Post pertenece a muchos Users"\n' +
        '```\n' +
        'CORRECTO:\n' +
        '```\n' +
        'User → Post (1 a *) donde "User tiene muchos Posts"\n' +
        '```\n\n' +
        
        'INCORRECTO:\n' +
        '```\n' +
        'name: "users" (plural y minúscula)\n' +
        'attribute: "Nombre: string" (mayúscula en atributo)\n' +
        '```\n' +
        'CORRECTO:\n' +
        '```\n' +
        'name: "User" (singular y mayúscula)\n' +
        'attribute: "nombre: string" (minúscula en atributo)\n' +
        '```\n\n' +
        
        '**FORMATO DE RESPUESTA:**\n' +
        'Debes responder ÚNICAMENTE con un JSON que tenga esta estructura EXACTA:\n' +
        '```json\n' +
        '{\n' +
        '  "perfect": "yes|no",\n' +
        '  "diagram": "AQUÍ_EL_JSON_GOJS_CORREGIDO_O_ORIGINAL"\n' +
        '}\n' +
        '```\n\n' +
        
        '**REGLAS CRÍTICAS:**\n' +
        '- Si el diagrama está perfecto: "perfect": "yes" y "diagram" con el mismo JSON recibido\n' +
        '- Si requiere correcciones: "perfect": "no" y "diagram" con el JSON corregido\n' +
        '- NO incluir explicaciones, texto adicional, ni bloques de código markdown\n' +
        '- El JSON debe ser válido y parseable\n' +
        '- Mantener toda la estructura original, solo corregir lo que esté mal\n\n' +
        
        '**ANÁLISIS PASO A PASO:**\n' +
        '1. Revisar lógica de relaciones (¿tiene sentido semántico?)\n' +
        '2. Verificar multiplicidades (¿están correctas?)\n' +
        '3. Corregir ortografía y nomenclatura\n' +
        '4. Validar estructura GoJS\n' +
        '5. Determinar si es "perfect": "yes" o "no"';

      const userMessage = `Analiza este diagrama GoJS y determina si está correctamente construido. Si encuentras errores de lógica, multiplicidades, ortografía o estructura, corrígelos:\n\n${JSON.stringify(gojsDiagram, null, 2)}`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemMessage,
          },
          {
            role: 'user',
            content: userMessage,
          },
        ],
        temperature: 0.1, // Muy determinístico para validaciones
        max_tokens: 4000,
      });

      let response = completion.choices[0]?.message?.content;

      if (!response) {
        throw new BadRequestException('No se pudo validar el diagrama');
      }

      // Limpiar cualquier bloque de código markdown que pueda aparecer
      response = response
        .replace(/^```json\s*/, '') // Remover ```json al inicio
        .replace(/^```\s*/, '')     // Remover ``` al inicio
        .replace(/\s*```$/, '')     // Remover ``` al final
        .trim();                    // Remover espacios en blanco

      // Intentar parsear el JSON de respuesta
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(response);
      } catch (parseError) {
        throw new BadRequestException('La respuesta de la IA no es un JSON válido');
      }

      // Validar que tenga la estructura esperada
      if (!parsedResponse.perfect || !parsedResponse.diagram) {
        throw new BadRequestException('La respuesta no tiene la estructura esperada (perfect, diagram)');
      }

      // Si el diagram es un string, parsearlo; si es objeto, dejarlo así
      let diagramData;
      if (typeof parsedResponse.diagram === 'string') {
        try {
          diagramData = JSON.parse(parsedResponse.diagram);
        } catch {
          throw new BadRequestException('El diagrama corregido no es un JSON válido');
        }
      } else {
        diagramData = parsedResponse.diagram;
      }

      // Validar que mantenga la estructura GoJS básica
      if (!diagramData.nodeDataArray || !diagramData.linkDataArray) {
        throw new BadRequestException('El diagrama corregido no mantiene la estructura GoJS correcta');
      }

      return {
        perfect: parsedResponse.perfect,
        diagram: JSON.stringify(diagramData), // Siempre devolver como string JSON
        originalDiagram: gojsDiagram,
        correctedDiagram: diagramData, // Para análisis interno
        model: completion.model,
        usage: {
          promptTokens: completion.usage?.prompt_tokens,
          completionTokens: completion.usage?.completion_tokens,
          totalTokens: completion.usage?.total_tokens,
        },
      };
    } catch (error) {
      if (error.response?.status === 401) {
        throw new BadRequestException('API key de OpenAI inválida');
      }
      if (error.response?.status === 429) {
        throw new BadRequestException('Límite de solicitudes excedido. Intenta más tarde.');
      }
      throw new BadRequestException(`Error al validar el diagrama: ${error.message}`);
    }
  }

  async generateOutfit(generateOutfitDto: GenerateOutfitDto) {
    const { userId, event, weather } = generateOutfitDto;

    // 1. Obtener usuario con sus atributos
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userAttributes: true,
        closets: {
          include: {
            garments: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // 2. Obtener todos los garments del usuario
    const allGarments = user.closets.flatMap((closet) => closet.garments);

    if (allGarments.length === 0) {
      throw new BadRequestException('El usuario no tiene prendas en su closet');
    }

    // 3. Filtrar solo prendas con descripción (ya analizadas por IA)
    const garmentsWithDescription = allGarments.filter((g) => g.description);

    if (garmentsWithDescription.length === 0) {
      throw new BadRequestException(
        'Las prendas no tienen descripción. Por favor, vuelve a subir las prendas para que sean analizadas por la IA.',
      );
    }

    // 4. Obtener atributos del usuario
    const userAttr = user.userAttributes[0];

    const userDescription = userAttr
      ? `
        - Género: ${userAttr.gender || 'No especificado'}
        - Edad: ${userAttr.age || 'No especificada'}
        - Estatura: ${userAttr.stature ? userAttr.stature + ' cm' : 'No especificada'}
        - Peso: ${userAttr.weight ? userAttr.weight + ' kg' : 'No especificado'}
        - Profesión: ${userAttr.profession || 'No especificada'}
        - Tono de piel: ${userAttr.testType || 'No especificado'}
        - Tipo de rostro: ${userAttr.faceType || 'No especificado'}
      `
      : 'Sin atributos especificados';

    // 5. Construir la lista de prendas con sus descripciones y categorías
    const garmentsList = garmentsWithDescription
      .map((g, index) => `[${index}] ID: ${g.id} | Categoría: ${g.category || 'SIN_CATEGORIA'}\n    Descripción: ${g.description}`)
      .join('\n\n');

    // 6. Construir el prompt para OpenAI (solo texto, sin imágenes)
    const systemPrompt = `Eres un experto estilista de moda personal. Tu tarea es seleccionar un outfit completo y coherente para una persona basándote en las DESCRIPCIONES y CATEGORÍAS de las prendas disponibles.

CONTEXTO DEL USUARIO:
${userDescription}

EVENTO: ${event}
CLIMA: ${weather}

CATEGORÍAS DE PRENDAS:
- TOP: Prenda superior principal (camiseta, camisa, blusa, polo)
- OUTERWEAR: Capa exterior (chaqueta, abrigo, suéter, cardigan, chaleco)
- BOTTOM: Prenda inferior (pantalón, short, falda, jeans, bermuda)
- DRESS: Prenda de cuerpo completo (vestido, mono, jumpsuit)
- FOOTWEAR: Calzado (zapatos, tenis, botas, sandalias)
- ACCESSORY: Accesorios (gorra, bolso, cinturón, bufanda)

PRENDAS DISPONIBLES:
${garmentsList}

INSTRUCCIONES:
1. Analiza TODAS las prendas con sus categorías y descripciones
2. Selecciona un outfit coherente para el evento y clima indicados
3. Considera los atributos físicos del usuario
4. Ordena las prendas de ARRIBA hacia ABAJO

FORMATO DE RESPUESTA (JSON estricto):
{
  "outfit": {
    "name": "Nombre descriptivo del outfit",
    "description": "Descripción breve de por qué este outfit es apropiado",
    "garments": [
      {
        "id": "ID_DE_LA_PRENDA",
        "order": 1
      }
    ]
  }
}

REGLAS CRÍTICAS DE CATEGORÍAS:
- Máximo 1 prenda TOP (parte superior principal)
- Máximo 1 prenda OUTERWEAR (capa exterior, OPCIONAL, puede combinarse con TOP)
- Máximo 1 prenda BOTTOM (parte inferior)
- Máximo 1 prenda DRESS (si eliges DRESS, NO incluyas TOP ni BOTTOM)
- Máximo 1 prenda FOOTWEAR (calzado)
- Puedes incluir varios ACCESSORY si es apropiado

OTRAS REGLAS:
- Solo incluye prendas que EXISTAN en la lista (usa los IDs exactos)
- Responde SOLO con el JSON, sin texto adicional
- El orden: accesorios de cabeza (1), TOP/OUTERWEAR (2-3), BOTTOM/DRESS (4), FOOTWEAR (5), otros accesorios (6+)`;

    try {
      // 7. Llamar a OpenAI solo con texto (sin imágenes)
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: 'Genera un outfit apropiado basándote en las descripciones de las prendas.',
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const responseText = completion.choices[0]?.message?.content;

      if (!responseText) {
        throw new BadRequestException('No se pudo obtener una respuesta de OpenAI');
      }

      // 8. Parsear la respuesta JSON
      const cleanedResponse = responseText
        .replace(/^```json\s*/, '')
        .replace(/^```\s*/, '')
        .replace(/\s*```$/, '')
        .trim();

      let outfitData;
      try {
        outfitData = JSON.parse(cleanedResponse);
      } catch {
        throw new BadRequestException('La respuesta de OpenAI no es un JSON válido');
      }

      // 9. Validar que los garment IDs existan
      const garmentMap = new Map(garmentsWithDescription.map((g) => [g.id, g]));
      const selectedGarments = outfitData.outfit.garments.filter((g: any) =>
        garmentMap.has(g.id),
      );

      if (selectedGarments.length === 0) {
        throw new BadRequestException('OpenAI no seleccionó prendas válidas');
      }

      // 10. Validar y filtrar por categorías (evitar duplicados)
      const categoryCount: Record<string, number> = {};
      const filteredGarments: any[] = [];

      for (const garment of selectedGarments) {
        const dbGarment = garmentMap.get(garment.id);
        const category = dbGarment?.category || 'ACCESSORY';

        // ACCESSORY puede tener múltiples, las demás solo 1
        if (category === 'ACCESSORY') {
          filteredGarments.push(garment);
        } else {
          if (!categoryCount[category]) {
            categoryCount[category] = 0;
          }
          // Solo permitir 1 prenda por categoría (excepto ACCESSORY)
          if (categoryCount[category] < 1) {
            categoryCount[category]++;
            filteredGarments.push(garment);
          }
        }
      }

      // Validación adicional: si hay DRESS, remover TOP y BOTTOM
      const hasDress = filteredGarments.some((g) => {
        const dbGarment = garmentMap.get(g.id);
        return dbGarment?.category === 'DRESS';
      });

      const finalGarments = hasDress
        ? filteredGarments.filter((g) => {
            const dbGarment = garmentMap.get(g.id);
            return dbGarment?.category !== 'TOP' && dbGarment?.category !== 'BOTTOM';
          })
        : filteredGarments;

      if (finalGarments.length === 0) {
        throw new BadRequestException('No se pudo generar un outfit válido');
      }

      // 11. Crear el Outfit en la base de datos
      const newOutfit = await this.prisma.outfit.create({
        data: {
          name: outfitData.outfit.name,
          description: outfitData.outfit.description,
          garmentOutfits: {
            create: finalGarments.map((g: any, index: number) => ({
              garmentId: g.id,
              order: g.order || index + 1,
            })),
          },
        },
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
      });

      return {
        success: true,
        outfit: newOutfit,
        aiSuggestion: outfitData.outfit,
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      if (error.response?.status === 401) {
        throw new BadRequestException('API key de OpenAI inválida');
      }
      if (error.response?.status === 429) {
        throw new BadRequestException('Límite de solicitudes excedido. Intenta más tarde.');
      }
      throw new BadRequestException(`Error al generar outfit: ${error.message}`);
    }
  }
}