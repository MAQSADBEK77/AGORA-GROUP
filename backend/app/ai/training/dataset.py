"""Manifest.json'dan o'qiydigan PyTorch Dataset — rasm + ko'krak kesish +
transform'ni bitta joyda birlashtiradi."""
import json
from PIL import Image
from torch.utils.data import Dataset
import numpy as np
import cv2

from ..preprocessing.breast_crop import crop_breast_region


class MammographyDataset(Dataset):
    def __init__(self, manifest_path: str, split: str, transform=None, use_breast_crop: bool = True):
        with open(manifest_path) as f:
            all_entries = json.load(f)
        self.entries = [e for e in all_entries if e["split"] == split]
        self.transform = transform
        self.use_breast_crop = use_breast_crop

    def __len__(self):
        return len(self.entries)

    def __getitem__(self, idx):
        entry = self.entries[idx]
        img_gray = cv2.imread(entry["path"], cv2.IMREAD_GRAYSCALE)
        if img_gray is None:
            raise FileNotFoundError(f"Rasm o'qib bo'lmadi: {entry['path']}")

        if self.use_breast_crop:
            img_gray = crop_breast_region(img_gray)

        img_rgb = cv2.cvtColor(img_gray, cv2.COLOR_GRAY2RGB)
        pil_img = Image.fromarray(img_rgb)

        if self.transform:
            pil_img = self.transform(pil_img)

        label = np.float32(entry["label"])
        return pil_img, label
