# 동영상, 음악, 음성, 로고, 텍스트

이미지 외에도 novira에서는 동영상, 음악, 음성, 로고를 만들 수 있고, 이미지에 글자나 말풍선을 넣을 수도 있습니다.

모두 **{{ui:app.tabs.generate}}** 탭의 왼쪽 패널에서 사용합니다. 이미지 사용법은 [생성](02-generate.md)을 먼저 보세요.

## 만들 것 전환하기

왼쪽 패널 맨 위에 아이콘만 나열된 전환 버튼이 있습니다. 왼쪽부터 차례로 **{{ui:media.tab.image}}**, **{{ui:media.tab.video}}**, **{{ui:media.tab.music}}**, **{{ui:media.tab.voice}}**, **{{ui:media.tab.logo}}**, **{{ui:media.tab.text}}**, **{{ui:app.tabs.comic}}**입니다. **{{ui:app.tabs.comic}}**은(는) 만화 페이지를 만드는 화면입니다([만화 그리기](12-comic.md)).

아이콘에 마우스를 올리면 이름이 나옵니다. 전환하면 왼쪽 패널과 가운데 화면이 그 종류용으로 바뀝니다.

## 공통 구조

동영상, 음악, 음성, 로고 화면은 같은 구성입니다.

- 왼쪽 패널 맨 위에 설정을 한꺼번에 불러올 수 있는 **{{ui:presets.label}}**이 있습니다.
- 그 아래에 만들기 시작하는 버튼이 있습니다. 부족한 것이 있을 때는 버튼을 누를 수 없는 상태가 되고 바로 아래에 이유가 나옵니다.
- 이유에 '(만드는 것)의 모델을 다운로드하세요'라고 나왔을 때는 다음에 나오는 **모델 카드**에서 설치합니다.
- 만들기 시작하는 버튼 대신 `Ctrl+Enter`로도 만들 수 있습니다.
- 만드는 동안의 상태(대기 중, 만드는 중, 만들지 못한 이유)는 가운데 화면의 맨 위에 나옵니다. **{{ui:media.job.cancel}}**으로 멈출 수 있습니다.

> 만들기는 한 번에 1건씩입니다. 동영상이나 음악을 만드는 동안에는 이미지 등 다른 생성이 대기 상태가 됩니다. 기다리는 항목은 **{{ui:app.tabs.queue}}** 탭에서도 확인할 수 있습니다.

### 처음에 필요한 모델 다운로드

동영상, 음악, 음성, 로고는 각각 전용 모델이 필요합니다. 설치되어 있지 않으면 왼쪽 패널에 '모델 카드'가 나옵니다. **{{ui:pack.install}}** 버튼을 누르면 앱이 자동으로 가져옵니다.

| 만드는 것 | 카드의 이름 | 크기의 기준 |
|---|---|---|
| 동영상 | {{ui:pack.title.video}} | 약 18 GB |
| 동영상(고속판) | {{ui:pack.title.turbo}} | 표준과 공통인 파일은 중복해서 받지 않습니다 |
| 음악 | {{ui:pack.title.music}} | 약 10 GB |
| 음성 | {{ui:pack.title.voice}} | 약 9 GB |
| 로고 | {{ui:pack.title.logo}} | 약 12 GB |

크기는 기준입니다. 정확한 크기는 카드에 나오는 숫자를 보세요.

동영상은 표준 모델과 고속 모델 중에서 고를 수 있습니다. 카드에는 이 PC의 GPU 이름과 메모리, 그리고 모델마다 맞는지 여부(**{{ui:media.choice.fit.comfortable}}**, **{{ui:media.choice.fit.tight}}**, **{{ui:media.choice.fit.short}}**)이 표시됩니다. 이 PC에 맞는 모델에는 **{{ui:media.choice.recommended}}** 표시가 붙습니다. GPU 메모리를 확인할 수 없을 때는 맞는지 여부가 **{{ui:media.choice.fit.unknown}}**으로 표시됩니다. 어디까지나 대략적인 기준이라서, **{{ui:media.choice.fit.short}}**이어도 느려질 뿐 동작하는 경우가 있습니다.

