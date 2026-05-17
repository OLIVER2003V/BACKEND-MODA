from datasets import load_dataset
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer
)
import torch
import numpy as np
from sklearn.metrics import accuracy_score, f1_score

print(f"Usando GPU: {torch.cuda.get_device_name(0)}")

# 1. Cargar dataset en español
print("Cargando dataset en español...")
dataset = load_dataset("sepidmnorozy/Spanish_sentiment")

# 2. Modelo base en español
MODEL_NAME = "dccuchile/bert-base-spanish-wwm-cased"
print(f"Cargando modelo {MODEL_NAME}...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME, num_labels=2)

# Fix correcto para BERT/BETO
if tokenizer.pad_token is None:
    tokenizer.pad_token = "[PAD]"
    model.config.pad_token_id = tokenizer.convert_tokens_to_ids("[PAD]")

# 3. Tokenizar
def tokenize(batch):
    return tokenizer(batch["text"], padding="max_length", truncation=True, max_length=128)

print("Tokenizando dataset...")
dataset = dataset.map(tokenize, batched=True)

# 4. Métricas
def compute_metrics(pred):
    labels = pred.label_ids
    preds = np.argmax(pred.predictions, axis=1)
    return {
        "accuracy": accuracy_score(labels, preds),
        "f1": f1_score(labels, preds, average="weighted")
    }

# 5. Configurar entrenamiento
args = TrainingArguments(
    output_dir="./model",
    num_train_epochs=3,
    per_device_train_batch_size=16,
    per_device_eval_batch_size=16,
    eval_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
    logging_steps=50,
    fp16=True,
)

# 6. Entrenar
trainer = Trainer(
    model=model,
    args=args,
    train_dataset=dataset["train"],
    eval_dataset=dataset["validation"],
    compute_metrics=compute_metrics,
)

print("Iniciando entrenamiento...")
trainer.train()

# 7. Guardar modelo
trainer.save_model("./model")
tokenizer.save_pretrained("./model")
print("Modelo guardado en ./model")