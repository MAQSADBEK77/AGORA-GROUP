import torch
import numpy as np
import cv2
from PIL import Image


def generate_gradcam(model, input_tensor, target_class: int, original_img: Image.Image,
                     save_path: str, device):
    gradients = []
    activations = []

    def save_gradient(grad):
        gradients.append(grad)

    def forward_hook(module, input, output):
        activations.append(output)
        output.register_hook(save_gradient)

    # ResNet50 ning oxirgi conv layeriga hook qo'yamiz
    target_layer = model.layer4[-1]
    hook = target_layer.register_forward_hook(forward_hook)

    model.zero_grad()
    output = model(input_tensor)
    score = output[0, target_class]
    score.backward()

    hook.remove()

    if not gradients or not activations:
        return

    grad = gradients[0].squeeze().cpu().numpy()     # (C, H, W)
    act = activations[0].squeeze().cpu().numpy()    # (C, H, W)

    weights = np.mean(grad, axis=(1, 2))            # (C,)
    cam = np.zeros(act.shape[1:], dtype=np.float32) # (H, W)
    for i, w in enumerate(weights):
        cam += w * act[i]

    cam = np.maximum(cam, 0)
    cam = cam - cam.min()
    if cam.max() > 0:
        cam = cam / cam.max()

    orig_w, orig_h = original_img.size
    cam_resized = cv2.resize(cam, (orig_w, orig_h))
    heatmap = cv2.applyColorMap(np.uint8(255 * cam_resized), cv2.COLORMAP_JET)
    heatmap = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)

    orig_array = np.array(original_img.convert("RGB"))
    overlay = (0.5 * orig_array + 0.5 * heatmap).astype(np.uint8)

    result = Image.fromarray(overlay)
    result.save(save_path)
