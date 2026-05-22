"""
MammoAI - Model trenirovkasi (Google Colab notebook bilan mos)

Dataset papka tuzilmasi:
  data/
    train/
      normal/    ← normal mammografiya rasmlari
      cancer/    ← saraton rasmlari
    val/
      normal/
      cancer/

Ishga tushirish:
  python train.py
  python train.py --epochs 10 --batch_size 32
"""

import argparse
import os
import copy
import torch
import torch.nn as nn
import torch.optim as optim
import torchvision
import torchvision.models as models
from torchvision import transforms, datasets
from torch.utils.data import DataLoader

CLASSES = ["normal", "cancer"]


def train(args):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\n{'='*50}")
    print(f"  MammoAI - ResNet18 Trenirovkasi")
    print(f"  Device  : {device}")
    print(f"  Epochs  : {args.epochs}  |  Batch: {args.batch_size}")
    print(f"  Data    : {args.data_dir}")
    print(f"{'='*50}\n")

    # Notebook dagi transform bilan aynan bir xil
    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5]),
    ])

    train_dataset = datasets.ImageFolder(
        os.path.join(args.data_dir, "train"), transform=transform)
    val_dataset   = datasets.ImageFolder(
        os.path.join(args.data_dir, "val"),   transform=transform)

    train_loader = DataLoader(train_dataset, batch_size=args.batch_size,
                              shuffle=True,  num_workers=0)
    val_loader   = DataLoader(val_dataset,   batch_size=args.batch_size,
                              shuffle=False, num_workers=0)

    print(f"  Klasslar : {train_dataset.classes}")
    print(f"  Train    : {len(train_dataset)} ta rasm")
    print(f"  Val      : {len(val_dataset)} ta rasm\n")

    # Notebook dagi model bilan aynan bir xil: ResNet18, pretrained, fc->2
    model = models.resnet18(pretrained=True)
    model.fc = nn.Linear(model.fc.in_features, 2)
    model.to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=args.lr)

    best_acc     = 0.0
    best_weights = copy.deepcopy(model.state_dict())

    for epoch in range(1, args.epochs + 1):
        # --- Train ---
        model.train()
        running_loss = 0.0
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            running_loss += loss.item()

        avg_loss = running_loss / len(train_loader)

        # --- Val ---
        model.eval()
        correct, total = 0, 0
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                correct += (outputs.argmax(1) == labels).sum().item()
                total   += labels.size(0)

        val_acc = correct / total * 100
        marker  = " ★" if val_acc > best_acc else ""
        print(f"  Epoch {epoch:3d}/{args.epochs} | "
              f"Loss: {avg_loss:.4f} | Val acc: {val_acc:.1f}%{marker}")

        if val_acc > best_acc:
            best_acc     = val_acc
            best_weights = copy.deepcopy(model.state_dict())

    # Saqlash — notebook dagi nom bilan: model_breast.pth
    os.makedirs(args.output_dir, exist_ok=True)
    save_path = os.path.join(args.output_dir, "model_breast.pth")
    torch.save(best_weights, save_path)

    print(f"\n{'='*50}")
    print(f"  Trenirovka tugadi!")
    print(f"  Eng yaxshi val aniqlik : {best_acc:.1f}%")
    print(f"  Model saqlandi         : {save_path}")
    print(f"{'='*50}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data_dir",   default="./data")
    parser.add_argument("--output_dir", default="./model")
    parser.add_argument("--epochs",     type=int,   default=5)
    parser.add_argument("--batch_size", type=int,   default=16)
    parser.add_argument("--lr",         type=float, default=0.001)
    train(parser.parse_args())