다운로드는 처음에 한 번뿐입니다. 진행 상황이 카드에 나오고, 어느 화면에서든 왼쪽 아래의 '{{ui:media.downloads.title}}' 상자에도 나오며 도중에 **{{ui:common.cancel}}**도 할 수 있습니다. 실패했을 때는 카드에 이유가 나오고 버튼이 **{{ui:pack.retry}}**로 바뀝니다.

크기를 알 수 있는 다운로드에는 '남은 시간 약 2분'처럼 남은 시간도 나옵니다(다운로드 속도로 계산하므로 시작한 직후에는 나오지 않습니다). 크기를 모르는 것이나 설치 작업 중에는 시작한 뒤 지난 시간이 나옵니다. 확장 기능을 내려받을 때는 상자의 **{{ui:media.downloads.manage}}**에서 설치된 확장 기능 목록을 열 수 있습니다.

설치가 끝나면 카드는 사라집니다. 음성만은 읽어 주기용 엔진도 함께 설치되므로 시간이 조금 걸립니다.

> 다운로드 전에 이미지를 만드는 엔진(ComfyUI)의 준비가 끝나 있어야 합니다. 잘 진행되지 않을 때는 [문제가 생겼을 때](10-troubleshooting.md)를 보세요.

## 동영상 만들기

![동영상 화면. 왼쪽에 만드는 방식, 프롬프트, 크기 등의 설정, 가운데에 만든 동영상 목록이 나온다](shot:media-video)

동영상은 문장으로 만드는 방법과 1장의 이미지를 움직이는 방법이 있습니다.

### 만드는 방법

1. 왼쪽 패널에서 **{{ui:media.tab.video}}**을 선택합니다.
2. 처음이라면 **{{ui:pack.title.video}}** 카드에서 **{{ui:pack.install}}** 버튼을 누릅니다.
3. **{{ui:video.mode.label}}**에서 **{{ui:video.mode.text}}** 또는 **{{ui:video.mode.image}}**를 선택합니다.
4. **{{ui:video.prompt}}**에 어떤 동영상으로 만들고 싶은지 씁니다. 이미지로 만들 때는 어떻게 움직이고 싶은지 씁니다.
5. **{{ui:params.invoke.invoke}}** 버튼을 누릅니다.

**{{ui:video.mode.image}}**를 선택하면 움직일 이미지를 지정하는 입력란이 나옵니다. 이미지를 드롭하거나 갤러리에서 이미지를 선택한 뒤 **{{ui:video.pickFromGallery}}** 버튼을 누릅니다.

갤러리의 이미지를 오른쪽 클릭해서 **{{ui:gallery.menu.sendToVideo}}**를 선택하는 방법도 있습니다.
### 설정

| 항목 | 내용 |
|---|---|
| {{ui:video.negative}} | 넣고 싶지 않은 요소. 처음부터 흐림이나 글자 등을 피하는 말이 들어 있습니다 |
| {{ui:video.model}} | **{{ui:video.model.standard}}**은 정성껏 만듭니다. **{{ui:video.model.fast}}**은 짧은 시간에 만들 수 있지만 세부가 거칠어질 수 있습니다 |
| {{ui:video.size}} | 동영상의 크기. 처음에는 832×480입니다. 세로로 긴 것과 정사각형도 선택할 수 있습니다 |
| {{ui:video.fps}} | 1초당 프레임 수(8~30) |
| {{ui:video.lengthLabel}} | 1~10초. 프레임 수는 길이와 프레임 레이트로 자동으로 정해집니다 |
| {{ui:video.steps}}, {{ui:video.cfg}} | 완성도의 세밀한 조정. 모델을 선택하면 그 모델에 맞는 값으로 전환됩니다 |
| {{ui:video.randomSeed}} | 끄면 시드를 정해서 같은 움직임을 다시 만들 수 있습니다 |

**{{ui:video.model.fast}}**을 사용하려면 별도로 **{{ui:pack.title.turbo}}**의 다운로드가 필요합니다. 이 모델은 비상업 라이선스입니다.

### GPU의 메모리가 적을 때

**{{ui:video.light.title}}**에 스위치가 2개 있습니다.

