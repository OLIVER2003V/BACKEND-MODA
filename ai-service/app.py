from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

app = FastAPI()

# 1. Cargar modelo entrenado 
MODEL_PATH = "./model"
tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
model.eval()

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)
print(f"Modelo cargado en dispositivo: {device}")

# 2. Definir esquema de entrada
class PerfilRequest(BaseModel):
    posts: list[str]

# 3. Función de predicción
def predecir(texto: str):
    inputs = tokenizer(texto, return_tensors="pt", padding="max_length", truncation=True, max_length=128)
    inputs = {k: v.to(device) for k, v in inputs.items()}

    with torch.no_grad():
        outputs = model(**inputs)

    probs = torch.softmax(outputs.logits, dim=1).squeeze().tolist()
    label = "positivo" if probs[1] > probs[0] else "negativo"

    return {
        "texto": texto,
        "sentimiento": label,
        "probabilidades": {
            "negativo": round(probs[0], 3),
            "positivo": round(probs[1], 3)
        }
    }

# 4. Endpoint de predicción
@app.post("/analizar-perfil")
def analizar_perfil(request: PerfilRequest):
    resultados = [predecir(post) for post in request.posts]

    total = len(resultados)
    positivos = sum(1 for r in resultados if r["sentimiento"] == "positivo")
    negativos = total - positivos

    recomendacion = ""
    porcentaje_positivo = (positivos / total) * 100 

    if porcentaje_positivo >= 70:
        recomendacion = "Tu perfil transmite una imagen muy positiva. Sigue publicando contenido motivador y auténtico."
    elif porcentaje_positivo >= 40:
        recomendacion = "Tu perfil tiene un tono equilibrado. Intenta aumentar contenido positivo para mejorar tu imagen."
    else:
        recomendacion = "Tu perfil tiene un tono mayormente negativo. Te recomendamos publicar contenido más positivo y constructivo."
    
    return {
        "total_posts": total,
        "resumen": {
            "positivos": f"{round(porcentaje_positivo, 1)}%",
            "negativos": f"{round((negativos / total) * 100, 1)}%",
        },
        "recomendacion": recomendacion,
        "detalle": resultados
    }

# 5. Health check
@app.get("/")
def health():
    return {"status": "ok", "mensaje": "Servicio de IA activo"}