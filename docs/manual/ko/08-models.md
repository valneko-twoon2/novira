# 모델 관리하기·찾기

이미지를 만들려면 그림의 바탕이 되는 '모델'이 필요합니다. novira에는 가지고 있는 모델을 정리하는 **{{ui:app.tabs.models}}** 탭과 인터넷에서 모델을 찾아 설치하는 **{{ui:app.tabs.browse}}** 탭이 있습니다.

이 장에서는 두 탭의 사용법과 모델의 종류, 라이선스를 보는 방법을 설명합니다.

## 모델의 종류

모델에는 '{{ui:models.sort.base}}'(어느 계열인지)와 '{{ui:models.sort.type}}'(어떤 역할인지)가 있습니다.

### 베이스(계열)

모델은 계열별로 만들어져 있으며 다른 계열의 것은 조합할 수 없습니다. 예를 들어 SDXL 모델에 SD1.5용 LoRA는 사용할 수 없습니다.

| 표시 | 내용 |
|---|---|
| SD1.X | Stable Diffusion 1.5 등. 가볍게 동작합니다 |
| SD2.X | Stable Diffusion 2 계열 |
| SDXL | Stable Diffusion XL 계열. 많은 일러스트용 모델(Illustrious, NoobAI, Pony 등)도 여기에 들어갑니다 |
| SD3.X | Stable Diffusion 3 계열 |
| FLUX | FLUX 계열 |
| Any | 계열을 가리지 않는 것(업스케일러 등) |

> 현재의 데스크톱 버전에서 이미지 생성에 사용할 수 있는 것은 SD1.X, SD2.X, SDXL 모델입니다. FLUX와 SD3.X는 목록에는 나오지만 이 모델들로 생성을 시작하면 '아직 지원하지 않습니다'라는 뜻의 오류가 됩니다.

모델과 LoRA의 베이스가 맞지 않으면 **{{ui:app.tabs.generate}}** 화면의 생성 버튼을 누를 수 없게 되고 이유가 나옵니다.

### 종류

| 종류 | 역할 |
|---|---|
| {{ui:models.rail.main}}({{ui:models.type.main}}) | 그림을 그리는 본체 |
| {{ui:models.type.lora}} | 본체에 더해서 화풍이나 캐릭터를 추가하는 작은 모델 |
| {{ui:models.type.vae}} | 그림의 색이나 세부의 마무리에 사용하는 부품 |
| {{ui:models.type.controlnet}} | 포즈나 선화 등 그림의 형태를 지정한다 |
| {{ui:models.type.ipAdapter}}, {{ui:models.type.clipVision}} | 참조 이미지의 분위기를 생성에 반영한다 |
| {{ui:models.rail.upscale}} | 이미지를 크게 만든다 |
| {{ui:models.rail.encoders}} | 문장을 이해하는 부품 |
| {{ui:models.rail.diffusion}} | Wan 등 동영상이나 전용 흐름에서 사용하는 모델 |

동영상, 음악, 음성, 로고용 모델은 이 목록에 나오지 않습니다. 각각의 화면에서 다운로드합니다([동영상, 음악, 음성, 로고](07-media.md)).

## 모델 탭

![모델 탭. 왼쪽에 카테고리, 가운데에 모델 카드가 나열되어 있다](shot:models)

**{{ui:app.tabs.models}}** 탭은 설치되어 있는 모델의 목록입니다.

### 찾기

왼쪽의 **{{ui:models.rail.title}}**에서 종류별로 좁힐 수 있습니다. 오른쪽에 건수가 나옵니다.

- **{{ui:models.rail.all}}**: 전부
- **{{ui:models.rail.favorites}}**: 별표를 붙인 것
- **{{ui:models.rail.main}}**, **{{ui:models.rail.lora}}**, **{{ui:models.rail.controlnet}}**, **{{ui:models.rail.vae}}**, **{{ui:models.rail.ipAdapter}}**, **{{ui:models.rail.upscale}}**, **{{ui:models.rail.encoders}}**, **{{ui:models.rail.diffusion}}**

위쪽 바에서는 이름으로 좁히기(**{{ui:models.searchPlaceholder}}**), 베이스로 좁히기, **{{ui:models.sort.label}}**({{ui:models.sort.name}}, {{ui:models.sort.size}}, {{ui:models.sort.base}}, {{ui:models.sort.type}}), **{{ui:models.view.grid}}**와 **{{ui:models.view.list}}**의 전환, 썸네일 크기 조정을 할 수 있습니다.

