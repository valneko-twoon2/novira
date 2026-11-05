# 모델 관리하기·찾기

이미지를 만들려면 그림의 바탕이 되는 '모델'이 필요합니다. novira에는 가지고 있는 모델을 정리하는 **{{ui:app.tabs.models}}** 탭과 인터넷에서 모델을 찾아 다운로드하는 **{{ui:app.tabs.browse}}** 탭이 있습니다.

이 장에서는 두 탭의 사용법과 모델의 종류, 라이선스를 보는 방법을 설명합니다.

## 모델의 종류

모델에는 '{{ui:models.sort.base}}'(어느 계열인가)와 '{{ui:models.sort.type}}'(어떤 역할인가)이 있습니다.

### 베이스(계열)

모델은 계열별로 만들어져 있으며, 다른 계열끼리는 조합할 수 없습니다. 예를 들어 SDXL 모델에 SD1.5용 LoRA는 사용할 수 없습니다.

| 표시 | 내용 |
|---|---|
| SD1.X | Stable Diffusion 1.5 등. 가볍게 동작합니다 |
| SD2.X | Stable Diffusion 2 계열 |
| SDXL | Stable Diffusion XL 계열. 일러스트용 모델 대부분(Illustrious, NoobAI, Pony 등)도 여기에 들어갑니다 |
| SD3.X | Stable Diffusion 3 계열 |
| FLUX | FLUX 계열 |
| Any | 계열을 가리지 않는 것(업스케일러 등) |

> SD1.X, SD2.X, SDXL 외에도 새로운 계열(Anima, Flux, FLUX.2, Chroma, Qwen-Image, Z-Image, SD3, HiDream, AuraFlow, HunyuanImage, Hunyuan-DiT)의 모델로 이미지를 만들 수 있고, Wan, HunyuanVideo, LTX-Video 모델로는 동영상 화면에서 동영상을 만들 수 있습니다. 그 밖의 계열 모델은 목록에는 나오지만 생성하면 실패하고 계열 이름이 표시됩니다. 사용 방법은 '생성' 장에 있습니다.

모델과 LoRA의 베이스가 맞지 않으면 **{{ui:app.tabs.generate}}** 화면의 만들기 버튼을 누를 수 없게 되고 이유가 나옵니다.

### 종류

| 종류 | 역할 |
|---|---|
| {{ui:models.rail.main}}({{ui:models.type.main}}) | 그림을 그리는 본체 |
| {{ui:models.type.lora}} | 본체에 더해서 화풍이나 캐릭터를 추가하는 작은 모델 |
| {{ui:models.type.vae}} | 그림의 색과 세부를 마무리하는 데 쓰는 부품 |
| {{ui:models.type.controlnet}}, {{ui:models.type.modelPatch}} | 포즈나 선화 등 그림의 형태를 지정함(모델 패치는 Anima, Qwen-Image, Z-Image용) |
| {{ui:models.type.ipAdapter}}, {{ui:models.type.clipVision}} | 참조 이미지의 분위기를 생성에 반영함 |
| {{ui:models.rail.upscale}} | 이미지를 크게 만듦 |
| {{ui:models.rail.encoders}} | 문장을 이해하는 부품(T5, Qwen, CLIP 등. Anima나 Flux처럼 본체와는 별도로 필요한 것) |
| {{ui:models.rail.diffusion}} | Flux, Wan, Anima, Qwen-Image처럼 본체만 단독으로 배포되는 모델. 설치할 때 내용을 보고 종류와 계열을 판별합니다 |

동영상, 음악, 음성, 로고용 모델은 이 목록에 나오지 않습니다. 각각의 화면에서 다운로드합니다([동영상·음악·음성·로고](07-media.md)).

## 모델 탭

![모델 탭. 왼쪽에 카테고리, 가운데에 모델 카드가 나열된다](shot:models)

**{{ui:app.tabs.models}}** 탭은 설치된 모델의 목록입니다.

### 찾기

왼쪽의 **{{ui:models.rail.title}}** 항목에서 종류별로 좁힐 수 있습니다. 오른쪽에 개수가 나옵니다.

- **{{ui:models.rail.all}}**: 전부
- **{{ui:models.rail.favorites}}**: 별을 붙인 것
- **{{ui:models.rail.main}}**, **{{ui:models.rail.lora}}**, **{{ui:models.rail.controlnet}}**, **{{ui:models.rail.vae}}**, **{{ui:models.rail.ipAdapter}}**, **{{ui:models.rail.upscale}}**, **{{ui:models.rail.encoders}}**, **{{ui:models.rail.diffusion}}**