- **{{ui:video.light.fp8}}**: 모델이 사용하는 메모리가 거의 절반이 됩니다. 세부가 약간 거칠어질 수 있습니다.
- **{{ui:video.light.tiled}}**: 마지막 마무리에서 메모리가 갑자기 늘어나는 것을 억제합니다. 화질은 바뀌지 않으며 조금 느려집니다.

그래도 부족할 때는 크기를 작게 해서 만들고 완성된 동영상을 **{{ui:video.finish}}**로 크게 만드는 방법도 있습니다.

### 결과

동영상은 몇 분에서 십몇 분이 걸립니다. 완성되면 가운데에 동영상 목록으로 나열되며 그 자리에서 재생할 수 있습니다. 오른쪽 갤러리에도 ▶ 표시가 붙은 썸네일로 들어갑니다.

각 동영상 아래에는 프롬프트와 크기, 길이, 시드가 나옵니다. 휴지통 버튼으로 삭제할 수 있습니다.

**{{ui:video.finish}}** 버튼을 누르면 **{{ui:finish.title}}** 화면이 열립니다.

- **{{ui:finish.smooth.title}}**: 프레임 사이를 보간해서 움직임을 부드럽게 합니다.
- **{{ui:finish.enlarge.title}}**: 확대용 모델로 동영상을 크게 만듭니다. 시간과 메모리를 많이 사용합니다.

원래의 동영상은 그대로 남고 마무리한 동영상이 새로 늘어납니다. 프레임을 보간하려면 확장 기능이 필요할 수 있습니다(화면의 안내에 따라 **{{ui:finish.install}}** 버튼을 누르세요).

## 음악 만들기

![음악 화면. 왼쪽에 스타일, 가사, 길이, 템포 등의 설정이 나열되어 있다](shot:media-music)

문장(스타일)과 가사로 곡을 만듭니다.

### 만드는 방법

1. 왼쪽 패널에서 **{{ui:media.tab.music}}**을 선택합니다.
2. 처음이라면 **{{ui:pack.title.music}}** 카드에서 **{{ui:pack.install}}** 버튼을 누릅니다.
3. **{{ui:music.tags}}**에 장르, 분위기, 악기를 쉼표로 구분해서 씁니다. 예를 들어 `upbeat J-pop, female vocal, piano, bright`처럼 합니다.
4. 노래가 있는 곡으로 하려면 **{{ui:music.lyrics}}**를 씁니다. 노래 없이 하려면 **{{ui:music.instrumental}}**에 체크합니다.
5. **{{ui:params.invoke.invoke}}** 버튼을 누릅니다.

스타일은 필수입니다. 비워 두면 만들 수 없습니다.

가사는 `[verse]`(벌스)나 `[chorus]`(후렴)처럼 대괄호로 구분을 붙여서 쓸 수 있습니다. 영어, 일본어, 중국어 등으로 쓸 수 있습니다. **{{ui:music.language}}**에서 가사의 언어를 선택합니다. 잘 모르겠을 때는 **{{ui:music.lang.unknown}}**으로 합니다.

### 설정

| 항목 | 내용 |
|---|---|
| {{ui:music.lengthLabel}} | 10~240초 |
| {{ui:music.bpm}} | 곡의 빠르기(40~220) |
| {{ui:music.timeSignature}} | 2/4, 3/4, 4/4, 6/4 |
| {{ui:music.key}} | `C major`부터 `B minor`까지 |
| {{ui:music.steps}}, {{ui:music.cfg}} | 완성도의 세밀한 조정 |

### 결과

곡은 수십 초에서 몇 분 안에 가운데 목록에 나열됩니다. 각각에 플레이어가 붙어 있어서 그대로 재생할 수 있습니다. 길이, 템포, 키, 시드가 나오며 가사가 있을 때는 **{{ui:audio.lyrics}}**를 열어서 확인할 수 있습니다.

갤러리에도 음표 썸네일로 들어갑니다.

## 음성 만들기

![음성 화면. 왼쪽에 읽어 줄 문장, 언어, 보이스 선택 방법이 나열되어 있다](shot:media-voice)