카드의 왼쪽 아래에는 베이스(SDXL 등)와 형식 표시가 붙습니다. 카드에 마우스를 올리면 별(즐겨찾기)과 메뉴가 나옵니다.

화면의 오른쪽 아래에는 모델의 수와 합계 크기가 나옵니다.

### 모델 추가하기

오른쪽 위에 버튼이 2개 있습니다.

- **{{ui:models.find}}**: **{{ui:app.tabs.browse}}** 탭으로 이동합니다(아래 장을 참조).
- **{{ui:models.import}}**: 가지고 있는 파일이나 주소를 알고 있는 모델을 설치합니다.

**{{ui:models.import}}** 버튼을 누르면 **{{ui:models.import.title}}** 화면이 열리고 4가지 방법 중에서 선택할 수 있습니다.

| 탭 | 사용 방법 |
|---|---|
| {{ui:models.install.tab.source}} | 모델의 주소나 컴퓨터 안의 파일 위치를 입력하고 **{{ui:models.install.install}}** 버튼을 누릅니다 |
| {{ui:models.install.tab.scan}} | 폴더 위치를 입력하고 **{{ui:models.install.scan}}** 버튼을 누르면 안에 있는 모델이 나열됩니다. **{{ui:models.install.installAll}}**로 한꺼번에 설치할 수 있습니다 |
| {{ui:models.install.tab.starter}} | 처음에 설치해 두면 편리한 모델을 앱이 골라서 나열해 둡니다. 의존하는 모델(VAE 등)도 함께 설치됩니다 |
| {{ui:models.install.tab.huggingface}} | Hugging Face의 저장소 이름(`작성자/이름`)으로 찾는 입력란입니다 |

**{{ui:models.install.tab.source}}** 입력란에 넣을 수 있는 것은 다음과 같습니다.

- Civitai의 모델 페이지 주소
- 모델 파일로의 직접 주소(`https://`로 시작하는 것)
- 컴퓨터 안의 파일 위치(`C:\models\model.safetensors` 같은 형태)
- Hugging Face의 파일(`작성자/이름::파일명` 형태)

컴퓨터 안의 파일을 지정하면 앱의 모델 폴더로 가져옵니다(같은 드라이브라면 용량은 거의 늘어나지 않습니다. 다른 드라이브일 때는 복사됩니다).

> 저장소(`작성자/이름`)를 입력하고 **{{ui:models.install.hfLookup}}** 를 누르면, **{{ui:models.install.tab.huggingface}}** 탭에 저장소의 단일 모델 파일(`.safetensors`, `.gguf`, `.ckpt`, `.pt`, `.pth`)이 나옵니다. `unet`, `vae` 같은 diffusers 파이프라인 폴더의 파일은 나오지 않습니다. Hugging Face 토큰을 저장해 두었다면 그 토큰으로 목록을 가져옵니다.

설치 작업은 순서대로 진행됩니다. 진행 상황은 화면 왼쪽 아래의 **{{ui:models.dock.queue}}**(작업 중에는 '○건 설치 중')을 누르면 나오는 **{{ui:models.queue.title}}**에서 볼 수 있습니다. 여기에서 1건씩 **{{ui:models.queue.cancel}}**도 할 수 있고 끝난 것은 **{{ui:models.queue.prune}}**로 정리할 수 있습니다.

다운로드 중인 파일은 완료된 뒤에 모델 폴더로 들어갑니다. 도중에 멈춰도 불완전한 파일은 남지 않습니다.

### 모델의 상세 정보

![모델을 선택하면 오른쪽에 상세 정보가 나온다. 크기, 위치, 라이선스, 출처 등이 나열된다](shot:models-detail)

카드를 누르면 오른쪽에 상세 정보가 열립니다. 닫을 때는 오른쪽 위의 **{{ui:models.detail.close}}** 버튼을 누릅니다.

상세 정보에는 이름, 베이스와 종류 표시, 설명, **{{ui:models.details.size}}**, **{{ui:models.details.path}}**(복사할 수 있습니다), **{{ui:models.details.license}}**, **{{ui:models.details.source}}**가 나옵니다.

위쪽 버튼에서는 다음을 할 수 있습니다.