위쪽 바에서는 이름으로 좁히기(**{{ui:models.searchPlaceholder}}**), 베이스로 좁히기, **{{ui:models.sort.label}}**({{ui:models.sort.name}}, {{ui:models.sort.size}}, {{ui:models.sort.base}}, {{ui:models.sort.type}}), **{{ui:models.view.grid}}**과 **{{ui:models.view.list}}** 전환, 썸네일 크기 조정을 할 수 있습니다.

카드의 왼쪽 아래에는 베이스(SDXL 등)와 형식 태그가 붙습니다. 라이선스를 알고 있는 모델에는 왼쪽 위에 라이선스 태그([라이선스 표시](#라이선스-표시))도 붙으며, 누르면 카드를 선택하지 않고 그 자리에서 라이선스 내용이 열립니다. 카드가 작을 때는 태그가 표시만 남습니다. 카드에 마우스를 올리면 별(즐겨찾기)과 메뉴가 나옵니다.

화면의 오른쪽 아래에는 모델의 개수와 전체 크기가 나옵니다.

### 모델 추가하기

오른쪽 위에 버튼이 2개 있습니다.

- **{{ui:models.find}}**: **{{ui:app.tabs.browse}}** 탭으로 이동합니다(아래 장 참조).
- **{{ui:models.import}}**: 가지고 있는 파일이나 주소를 아는 모델을 설치합니다.

**{{ui:models.import}}** 버튼을 누르면 **{{ui:models.import.title}}** 화면이 열리고, 4가지 방법 중에서 고를 수 있습니다.

| 탭 | 사용법 |
|---|---|
| {{ui:models.install.tab.source}} | 모델의 주소를 입력하고 **{{ui:models.install.install}}** 버튼을 누릅니다 |
| {{ui:models.install.tab.scan}} | **{{ui:models.install.scan}}** 버튼을 눌러 열리는 대화상자에서 폴더를 선택하면 안에 있는 모델이 나열됩니다. **{{ui:models.install.installAll}}** 버튼으로 한꺼번에 설치할 수 있습니다. PC 안의 파일은 여기에서 설치합니다. 브라우저에서 열었을 때는 사용할 수 없습니다 |
| {{ui:models.install.tab.starter}} | 처음에 설치해 두면 편리한 모델을 앱이 골라서 나열해 둡니다. 의존하는 모델(VAE 등)도 함께 설치됩니다. 동영상, 음악, 음성, 로고, 지우기 기능의 모델 팩도 나열됩니다. 모델 화면과 같이 카드로 나열되며, 왼쪽의 **{{ui:models.starter.purposes}}** 항목(이미지 만들기, 동영상, 업스케일 등)과 위쪽 **{{ui:models.starter.allFamilies}}** 목록(Anima, SDXL 등)으로 좁힐 수 있습니다. 계열을 선택하면 그 계열에 필요한 VAE나 인코더도 함께 나열됩니다 |
| {{ui:models.install.tab.huggingface}} | Hugging Face의 리포지토리 이름(`작성자/이름`)으로 찾는 칸입니다 |

**{{ui:models.install.tab.source}}** 탭의 칸에 입력할 수 있는 것은 다음과 같습니다.

- Civitai 모델 페이지의 주소
- 모델 파일로 바로 연결되는 주소(`https://`로 시작하는 것)
- Hugging Face의 파일(`작성자/이름::파일 이름` 형태)

PC 안의 파일 위치(`C:\models\model.safetensors` 같은 형태)를 입력하면 **{{ui:models.install.tab.scan}}** 탭을 사용하라는 안내가 나옵니다. 거기서 선택한 파일은 앱의 모델 폴더로 가져옵니다(같은 드라이브라면 용량은 거의 늘지 않습니다. 다른 드라이브일 때는 복사됩니다).

> **{{ui:models.install.tab.huggingface}}** 탭은 리포지토리(`작성자/이름`)를 입력하고 **{{ui:models.install.hfLookup}}** 버튼을 누르면 그 리포지토리의 단독 모델 파일(`.safetensors`, `.gguf`, `.ckpt`, `.pt`, `.pth`) 목록을 보여 줍니다. `unet`이나 `vae` 같은 부품 폴더 안의 파일은 나오지 않습니다. Hugging Face 토큰을 등록해 두었다면 그 토큰을 사용해 목록을 가져옵니다.

설치는 순서대로 진행됩니다. 진행 상황은 화면 왼쪽 아래의 **{{ui:models.dock.queue}}** 버튼(작업 중에는 '○건 설치 중')을 누르면 나오는 **{{ui:models.queue.title}}** 화면에서 볼 수 있습니다. 여기서 1건씩 **{{ui:models.queue.cancel}}** 버튼으로 취소할 수도 있고, 끝난 항목은 **{{ui:models.queue.prune}}** 버튼으로 정리할 수 있습니다.

다운로드 도중의 파일은 완료된 뒤에 모델 폴더로 들어갑니다. 도중에 멈춰도 불완전한 파일이 남지 않습니다.

### 모델 상세

![모델을 선택하면 오른쪽에 상세가 나온다. 크기, 위치, 라이선스, 출처 등이 나열된다](shot:models-detail)

카드를 누르면 오른쪽에 상세가 열립니다. 닫을 때는 오른쪽 위의 **{{ui:models.detail.close}}** 버튼을 누릅니다.

상세에는 이름, 베이스와 종류 태그, 설명, **{{ui:models.details.size}}**, **{{ui:models.details.path}}**(복사할 수 있습니다), **{{ui:models.details.license}}**, **{{ui:models.details.source}}**, **{{ui:models.details.page}}**(원래 모델의 주소. 누르면 브라우저에서 열립니다)가 나옵니다.

모델의 그림이 여러 장 있을 때는 그림 좌우의 화살표로 전환할 수 있고, 오른쪽 아래에 몇 번째 장인지 나옵니다(Civitai에서 설치한 모델은 원래 페이지의 그림이 들어갑니다).

위쪽 버튼으로 다음 작업을 할 수 있습니다.

- **{{ui:models.detail.openSource}}**: 원래 모델의 페이지를 브라우저에서 엽니다(페이지를 아는 모델만).
- **{{ui:common.edit}}**: 이름, 설명, 베이스, 종류를 고칩니다. 베이스나 종류가 자동으로 올바르게 판정되지 않았을 때 사용합니다.
- **{{ui:common.delete}}**: 모델을 삭제합니다(아래 참조).

Civitai에서 설치한 모델에 새 버전이 나와 있으면 카드에 **{{ui:models.updates.tag}}** 태그가 붙고, 상세 위쪽에 새 버전의 이름과 날짜가 나옵니다. **{{ui:models.updates.open}}** 버튼을 누르면 새 버전의 페이지가 브라우저에서 열립니다. 새 버전은 모델 탭을 열 때(이전 확인으로부터 하루 이상 지났다면) 자동으로 확인하며, 새로 발견되면 알림으로도 알려 줍니다. 바로 확인하고 싶을 때는 위쪽의 **{{ui:models.updates.check}}** 버튼을 누릅니다. 같은 베이스의 새 버전만 대상이며, 유료 버전은 표시하지 않습니다. 확인할 때 설치한 모델의 Civitai 번호가 Civitai로 전송됩니다.

### 트리거 문구

LoRA 등에는 사용할 때 프롬프트에 넣으면 효과가 있는 말(트리거 문구)이 있습니다. **{{ui:models.triggers.title}}** 항목에 등록해 두면 **{{ui:app.tabs.generate}}** 화면에서 그 LoRA를 선택했을 때 말이 버튼으로 나옵니다. 누르면 프롬프트에 추가됩니다.

입력칸에 말을 넣고 **{{ui:common.add}}** 버튼을 누르면 등록됩니다. ×로 뺄 수 있습니다. 변경 내용은 바로 저장됩니다. Civitai에서 설치한 모델은 배포처가 알려 준 말이 처음부터 들어 있는 경우가 있습니다.

### 기본 설정

본체 모델에는 **{{ui:models.defaults.title}}** 항목이 있습니다. 그 모델을 생성 화면에서 선택했을 때 자동으로 들어가는 값입니다.

- **{{ui:models.defaults.scheduler}}**
- **{{ui:models.defaults.steps}}**
- **{{ui:models.defaults.cfgScale}}**
- 폭과 높이

그 밖에 **{{ui:models.defaults.vae}}**와 **{{ui:models.defaults.vaePrecision}}**도 저장할 수 있습니다. 항목별 스위치를 켠 것만 저장됩니다. **{{ui:common.save}}** 버튼을 눌러 확정합니다.

모델마다 '추천 값'이 다르므로, 자주 쓰는 모델은 한 번 설정해 두면 매번 고치지 않아도 됩니다.

### 삭제

**{{ui:common.delete}}** 버튼을 누르면 확인 창이 나옵니다. **{{ui:models.deleteWarning}}**

다만 novira가 설치한 모델(앱의 데이터 폴더 안에 있는 것)은 파일째 삭제되지만, 직접 준비한 폴더에 있는 모델은 목록에서만 빠지고 파일은 남습니다.

## 라이선스 표시

모델에는 배포처가 정한 이용 조건(라이선스)이 있습니다. novira는 그 요점을 태그로 보여 줍니다.

| 태그 | 의미 |
|---|---|
| {{ui:browse.commercial.allowed}} | 생성 이미지의 판매, 생성 서비스에서의 이용, 모델 자체의 판매가 모두 허용됩니다 |
| {{ui:browse.commercial.limited}} | 상업적 이용 방법의 일부만 허용됩니다(기재가 없는 것이 있을 때도 이 태그입니다) |
| {{ui:browse.commercial.denied}} | 생성 이미지의 판매, 생성 서비스에서의 이용, 모델 자체의 판매 중 어느 것도 허용되지 않습니다 |

태그를 누르면 **{{ui:browse.permission.title}}** 항목이 목록으로 나옵니다. 예를 들어 '{{ui:browse.permission.sellImages}}', '{{ui:browse.permission.sellModel}}', '{{ui:browse.permission.shareMerges}}' 등에 대해 허용, 불허, 기재 없음을 알 수 있습니다.

태그는 Civitai에서는 작성자가 설정한 이용 허가를 기준으로, Hugging Face에서는 라이선스 표시를 기준으로 정합니다. 사이트의 표시를 바탕으로 한 기준일 뿐이므로, 최종적으로는 배포처의 라이선스 본문을 확인하세요. **{{ui:browse.permission.disclaimer}}**

설치한 모델의 라이선스를 알 수 없을 때는 **{{ui:models.details.licenseUnknown}}**이라고 나옵니다.

> 비상업 라이선스의 모델도 있습니다. 예를 들어 동영상의 **{{ui:video.model.fast}}** 모델은 비상업 라이선스입니다. 만든 이미지나 동영상을 업무나 판매에 사용할 때는 사용한 모델의 라이선스를 반드시 확인하세요.

## 탐색 탭

![탐색 탭. 위쪽에 찾는 곳, 종류, 검색칸, 필터가, 아래쪽에 모델 카드가 나열된다](shot:browse)

**{{ui:app.tabs.browse}}** 탭은 인터넷에 있는 모델을 찾아 그대로 다운로드하는 화면입니다.

### 찾는 곳

왼쪽 위의 전환 버튼으로 찾을 곳을 선택합니다.

- **{{ui:browse.source.civitai}}**: 일러스트와 LoRA가 많이 모여 있는 사이트입니다.
- **{{ui:browse.source.huggingface}}**: 연구 기관이나 기업의 모델이 많은 사이트입니다. 이름으로는 찾을 수 없으므로, 화면 가운데의 큰 칸에 모델 페이지의 URL(폴더나 파일 페이지라도 괜찮습니다) 또는 `작성자/이름`을 붙여 넣고 **{{ui:models.install.hfLookup}}** 버튼을 누릅니다. 나온 파일에 체크하고 오른쪽 위의 설치 버튼을 누르면 다운로드가 시작됩니다. 폴더의 URL을 붙여 넣었을 때는 먼저 그 폴더 안의 파일만 나옵니다.

그 옆에서 **{{ui:browse.kind.label}}** 항목을 선택합니다. **{{ui:browse.kind.lora}}**, **{{ui:browse.kind.checkpoint}}**, **{{ui:browse.kind.controlnet}}**, **{{ui:browse.kind.vae}}**, **{{ui:browse.kind.diffusion}}**, **{{ui:browse.kind.all}}**이 있습니다.

### 좁히기

검색칸에는 모델 이름, 작성자, 태그를 넣습니다. 입력하고 잠시 기다리면 결과가 바뀝니다.

오른쪽 메뉴로 좁힐 수 있습니다.

| 항목 | 내용 |
|---|---|
| {{ui:browse.base.label}} | {{ui:browse.base.sdxlCompat}}, {{ui:browse.base.illustrious}}, {{ui:browse.base.noobai}}, {{ui:browse.base.sdxl}}, {{ui:browse.base.pony}}, {{ui:browse.base.sd15}}, {{ui:browse.base.flux}}, {{ui:browse.base.anima}} 등 |
| {{ui:browse.sort.label}} | {{ui:browse.sort.downloads}}, {{ui:browse.sort.rating}}, {{ui:browse.sort.newest}} |
| {{ui:browse.period.label}} | 전체 기간, 1년, 1개월, 1주일, 24시간(Civitai일 때만). 유료 버전에는 카드에 '{{ui:browse.paid.badge}}'라고 나옵니다. 얼리 액세스 중인 것은 무료가 되는 날도 나옵니다. 유료 버전은 구매했더라도 앱에서는 판별할 수 없으므로 설치할 수 없습니다(버튼을 누를 수 없습니다). Civitai 페이지에서 입수하세요 |
| {{ui:browse.nsfw.label}} | 초기값은 꺼짐입니다. 켜면 성인용 모델도 나옵니다 |
| **{{ui:browse.filter.button}}** | 누르면 창이 열리고, 라이선스에서 허용되는 것(생성한 이미지의 판매, 생성 서비스에서의 이용 등. 체크한 것을 모두 허용하는 모델만 나옵니다), 체크포인트의 종류, 요금({{ui:browse.filter.free}}, {{ui:browse.filter.paid}}), safetensors 형식의 파일이 있는 것만, 작성자(이름이 완전히 같은 것)로 좁힐 수 있습니다. 몇 개로 좁혔는지 버튼에 나오며, **{{ui:browse.filter.reset}}** 버튼으로 되돌릴 수 있습니다(Civitai일 때만) |

맨 아래까지 스크롤하면 이어서 불러옵니다. **{{ui:browse.status.loadMore}}** 버튼으로도 불러올 수 있습니다. 가져오지 못했을 때는 **{{ui:browse.status.retry}}** 버튼을 누르세요.

### 카드 보는 법과 다운로드하는 법

카드에는 샘플 이미지, 모델 이름, 작성자, 다운로드 수, 좋아요 수, 라이선스 태그가 나옵니다. LoRA에는 트리거 워드도 나옵니다.

- **{{ui:browse.card.download}}**: 그 모델의 대표 파일을 다운로드합니다.
- 오른쪽 아이콘(**{{ui:browse.card.openCivitai}}**): 배포처 사이트를 브라우저에서 엽니다.

카드를 누르면 오른쪽에서 상세가 열립니다. 버전, 파일 목록(크기와 형식), 트리거 워드, 태그, 설명, 라이선스를 볼 수 있습니다. 버전을 선택하고 다운로드하려는 파일의 **{{ui:browse.card.download}}** 버튼을 누릅니다. 트리거 워드는 누르면 복사할 수 있습니다. 바깥쪽을 누르거나 `Esc`로 닫습니다.

상세의 **{{ui:browse.samples.title}}** 항목에는 그 버전의 작례 중 설정이 공개된 것이 나열됩니다. 그림, 샘플러·스텝 수·CFG·크기, 프롬프트, 사용한 모델과 LoRA(설치하지 않은 것은 점선)를 볼 수 있습니다. **{{ui:browse.samples.use}}** 버튼을 누르면 프롬프트와 설정이 생성 화면에 들어갑니다. 작례에 기록되지 않은 설정은 지금 그대로이고, 모델과 LoRA는 설치해 둔 것만 들어갑니다. 설치하지 않은 것은 알림에 이름이 나옵니다. 설정은 만든 사람이 쓴 것이므로, 없는 작례나 그대로는 같은 그림이 되지 않는 작례도 있습니다.

다운로드를 시작하면 화면 왼쪽 아래에 **{{ui:browse.dock.title}}** 작은 상자가 나와 진행 상황을 볼 수 있습니다. **{{ui:browse.dock.cancel}}** 버튼으로 취소할 수 있고, 끝난 항목은 **{{ui:browse.dock.clear}}** 버튼으로 지울 수 있습니다. 다운로드가 끝난 카드는 **{{ui:browse.card.installed}}**(으)로 바뀌고 **{{ui:app.tabs.models}}** 탭의 목록에도 추가됩니다.

> 로그인이 필요한 모델을 다운로드할 때는 **{{ui:settings.title}}** 화면에서 Civitai의 API 키를 등록하세요. Hugging Face에서 접근 신청이 필요한 모델을 사용할 때는 Hugging Face 토큰을 등록합니다. 둘 다 암호화되어 이 PC에 저장되며 화면에는 표시되지 않습니다. 자세한 내용은 [에이전트·설정](09-assistant-settings.md)으로.

> 로컬 모델의 그림과 사용 허락을 Civitai에서 가져오려면 **{{ui:settings.title}}** 화면의 **{{ui:settings.tab.engine}}** 탭에 있는 **{{ui:settings.engine.civitai.label}}** 항목을 켭니다. 모델 파일의 해시를 Civitai로 보내므로 초기값은 꺼짐입니다. 전환은 다음 실행부터 반영됩니다. 꺼 둔 채로 그림이 없는 모델이 있으면 **{{ui:app.tabs.models}}** 탭 위쪽에 주의 문구가 나오고, **{{ui:models.coverHint.open}}** 버튼에서 설정을 열 수 있습니다.

이미지 생성으로 넘어갈 때는 [생성](02-generate.md)으로.