입력한 문장을 소리로 읽어 줍니다.

### 만드는 방법

1. 왼쪽 패널에서 **{{ui:media.tab.voice}}**을 선택합니다.
2. 처음이라면 **{{ui:pack.title.voice}}** 카드에서 **{{ui:pack.install}}** 버튼을 누릅니다. 읽어 주기용 엔진과 모델이 앱 폴더 안에만 설치됩니다.
3. **{{ui:voice.text}}**에 읽어 주길 원하는 문장을 입력합니다.
4. **{{ui:voice.language}}**를 선택합니다. **{{ui:voice.lang.Auto}}**이라면 문장으로 판정합니다.
5. 목소리를 정합니다(아래 참조).
6. **{{ui:params.invoke.invoke}}** 버튼을 누릅니다.

### 목소리 정하는 방법

**{{ui:voice.mode.label}}**에서 2가지 방법 중에서 선택할 수 있습니다.

- **{{ui:voice.mode.preset}}**: 준비된 보이스에서 선택합니다. 일본어 여성, 중국어, 영어 남성, 한국어 여성 등이 있으며 이름 뒤에 언어와 성별이 나옵니다. **{{ui:voice.style}}**에 '밝고 활기차게', '천천히 차분하게'처럼 쓰면 말하는 방식도 지정할 수 있습니다.
- **{{ui:voice.mode.design}}**: **{{ui:voice.description}}**에 목소리의 특징을 말로 씁니다. 예를 들어 '차분하고 낮은 남성의 목소리. 천천히 부드럽게 말한다.'처럼 합니다. 설명은 필수입니다.

읽어 줄 수 있는 언어는 일본어, 영어, 중국어, 한국어, 독일어, 프랑스어, 러시아어, 포르투갈어, 스페인어, 이탈리아어입니다.

### 결과

완성된 음성은 가운데 목록에 플레이어와 함께 나열됩니다. 사용한 보이스({{ui:audio.voice.designed}}일 때는 '{{ui:audio.voice.designed}}')와 언어도 나옵니다. 갤러리에도 들어갑니다.

처음 생성은 모델을 불러오느라 시간이 조금 걸립니다. 한동안 사용하지 않으면 모델은 GPU에서 내려가고 다른 작업에 메모리가 돌아갑니다.

## 로고 만들기

![로고 화면. 왼쪽에 로고의 글자, 스타일, 모양, 후보 수가 나열되어 있다](shot:media-logo)

글자를 넣은 로고의 후보를 만듭니다.

### 만드는 방법

1. 왼쪽 패널에서 **{{ui:media.tab.logo}}**를 선택합니다.
2. 처음이라면 **{{ui:pack.title.logo}}** 카드에서 **{{ui:pack.install}}** 버튼을 누릅니다.
3. **{{ui:logo.text}}**에 로고에 넣을 글자를 입력합니다(60자까지).
4. **{{ui:logo.style}}**에 분위기, 색, 모양을 씁니다. 일본어든 영어든 상관없습니다. 예를 들어 '미니멀, 파랑과 하양, 기하학적'처럼 합니다.
5. **{{ui:logo.size}}**에서 **{{ui:logo.size.square}}**, **{{ui:logo.size.wide}}**, **{{ui:logo.size.tall}}** 중에서 모양을 선택합니다.
6. **{{ui:logo.countLabel}}**를 1~4 중에서 선택하고 **{{ui:params.invoke.invoke}}** 버튼을 누릅니다.

### 결과와 글자 겹치기

완성된 로고는 가운데에 후보로 나열됩니다. 갤러리에서는 **{{ui:gallery.view.images}}**가 아니라 **{{ui:gallery.view.assets}}** 쪽에 들어갑니다. 로고를 만드는 화면을 열면 오른쪽 갤러리는 자동으로 에셋 표시가 됩니다.

영어 글자는 정확하게 나오지만 일본어는 깨지는 경우가 있습니다. 그럴 때는 마음에 드는 후보의 **{{ui:logo.layText}}** 버튼을 누르세요. **{{ui:media.tab.text}}**로 전환되고 그 로고가 배경이 되므로 원하는 글자를 겹칠 수 있습니다.