- **{{ui:models.detail.openSource}}**: 배포처의 페이지를 브라우저에서 엽니다(주소가 있는 모델만).
- **{{ui:common.edit}}**: 이름, 설명, 베이스, 종류를 고칩니다. 베이스나 종류가 자동으로 올바르게 판정되지 않았을 때 사용합니다.
- **{{ui:common.delete}}**: 모델을 삭제합니다(아래를 참조).

### 트리거 문구

LoRA 등에는 사용할 때 프롬프트에 넣으면 효과가 있는 말(트리거 문구)이 있습니다. **{{ui:models.triggers.title}}**에 등록해 두면 **{{ui:app.tabs.generate}}** 화면에서 그 LoRA를 선택했을 때 말이 버튼으로 나옵니다. 누르면 프롬프트에 추가됩니다.

입력란에 말을 입력하고 **{{ui:common.add}}** 버튼을 누르면 등록됩니다. ×로 뺄 수 있습니다. 변경은 바로 저장됩니다. Civitai에서 설치한 모델은 배포처가 제시한 말이 처음부터 들어 있는 경우가 있습니다.

### 기본 설정

본체 모델에는 **{{ui:models.defaults.title}}**이 있습니다. 그 모델을 생성 화면에서 선택했을 때 자동으로 들어가는 값입니다.

- **{{ui:models.defaults.scheduler}}**
- **{{ui:models.defaults.steps}}**
- **{{ui:models.defaults.cfgScale}}**
- 너비와 높이

그 밖에 **{{ui:models.defaults.vae}}**와 **{{ui:models.defaults.vaePrecision}}**도 저장할 수 있습니다. 항목별 스위치를 켠 것만 저장됩니다. **{{ui:common.save}}** 버튼을 눌러 확정합니다.

모델마다 '추천 값'이 다르므로 자주 쓰는 모델은 한 번 설정해 두면 매번 고치지 않아도 됩니다.

### 삭제

**{{ui:common.delete}}** 버튼을 누르면 확인이 나옵니다. **{{ui:models.deleteWarning}}**

다만 novira가 설치한 모델(앱의 데이터 폴더 안에 있는 것)은 파일째 지워지지만, 직접 준비한 폴더에 있는 모델은 목록에서 빠질 뿐 파일은 남습니다.

## 라이선스 표시

모델에는 배포처가 정한 이용 조건(라이선스)이 있습니다. novira는 그 요점을 표시로 나타냅니다.

| 표시 | 의미 |
|---|---|
| {{ui:browse.commercial.allowed}} | 생성 이미지의 판매나 생성 서비스에서의 이용이 허용되어 있습니다 |
| {{ui:browse.commercial.limited}} | 상업적 이용에 조건이 있습니다(생성 이미지의 판매만 등) |
| {{ui:browse.commercial.denied}} | 상업적 이용은 허용되어 있지 않습니다. 개인 이용으로 한정됩니다 |

표시를 누르면 **{{ui:browse.permission.title}}**이 목록으로 나옵니다. 예를 들어 '{{ui:browse.permission.sellImages}}', '{{ui:browse.permission.sellModel}}', '{{ui:browse.permission.shareMerges}}' 등에 대해 가능, 불가, 기재 없음을 알 수 있습니다.

표시는 Civitai에서는 작성자가 설정한 이용 허가로, Hugging Face에서는 라이선스 표시로 정하고 있습니다. 사이트의 표시를 바탕으로 한 기준이며 최종적으로는 배포처의 라이선스 본문을 확인하세요. **{{ui:browse.permission.disclaimer}}**

설치한 모델의 라이선스를 알 수 없을 때는 **{{ui:models.details.licenseUnknown}}**라고 나옵니다.

> 비상업 라이선스의 모델도 있습니다. 예를 들어 동영상의 **{{ui:video.model.fast}}**은 비상업 라이선스입니다. 만든 이미지나 동영상을 업무나 판매에 사용할 때는 사용한 모델의 라이선스를 반드시 확인하세요.

## 탐색 탭

![탐색 탭. 위에 찾는 곳, 종류, 검색란, 좁히기, 아래에 모델 카드가 나열되어 있다](shot:browse)

**{{ui:app.tabs.browse}}** 탭은 인터넷에 있는 모델을 찾아서 그대로 설치하는 화면입니다.

### 찾는 곳

왼쪽 위의 전환 버튼으로 찾는 곳을 선택합니다.

