"""Model uchun rasm transformatsiyalari — o'qitish (augmentatsiya bilan)
va xulosa chiqarish (aug'siz) uchun alohida."""
from torchvision import transforms as T

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


def train_transform(image_size: int) -> T.Compose:
    # MUHIM: birinchi urinishlarda rotation+ColorJitter bilan model 5-20 epoch
    # davomida umuman o'rganmadi (kichik, 395 rasmlik datasetda signal juda
    # zaiflashib ketgan edi). Kaltsifikatsiyalar kabi mayda, nozik topilmalar
    # aylantirish/rezempling bilan osongina yo'qoladi. Endi faqat xavfsiz,
    # label-invariant flip'lar qoldirildi.
    return T.Compose([
        T.Resize((image_size, image_size)),
        T.RandomHorizontalFlip(p=0.5),
        T.RandomVerticalFlip(p=0.5),
        T.ToTensor(),
        T.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])


def inference_transform(image_size: int) -> T.Compose:
    return T.Compose([
        T.Resize((image_size, image_size)),
        T.ToTensor(),
        T.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])