## 텍스트(글자와 말풍선)

![텍스트 화면. 왼쪽에 글자를 추가하는 버튼, 배경, 레이어, 글자 스타일, 가운데에 편집 중인 이미지가 나온다](shot:media-text)

**{{ui:media.tab.text}}**는 이미지에 글자나 말풍선을 넣어서 이미지로 저장하는 편집 화면입니다. 모델 다운로드는 필요 없습니다. 이미지를 만드는 처리도 사용하지 않으므로 바로 사용할 수 있습니다.

### 배경 정하기

**{{ui:text.bg.title}}**에서 무엇 위에 글자를 놓을지 선택합니다.

- **{{ui:text.bg.image}}**: 이미지를 배경으로 합니다. 갤러리에서 이미지를 표시한 뒤 **{{ui:text.bg.useViewer}}** 버튼을 누르거나 이미지를 이 화면에 드롭합니다. 이미지와 같은 크기로 저장됩니다.
- **{{ui:text.bg.color}}**: 단색 배경입니다. 크기는 목록의 1024×1024나 1920×1080 등에서 선택하거나 너비와 높이를 숫자로 입력합니다.
- **{{ui:text.bg.transparent}}**: 배경이 없습니다. 글자만 투명한 이미지로 만들 수 있습니다.

갤러리의 이미지를 오른쪽 클릭해서 **{{ui:gallery.menu.sendToText}}**을 선택하는 방법도 있습니다.

### 글자와 말풍선 추가하기

- **{{ui:text.add.text}}**: 글자 레이어를 추가합니다.
- **{{ui:text.add.bubble}}**: 말풍선을 추가합니다. 모양은 **{{ui:text.shape.round}}**, **{{ui:text.shape.box}}**, **{{ui:text.shape.cloud}}**, **{{ui:text.shape.burst}}**, **{{ui:text.shape.whisper}}**, **{{ui:text.shape.narration}}** 중에서 선택합니다.

추가한 것은 화면 안에서 드래그해서 움직일 수 있습니다. 선택하면 네 모서리에 둥근 손잡이가 나오며 드래그로 크기를 바꿀 수 있습니다. 말풍선에는 '{{ui:text.bubble.tail}}'가 있으며 끝의 손잡이를 드래그해서 방향을 바꿉니다.

`Delete`로 삭제, `Ctrl+D`로 복제, 화살표 키로 조금씩 이동, `Ctrl+Z`로 되돌리기, `Ctrl+Shift+Z`(또는 `Ctrl+Y`)로 다시 실행을 할 수 있습니다. 화면 위의 **{{ui:text.undo}}**, **{{ui:text.redo}}** 버튼으로도 같습니다. 표시 크기는 **{{ui:text.zoom.in}}**, **{{ui:text.zoom.out}}**, **{{ui:text.zoom.fit}}**로 바꿀 수 있습니다.

### 레이어

추가한 글자와 말풍선은 **{{ui:text.layers.title}}**에 겹침 순서로 나열됩니다. 목록의 위에 있을수록 앞에 있습니다.

하나씩 **{{ui:text.layer.hide}}**, **{{ui:text.layer.lock}}**, **{{ui:text.layer.up}}**·**{{ui:text.layer.down}}**로 순서 바꾸기, **{{ui:text.layer.duplicate}}**, **{{ui:text.layer.delete}}**를 할 수 있습니다. **{{ui:text.layers.clear}}**로 한꺼번에 지울 수 있습니다.

### 글자 다듬기

레이어를 선택하면 그 아래에 설정이 나옵니다.

