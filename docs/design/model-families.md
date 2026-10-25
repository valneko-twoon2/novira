---
covers:
  - backend/crates/novira-core/src/comfy/split.rs
  - backend/crates/novira-core/src/comfy/split/**
  - backend/crates/novira-core/src/comfy/video_families.rs
  - backend/crates/novira-core/src/comfy/video_families/**
  - backend/crates/novira-core/src/comfy/variants.rs
---
# Model families

The image models of the newer families (Anima, Flux, FLUX.2, Chroma, Qwen-Image, Z-Image, SD3, HiDream, AuraFlow, HunyuanImage) that ComfyUI loads in parts: how the picture graph of generation.md loads them, which files they need, and how the worker finds those files. The same machinery runs the video models the user installed (Wan, HunyuanVideo, HunyuanVideo 1.5, LTX-Video, LTX-2) on the Video screen.

## Behaviour

- Anima, Flux, Chroma, Qwen-Image, Z-Image, SD3, HiDream and AuraFlow use this same graph. A diffusion model (kind `diffusion_model`) loads with `UNETLoader`; a checkpoint of these families loads with `CheckpointLoaderSimple`, and the worker reads its header (`classify::bundled_parts`) to know whether it carries its text encoders and VAE. The missing encoders load with `CLIPLoader` (type `stable_diffusion` for Anima and AuraFlow, `chroma`, `qwen_image`, `lumina2`), `DualCLIPLoader` (`flux`), `TripleCLIPLoader` (SD3) or `QuadrupleCLIPLoader` (HiDream). After the LoRAs comes the family's flow shift (`ModelSamplingAuraFlow`: Chroma 1, Qwen-Image 3.1, Z-Image 3, AuraFlow 1.73; `ModelSamplingSD3`: HiDream 3). The empty latent is `EmptyLatentImage` for Anima and AuraFlow and `EmptySD3LatentImage` otherwise. The sampler and scheduler are the family's own (euler/simple; Chroma euler/beta; Z-Image res_multistep/simple; SD3 euler/sgm_uniform; HiDream uni_pc/simple; AuraFlow euler/normal), never the user's scheduler, and CLIP skip is ignored. `Family::picture_sampling` names what a picture of each family runs (FLUX.2: euler with `Flux2Scheduler`); the worker records it in the saved picture's metadata as `sampling` (`split::fixed_sampling`: a main or diffusion model of these families, in the modes the picture graph draws), and "use all" then keeps the current scheduler. The frontend's copy (`FAMILY_SAMPLING`, `frontend/src/backend/familySampling.ts`) is the contract fixture `family-sampling.json`, which both sides' contract tests check against their own; the Generate screen shows that pair read-only in place of the scheduler choice, and the recommended values do not count the scheduler for these models. Flux gives the CFG value to `FluxGuidance`, samples at CFG 1 and has a zeroed negative. Masks, control layers, the high-resolution fix, upscaling and drafts work as for the SD family (drafts on `KSamplerAdvanced` with the family's sampler); ControlNets get the VAE, and a control model of kind `model_patch` (folder `model_patches`) loads with `ModelPatchLoader` and changes the model through `AnimaLLLiteApply` (Anima) or `QwenImageDiffsynthControlnet` (Qwen-Image, Z-Image). Reference images are refused. The worker (`split_job`, `split_vae`) picks the encoders and the VAE among the installed models by the words in their file names (`split::pick`), or uses the job's VAE; a missing file fails the job naming what to install. Starter models list each family's files as dependencies.
- Which models count: the Generate tab's model list shows main models and diffusion models whose base has a recipe (`SPLIT_BASES` and `isDrawable` in `frontend/src/state/models.ts`, the same families as `split::Family::of`). The AI assistant's `select_model` takes the same models.
- A picture job with a model of a family without a picture recipe (the video families) is refused by the worker, naming its base.

### GGUF files and variants

- A `.gguf` model or encoder loads with the ComfyUI-GGUF pack's nodes (`UnetLoaderGGUF`, `CLIPLoaderGGUF` and the dual, triple and quadruple forms; `split::unet_loader`, `split::text_encoder`). `validate` names the pack when one of its nodes is missing, and reads the pack's loader nodes for the file list because ComfyUI lists no GGUF file under its folders. A GGUF file has no header to read: family, Wan kind and variant come from its name.
- `classify::detect_variant` tells a variant from tensors (Flux Fill: 384 columns of `img_in.weight`; the Wan extras `vace_patch_embedding`, `control_adapter`, `casual_audio_encoder`, `audio_proj`, `face_adapter`; Fun Control: 48 channels plus `img_emb`) or the name (`kontext`, `edit`, `layered`, GGUF). The worker sets `SplitJob.variant`.
- Flux Fill, Flux Kontext and Qwen-Image-Edit (`comfy/variants.rs`) take the source through `InpaintModelConditioning`, `ReferenceLatent` or `TextEncodeQwenImageEdit[Plus]` (the 2509 and later files, names with `2509`, `2511` or `plus`, use Plus). Fill needs inpaint or outpaint with a mask and a guidance of 30 (the CFG value is not used); Kontext and the Qwen edit models need image to image. They refuse drafts, the high-resolution fix and control layers.
- Wan VACE runs `WanVaceToVideo` (reference picture optional) and `TrimVideoLatent`. Wan 2.1 image to video (a model with `img_emb`) adds `CLIPVisionLoader` and `CLIPVisionEncode` with `clip_vision_h`, found by name; the job fails naming it when it is missing.
- `Variant::Unsupported(reason)` (Flux Canny and Depth, Qwen-Image-Layered, Wan Fun Control, camera, speech-to-video, HuMo, Animate and pose models) makes the graph build fail with `<family>: <reason>`.

### HunyuanImage 2.1

- A diffusion model told from HunyuanVideo by a flat patch: `img_in.proj.weight` has four dimensions (`classify::detect_architecture`). It runs the shared picture graph (`Family::HunyuanImage`): `DualCLIPLoader` `hunyuan_image` (Qwen2.5-VL and ByT5), the `hunyuan_image_2.1_vae`, `EmptyHunyuanImageLatent` (a 32x-compressed latent), `KSampler` euler, simple, at the CFG of the screen. No flow-shift node is added; the model carries its own. The refiner model is not run.

### Hunyuan-DiT

- A Hunyuan-DiT checkpoint carries the model, both text encoders and the VAE, so it is a main model (`checkpoints`) of base `hunyuan-dit` (tensor `mlp_t5`) and draws through the SD picture graph unchanged: `CheckpointLoaderSimple`, `CLIPTextEncode`, `KSampler` with the user's scheduler, `EmptyLatentImage`. LoRAs, ControlNets and the other SD guidance are matched by base, so only ones made for it fit.

### FLUX.2, HunyuanVideo 1.5 and LTX-2

- Told from the older families by their own tensors (`classify::detect_architecture`). FLUX.2 (`comfy/variants.rs`) samples with `SamplerCustomAdvanced`, `Flux2Scheduler` and `EmptyFlux2LatentImage`: dev with `FluxGuidance` and `BasicGuider`, klein with `CFGGuider` and a zeroed negative. The text encoder is Mistral 3 Small (dev) or Qwen3 4B or 8B (klein), chosen by `classify::flux2_context` (`Family::encoders_for`); the VAE is `flux2-vae`. Text to image, or image to image as a reference edit (`ReferenceLatent` on both sides, drawn at the picture's size); masks, control layers and the high-resolution fix are refused. A draft cuts the schedule with `SplitSigmas` at the draft step and decodes the sampler's denoised output. Reference pictures (`referencePictures`, at most 4; a comic panel's characters) are each scaled to about a megapixel (`REFERENCE_MEGAPIXELS`), encoded and chained with `ReferenceLatent` to both sides after the source; the picture keeps the size asked. The worker refuses them for a main model of another base, and the other families and the SD graph refuse them too.
- HunyuanVideo 1.5 (`comfy/video_families.rs`): `DualCLIPLoader` `hunyuan_video_15` (Qwen2.5-VL and ByT5), `ModelSamplingSD3` 7, `CFGGuider`, `BasicScheduler` simple, `EmptyHunyuanVideo15Latent`; image to video (`Variant::Hy15I2v`, from the metadata `model_type` or the name) uses `HunyuanVideo15ImageToVideo` with the SigCLIP vision model. The super-resolution file is refused.
- LTX-2: one checkpoint (video model, VAE and audio VAE) read with `CheckpointLoaderSimple`, `LTXAVTextEncoderLoader` (Gemma 3 12B), video and sound latents joined with `LTXVConcatAVLatent`, `LTXVScheduler`, `CFGGuider`, `euler_ancestral`; the sound is decoded and goes into the clip (`video::finish_with_audio`). Only the first stage of ComfyUI's template runs, without its 2x upscaler.

### Video models

- A video job whose `modelKey` names an installed model of `Family::of_video` (Wan, HunyuanVideo, LTX-Video) runs from `comfy/video_families.rs` and needs no pack; no key, or `video-turbo`, is the pack's model (media-generation.md). The Video screen lists such models (`isVideoModel` in `frontend/src/state/models.ts`) beside its two and sets the family's steps, CFG, frame rate and size (`VIDEO_FAMILY_PRESETS`).
- The worker (`split_job`) finds the text encoders by name as for pictures, and for Wan reads what the model is made for from the channels of the patch embedding (`classify::wan_in_channels`, the one shape kept in `Header::shapes`): 16 text to video, 36 image to video, 48 the 5B model. An unknown count fails the job. A Wan 2.2 high-noise file brings its low-noise partner (the file name with `low_noise`); picking the low-noise file, or a high-noise file without a partner, fails the job saying so.
- Wan text to video: `UNETLoader`, `ModelSamplingSD3` (shift 8), `CLIPLoader` `wan`, `EmptyHunyuanLatentVideo` (sizes to 16, frames 4n+1), `KSampler` (uni_pc, simple). Image to video: `WanImageToVideo` with the start picture instead of the empty latent. A text-to-video model given a picture, and an image model without one, are refused. The 5B model runs the pack's graph (`video::build_ti2v`) with the user's files and the Wan 2.2 VAE. A Wan 2.2 A14B pair: two `UNETLoader` with `ModelSamplingSD3` each and two `KSamplerAdvanced` (the high-noise model to half of the steps, the low-noise one the rest).
- HunyuanVideo (text to video only): `DualCLIPLoader` `hunyuan_video` (CLIP-L and LLaVA-Llama3), `ModelSamplingSD3` (7), `FluxGuidance` from the CFG value, `BasicGuider`, `RandomNoise`, `BasicScheduler`, `SamplerCustomAdvanced` (euler, simple), no negative prompt. Its image-to-video file (33 input channels, `Variant::HyI2v`) reads the picture with the LLaVA vision model (`llava_llama3_vision`) in `TextEncodeHunyuanVideo_ImageToVideo` and `HunyuanImageToVideo` (`v2 (replace)` for a "v2_replace" file, else `v1 (concat)`); a file with another channel count is refused.
- LTX-Video: `CheckpointLoaderSimple` (the VAE is inside, so the file is a main model in `checkpoints`), `CLIPLoader` `ltxv` with a T5-XXL, `LTXVConditioning` (frame rate), `LTXVScheduler`, `SamplerCustom` (euler), `EmptyLTXVLatentVideo` or `LTXVImgToVideo` (sizes to 32, frames 8n+1).
- All end with `video::finish` (decode, MP4, thumbnail). `validate` checks the node that older ComfyUI versions lack (`SplitJob::video_node`), and the dry build sees a source picture only when the job has one.

## Boundaries

| Boundary | Guard |
|---|---|
| Files the graph names | Only installed models: the worker resolves encoders, VAE and control models to the ComfyUI address of an installed model (`ModelConfig.comfy`); file names never come from the window. The header read to find a checkpoint's parts is the safetensors header only (`classify::read_header`, at most 64 MiB), never the weights. |

## Known limits

- Encoders and VAEs are found by the words in their file names; a renamed file is not found, and the job fails naming the file to install.
- The recipes follow ComfyUI's templates; AuraFlow has no template; its sampler (euler, normal) made a clean 1024 px picture with aura_flow_0.3 on a real engine (2026-10-12, by eye). HunyuanImage 2.1 (distilled fp8) and HiDream Fast fp8 were run the same way. Distilled variants (HiDream Dev and Fast, Z-Image Turbo) want CFG 1, which the user sets.
- Reference images (IP-Adapter) are refused for these families.
- Video: the Wan models of the Unsupported variants are not covered. LTX-2 has no second stage. The ComfyUI graphs of HunyuanVideo 1.5 and LTX-2 were checked against ComfyUI's node definitions; a 19B LTX-2 model was not run on the 12 GB card used for checks.
- A Kontext or Qwen edit file renamed without `kontext` or `edit`, and a GGUF file whose name does not carry its family, run as plain models or are not recognised. The GGUF pack must be installed by the user.