- **{{ui:browse.source.civitai}}**: 일러스트와 LoRA가 많이 모여 있는 사이트입니다.
- **{{ui:browse.source.huggingface}}**: 연구 기관이나 기업의 모델이 많은 사이트입니다. 그곳의 모델은 이름으로 찾을 수 없으므로, 모델 페이지의 URL(폴더나 파일 페이지도 됩니다) 또는 `owner/name`을 화면 가운데의 큰 입력란에 붙여 넣고 **{{ui:models.install.hfLookup}}**를 누릅니다. 표시된 파일에 체크를 한 뒤 오른쪽 위의 설치 버튼을 누르면 다운로드가 시작됩니다. 폴더의 URL을 붙여 넣은 경우에는 처음에 그 폴더의 파일만 표시됩니다.

그 옆에서 **{{ui:browse.kind.label}}**를 선택합니다. **{{ui:browse.kind.lora}}**, **{{ui:browse.kind.checkpoint}}**, **{{ui:browse.kind.controlnet}}**, **{{ui:browse.kind.vae}}**, **{{ui:browse.kind.diffusion}}**, **{{ui:browse.kind.all}}**입니다.

### 좁히기

검색란에는 모델 이름, 작성자, 태그를 입력합니다. 입력하고 잠시 기다리면 결과가 바뀝니다.

오른쪽 메뉴로 좁힐 수 있습니다.

| 항목 | 내용 |
|---|---|
| {{ui:browse.base.label}} | {{ui:browse.base.sdxlCompat}}, {{ui:browse.base.illustrious}}, {{ui:browse.base.noobai}}, {{ui:browse.base.sdxl}}, {{ui:browse.base.pony}}, {{ui:browse.base.sd15}}, {{ui:browse.base.flux}}, {{ui:browse.base.anima}} 등 |
| {{ui:browse.sort.label}} | {{ui:browse.sort.downloads}}, {{ui:browse.sort.rating}}, {{ui:browse.sort.newest}} |
| {{ui:browse.period.label}} | 전체 기간, 1년, 1개월, 1주일, 24시간(Civitai일 때만) |
| {{ui:browse.nsfw.label}} | 초기값은 꺼짐입니다. 켜면 성인용 모델도 나옵니다 |

아래까지 스크롤하면 이어서 불러옵니다. **{{ui:browse.status.loadMore}}**로도 불러올 수 있습니다. 가져오지 못했을 때는 **{{ui:browse.status.retry}}** 버튼을 누르세요.

### 카드 보는 법과 설치하는 법

카드에는 견본 이미지, 모델 이름, 작성자, 다운로드 수, 좋아요 수, 라이선스 표시가 나옵니다. LoRA에는 트리거 워드도 나옵니다.

- **{{ui:browse.card.download}}**: 그 모델의 대표 파일을 설치합니다.
- 오른쪽 아이콘(**{{ui:browse.card.openCivitai}}**): 배포처 사이트를 브라우저에서 엽니다.

카드를 누르면 오른쪽에서 상세 정보가 열립니다. 버전, 파일 목록(크기, 형식), 트리거 워드, 태그, 설명, 라이선스를 볼 수 있습니다. 버전을 선택하고 설치하고 싶은 파일의 **{{ui:browse.card.download}}** 버튼을 누릅니다. 트리거 워드는 누르면 복사할 수 있습니다. 바깥쪽을 누르거나 `Esc`로 닫습니다.

설치를 시작하면 화면 왼쪽 아래에 **{{ui:browse.dock.title}}**의 작은 틀이 나오고 진행 상황이 보입니다. **{{ui:browse.dock.cancel}}**로 중지할 수 있고 끝난 것은 **{{ui:browse.dock.clear}}**로 지울 수 있습니다. 설치를 마친 카드는 **{{ui:browse.card.installed}}**으로 바뀌며 **{{ui:app.tabs.models}}** 탭의 목록에도 추가됩니다.

> 로그인이 필요한 모델을 다운로드할 때는 **{{ui:settings.title}}**에서 Civitai의 API 키를 등록하세요. Hugging Face에서 접근 신청이 필요한 모델을 사용할 때는 Hugging Face의 토큰을 등록합니다. 둘 다 암호화되어 이 컴퓨터에 저장되며 화면에는 표시되지 않습니다. 자세한 내용은 [AI 어시스턴트와 설정](09-assistant-settings.md) 장을 보세요.

이미지 생성에 대해서는 [이미지 만들기](02-generate.md) 장을 보세요.