| 항목 | 내용 |
|---|---|
| {{ui:text.content}} | 글자를 입력합니다(줄바꿈 가능) |
| {{ui:text.font}}, {{ui:text.weight}}, {{ui:text.size}} | 글꼴, 굵기, 크기. 글꼴은 앱에 들어 있으므로 어느 PC에서나 같은 모습이 됩니다 |
| {{ui:text.fill}} | **{{ui:text.fill.solid}}** 또는 **{{ui:text.fill.gradient}}**(위아래로 색을 바꿈) |
| {{ui:text.stroke}}, {{ui:text.outline}} | 글자의 테두리와 그 바깥쪽의 테두리 |
| {{ui:text.shadow}} | 그림자. 색, 흐림, 어긋남을 선택할 수 있습니다 |
| {{ui:text.letterSpacing}}, {{ui:text.lineHeight}}, {{ui:text.align}} | 글자와 글자, 줄과 줄 사이의 간격, 정렬 방식 |
| {{ui:text.vertical}} | 세로쓰기로 합니다. 세로쓰기일 때는 정렬 방식이 '{{ui:text.align.top}}, {{ui:text.align.center}}, {{ui:text.align.bottom}}'로 바뀝니다 |
| {{ui:text.bend}} | 글자를 곡선으로 만듭니다(세로쓰기에서는 사용할 수 없습니다) |
| {{ui:text.rotation}}, {{ui:text.opacity}} | 회전과 불투명도 |

말풍선에서는 크기, 채우는 색, 테두리선, 꼬리도 조정할 수 있습니다. **{{ui:text.shape.burst}}** 모양에서는 **{{ui:text.bubble.shuffle}}**로 삐죽삐죽한 모양을 바꿀 수 있습니다. **{{ui:text.bubble.autoFit}}**를 켜면 글자가 말풍선에 들어가도록 줄어듭니다.

### 스타일 프리셋

왼쪽 패널 맨 위의 프리셋에는 **{{ui:text.preset.plain}}**, **{{ui:text.preset.pop}}**, **{{ui:text.preset.sfx}}**, **{{ui:text.preset.gold}}**, **{{ui:text.preset.sticker}}**, **{{ui:text.preset.soft}}**의 로고풍 스타일이 들어 있습니다. 글자 레이어를 선택한 뒤 사용하면 그 스타일이 적용됩니다.

나만의 스타일(글꼴, 채우기, 테두리, 그림자, 자간)을 저장할 수도 있습니다.

### 저장

완성되면 **{{ui:text.save}}** 버튼을 누릅니다. 배경 크기의 PNG 이미지로 갤러리에 들어갑니다. 저장한 뒤에도 화면의 편집 내용은 남아 있으므로 이어서 고칠 수 있습니다.

## 프리셋

동영상, 음악, 음성, 로고, 텍스트 화면에도 이미지와 같은 형태의 프리셋이 있습니다. 화면 왼쪽 위의 **{{ui:presets.label}}**에서 선택하면 저장해 둔 설정이 한꺼번에 들어갑니다.

나만의 설정을 저장하려면 프리셋 옆의 저장 버튼(**{{ui:presets.saveNew}}**)을 누르고 이름을 붙입니다. 저장한 것은 **{{ui:presets.group.mine}}**에 나열됩니다. 목록 각 항목의 '…' 메뉴에서 **{{ui:presets.overwrite}}**, **{{ui:presets.rename}}**, **{{ui:presets.delete}}**도 할 수 있습니다. 처음부터 준비된 것은 **{{ui:presets.group.builtin}}**에 들어 있습니다(이름은 영어입니다).

화면마다 저장되는 내용은 조금씩 다릅니다.

| 화면 | 저장되는 내용 | 저장되지 않는 것 |
|---|---|---|
| 동영상 | 프롬프트, 모델, 크기, 길이, 품질 설정 | 시드와 원본 이미지 |
| 음악 | 스타일 태그와 곡 설정 | 가사와 시드 |
| 음성 | 언어와 목소리(보이스와 말하는 방식, 또는 목소리 설명) | 읽어 줄 문장 |
| 로고 | 스타일을 설명하는 말과 모양, 후보 수 | 로고에 넣을 글자 |
| 텍스트 | 글자 스타일 | 글자 내용 |

처음부터 들어 있는 프리셋은 동영상이 'Quick preview', 'Standard 832x480', 'Vertical, low VRAM'의 3개, 음악이 'Lo-fi instrumental'과 'J-pop song', 음성이 'Calm narrator'와 'Energetic announcer', 로고가 5개입니다.

모델을 찾는 방법과 설치하는 방법은 [모델](08-models.md) 장을 보세요.

