# 업스케일과 워크플로

이 장에서는 그림을 크게 만드는 **{{ui:app.tabs.upscaling}}** 탭과 처리를 직접 연결해서 만드는 **{{ui:app.tabs.workflows}}** 탭을 설명합니다.

## 업스케일

![업스케일 탭. 가운데에 그림을 놓는 곳과 순서 카드가 나열되어 있다](shot:upscaling)

**{{ui:app.tabs.upscaling}}** 탭은 그림을 크게 만들면서 세부를 덧그립니다. 단순히 늘리는 것이 아니라 먼저 확대용 모델로 크게 만든 뒤 프롬프트와 타일 ControlNet을 사용해서 세밀한 곳을 다시 그립니다.

### 사용하는 것

다음 2가지 모델이 필요합니다. 설치되어 있지 않을 때는 왼쪽 패널에 주의가 나옵니다. '{{ui:params.upscale.openModels}}' 버튼에서 모델 화면으로 이동할 수 있습니다. 설치 방법은 [모델](08-models.md) 장을 보세요.

- {{ui:params.upscale.model}}(Real-ESRGAN 등 그림을 확대하기 위한 모델)
- 선택한 메인 모델에 맞는 {{ui:params.upscale.tileControlnet}}

확대 모델이 하나도 설치되어 있지 않으면 왼쪽 패널에 후보가 나열됩니다. **{{ui:media.choice.recommended}}** 표시가 붙은 것부터 골라 **{{ui:models.install.install}}**로 설치하세요.

### 순서

1. 크게 만들고 싶은 그림을 갤러리에서 가운데 카드나 왼쪽 패널의 **{{ui:params.upscale.title}}** 칸으로 드래그합니다. 갤러리의 그림을 오른쪽 클릭(뷰어에서는 도구 모음)해서 **{{ui:gallery.menu.upscale}}**을 선택하거나 뷰어에서 그림을 열고 `Shift+U`를 눌러도 탭이 전환되면서 그림이 들어갑니다.
2. **{{ui:params.upscale.model}}**을 선택합니다.
3. **{{ui:params.upscale.scale}}**을 2x, 4x, 8x 중에서 선택합니다. '출력: 2048×2048'처럼 완성되는 크기가 나옵니다.
4. 완성도를 다음 2개의 슬라이더로 조정합니다.
   - **{{ui:params.upscale.creativity}}**: 높을수록 원본 그림에서 멀어지며 새로운 세부를 덧그립니다.
   - **{{ui:params.upscale.structure}}**: 높을수록 원본 그림의 형태와 배치를 유지합니다.
5. **{{ui:params.upscale.tileControlnet}}**을 선택합니다. 필요하면 **{{ui:params.upscale.postProcessing}}**(그려진 그림을 다듬은 뒤, 출력 크기에 맞춥니다)도 선택합니다.
6. **{{ui:params.invoke.invoke}}** 버튼을 누릅니다.

완성된 그림은 갤러리에 들어갑니다.

- 출력 크기는 한 변이 8192px까지입니다. 그것을 넘으면 경고가 나오므로 배율을 낮추세요.
- 프롬프트는 덧그리는 세부에 영향을 줍니다. 원본 그림의 프롬프트를 넣어 두면 원본과 방향이 맞기 쉬워집니다.
- 확대한 뒤의 그림이 원본과 너무 다를 때는 **{{ui:params.upscale.creativity}}**을 낮추고 **{{ui:params.upscale.structure}}**를 올립니다.

> 여러 그림을 한 번에 확대하고 싶을 때는 갤러리에서 여러 장을 선택하고 오른쪽 클릭에서 **{{ui:gallery.menu.batch}}**를 사용합니다([그림 수정하고 다시 쓰기](04-improve.md)). 이쪽은 확대용 모델만으로 크게 만듭니다.

## 워크플로

![워크플로 탭. 오른쪽이 처리의 연결을 그리는 화면, 왼쪽이 폼](shot:workflows)

워크플로는 '모델을 불러온다 → 프롬프트를 넣는다 → 그림을 만든다 → 저장한다'와 같은 처리의 순서를 부품(노드)을 연결해서 조립하는 기능입니다. 평소의 생성 탭에서는 손이 닿지 않는 세밀한 순서나 몇 가지 처리를 조합한 흐름을 만들 수 있습니다.

처음에는 **{{ui:workflows.panel.templates}}**(아래 항목)에서 템플릿을 열어 사용하는 것을 추천합니다.

화면은 다음 2가지로 이루어져 있습니다.

- 가운데: **{{ui:app.views.editor}}**. 노드를 늘어놓고 선으로 연결합니다.
- 왼쪽 패널: **{{ui:workflows.panel.workflow}}**(폼), **{{ui:workflows.panel.templates}}**, **{{ui:workflows.panel.packs}}**, **{{ui:workflows.panel.details}}**, **{{ui:workflows.panel.data}}**의 5개 탭.

워크플로를 실행하려면 왼쪽 패널 위에 있는 **{{ui:params.invoke.invoke}}** 버튼을 누릅니다. 출력 노드('{{ui:workflows.nodes.save_image.title}}' 등)가 없거나 모델이 선택되어 있지 않은 등의 문제가 있을 때는 생성할 수 없는 이유가 표시됩니다.

### 노드를 추가하고 연결하기

1. 편집기 왼쪽 위의 **{{ui:workflows.toolbar.addNode}}**(＋)를 누릅니다. 키보드의 `Shift+A` 또는 `Space`로도 열립니다.
2. 목록에서 노드를 선택합니다. 위쪽 검색란에 말을 입력해서 좁힐 수 있습니다. 왼쪽의 분류에서 기본 노드의 종류별로, 또는 설치한 확장 기능별로 좁혀 볼 수 있습니다.
3. 노드 오른쪽에 있는 동그라미(출력)에서 다른 노드 왼쪽의 동그라미(입력)까지 드래그해서 연결합니다. 연결할 수 있는 것은 같은 종류끼리뿐입니다.

![노드를 추가할 때의 목록](shot:workflows-add-node)

연결할 때 편리한 기능이 있습니다.

- 선을 아무것도 없는 곳에서 드롭하면 거기에 연결할 수 있는 노드만 목록에 나옵니다. 선택하면 노드를 추가하고 그대로 연결됩니다.
- 선을 노드 위에서 드롭하면 맞는 입력에 자동으로 연결됩니다.
- 선택한 노드는 `Delete`로 지워집니다. `Ctrl+C`와 `Ctrl+V`로 노드를 복제할 수 있습니다. `Ctrl+Z`로 되돌리고 `Ctrl+Shift+Z`로 다시 실행합니다.
- 갤러리의 그림을 편집기로 드래그하면 그 그림을 넣는 '{{ui:workflows.nodes.image.title}}' 노드가 추가됩니다.
- 노드 이름 왼쪽의 화살표로 노드를 접을 수 있습니다. 이름을 더블클릭하면 이름을 바꿀 수 있습니다.

노드의 설정값은 노드 안에서 직접 입력합니다. 연결한 입력의 값은 연결한 곳에서 옵니다.

### 버튼 배치

편집기 왼쪽 위의 버튼입니다.

| 버튼 | 하는 일 |
|---|---|
| **{{ui:workflows.toolbar.addNode}}** | 노드를 추가합니다. |
| **{{ui:workflows.toolbar.library}}** | 워크플로 목록을 엽니다. |
| **{{ui:workflows.toolbar.new}}** | 빈 워크플로를 시작합니다. |
| **{{ui:workflows.toolbar.save}}**(`Ctrl+S`) | 저장합니다. 처음 저장할 때는 이름을 묻습니다. |
| **{{ui:workflows.toolbar.optimize}}** | 중복되는 노드를 합치고 출력에 연결되지 않은 노드와 불필요한 연결을 지운 뒤 왼쪽에서 오른쪽으로 다시 배열합니다. 되돌릴 수도 있습니다. |
| **{{ui:workflows.toolbar.more}}** | **{{ui:common.saveAs}}**, **{{ui:workflows.toolbar.download}}**, **{{ui:workflows.toolbar.loadFromFile}}**. |

오른쪽 위 톱니바퀴의 **{{ui:workflows.settings.title}}**에서는 미니맵 표시, 격자에 맞추기 등을 전환할 수 있습니다.

**{{ui:workflows.settings.autoTidy}}**는 처음부터 켜져 있습니다. 노드나 선을 추가하거나 지우면 잠시 뒤 노드를 왼쪽에서 오른쪽으로 자동으로 다시 배열하고 같은 기능의 중복된 노드를 합칩니다. 합쳤을 때는 알림이 나오며 `Ctrl+Z`로 되돌릴 수 있습니다. 연결되지 않은 노드는 자동으로는 지워지지 않습니다. 직접 배열하고 싶을 때는 끄세요.

저장하지 않은 변경이 있으면 이름 옆에 점이 나옵니다. 다른 워크플로로 전환할 때는 버려도 되는지 묻습니다.

### 폼으로 사용하기

편집기는 노드가 많아지면 알기 어려워집니다. 그래서 사용할 때 자주 만지는 항목만 모은 '폼'을 만들 수 있습니다.

1. 편집기에서 항목(필드)을 오른쪽 클릭해서 **{{ui:workflows.node.addToForm}}**를 선택합니다.
2. 왼쪽 패널의 **{{ui:workflows.panel.workflow}}** 탭에 그 항목이 나열됩니다.
3. **{{ui:workflows.form.editForm}}**을 누르면 순서를 바꾸거나 뺄 수 있습니다.

프롬프트나 크기만 바꿔 가며 여러 번 실행할 때 편리합니다. 연결되어 있는 항목은 '{{ui:workflows.form.connected}}'라고 표시됩니다.

**{{ui:workflows.panel.details}}** 탭에서는 이름, 작성자, 태그, 설명 등을 쓸 수 있습니다. **{{ui:workflows.panel.data}}** 탭에서는 워크플로의 내용(JSON)을 보고 복사할 수 있습니다.

### 워크플로 라이브러리

![워크플로 라이브러리](shot:workflows-library)

**{{ui:workflows.library.button}}**를 누르면 목록이 열립니다.

- **{{ui:workflows.library.recent}}**: 최근에 연 것.
- **{{ui:workflows.library.yours}}**: 직접 저장한 것.
- **{{ui:workflows.library.defaults}}**: 처음부터 들어 있는 기본 워크플로입니다. 먼저 **{{ui:workflows.library.copyToMine}}**해서 고칩니다.

검색, 태그로 좁히기, 정렬 순서 변경을 할 수 있습니다. **{{ui:workflows.library.open}}**로 열고 휴지통 버튼으로 삭제합니다. **{{ui:workflows.library.new}}**와 **{{ui:workflows.library.upload}}**도 여기에 있습니다.

### 내보내기와 불러오기

- **{{ui:workflows.toolbar.download}}**로 워크플로를 JSON 파일로 내보낼 수 있습니다.
- **{{ui:workflows.toolbar.loadFromFile}}**(또는 **{{ui:workflows.library.upload}}**)로 내보낸 파일이나 다른 사람이 만든 파일을 불러올 수 있습니다.
- 불러온 파일이 아직 설치되지 않은 확장 기능의 노드를 사용하고 있을 때는 '{{ui:workflows.import.title}}'라는 대화 상자가 나옵니다. 설치하고 ComfyUI를 다시 시작하면 그 워크플로가 자동으로 열립니다.
- 워크플로로 만든 그림에서도 워크플로를 꺼낼 수 있습니다. 갤러리의 그림을 오른쪽 클릭해서 **{{ui:gallery.menu.loadWorkflow}}**를 선택합니다(뷰어에서 그림을 열어 두었을 때는 `W` 키로도 쓸 수 있습니다). 보통으로 생성한 그림이라도 설정으로부터 같은 흐름을 조립할 수 있습니다. **{{ui:gallery.menu.sendToWorkflow}}**는 그 그림을 워크플로의 입력 이미지로 사용할 때 선택합니다.

> 다른 사람이 만든 워크플로는 이 컴퓨터에서 동작하는 프로그램의 연결입니다. 출처를 알 수 없는 파일은 불러오지 마세요.

## 템플릿

**{{ui:workflows.panel.templates}}** 탭에는 자주 쓰는 조합의 템플릿이 나열됩니다.

- **{{ui:workflows.templates.open}}**를 누르면 새 워크플로로 열립니다.
- **{{ui:workflows.templates.add}}**를 누르면 현재 편집기의 오른쪽에 추가합니다.
- 모델이나 이미지는 연 뒤에 선택합니다.

확장 기능이 필요한 템플릿에는 '필요한 팩' 항목이 나옵니다. **{{ui:workflows.templates.installPacks}}**를 눌러 설치하고 **{{ui:workflows.templates.restartFirst}}** 버튼으로 ComfyUI를 다시 시작하면 열 수 있게 됩니다.

준비되어 있는 템플릿은 다음과 같습니다.

| 템플릿 | 하는 일 | 필요한 확장 기능 |
|---|---|---|
| **{{ui:workflows.templates.text2image.title}}** | 모델과 프롬프트로 1장을 만들어 저장하는 기본 형태입니다. | 없음 |
| **{{ui:workflows.templates.text2imageUpscale.title}}** | 1024로 만든 그림을 2048로 확대해서 저장합니다. | 없음 |
| **{{ui:workflows.templates.loraStack.title}}** | 모델에 LoRA를 차례로 연결해서 화풍과 세부를 더합니다. | 없음 |
| **{{ui:workflows.templates.image2image.title}}** | 가지고 있는 그림을 바탕으로 다른 프롬프트로 다시 그립니다. | 없음 |
| **{{ui:workflows.templates.upscale.title}}** | 확대용 모델로 그림을 고해상도로 크게 만듭니다. | 없음 |
| **{{ui:workflows.templates.controlnetCanny.title}}** | 그림의 윤곽선을 뽑아서 그 형태를 유지한 채 새로 그립니다. | 없음 |
| **{{ui:workflows.templates.imageToVideo.title}}** | 1장의 그림에 움직임을 주어 짧은 동영상으로 만듭니다. | 없음(동영상용 모델이 필요합니다) |
| **{{ui:workflows.templates.filmGrain.title}}** | 만든 그림에 사진 같은 입자를 더합니다. | ComfyUI-NKD-Basic-Tools |
| **{{ui:workflows.templates.faceRig.title}}** | 얼굴 사진의 표정, 시선, 목의 방향을 바꿉니다. | ComfyUI-NKD-Basic-Tools |
| **{{ui:workflows.templates.tiledUpscale.title}}** | 2048로 확대한 뒤 타일마다 다시 그려서 세부를 더합니다. | ComfyUI_UltimateSDUpscale |
| **{{ui:workflows.templates.styleReference.title}}** | 참조 이미지의 화풍을 프롬프트의 그림에 옮깁니다. | ComfyUI_IPAdapter_plus(와 그 모델) |
| **{{ui:workflows.templates.faceDetailer.title}}** | 만든 그림의 얼굴을 찾아 높은 해상도로 다시 그립니다. | Impact Pack과 Impact Subpack |
| **{{ui:workflows.templates.removeBackground.title}}** | 사람이나 사물만 남기고 배경을 투명하게 합니다. | ComfyUI-RMBG |
| **{{ui:workflows.templates.whiteBackground.title}}** | 사람이나 사물만 남기고 배경을 새하얗게 합니다. 참조 이미지의 배경 색이 그림에 옮겨 가는 것을 막는 사전 준비에 적합합니다. | ComfyUI-RMBG |
| **{{ui:workflows.templates.poseControl.title}}** | 참고한 그림 속 인물의 포즈를 뽑아서 같은 자세의 새 그림을 그립니다. | comfyui_controlnet_aux(와 OpenPose용 ControlNet 모델) |
| **{{ui:workflows.templates.captionToImage.title}}** | 참고한 그림의 내용을 문장으로 만들고 프롬프트로 삼아 새로 그립니다. | Florence-2의 확장 기능 |
| **{{ui:workflows.templates.characterReference.title}}** | 캐릭터의 그림을 흰 배경으로 만들어 참조 이미지로 삼고, 머리카락, 눈, 옷을 맞춰서 새 장면을 그립니다. CFG는 참조 이미지에 맞는 낮은 값으로 되어 있습니다. | ComfyUI-RMBG와 ComfyUI_IPAdapter_plus |
| **{{ui:workflows.templates.characterPose.title}}** | 캐릭터의 외모는 참조 이미지에서, 자세는 막대 인간(OpenPose)에서 가져와 그립니다. | 위의 2가지에 comfyui_controlnet_aux와 OpenPose용 ControlNet 모델 |

캐릭터를 사용하는 템플릿은 [캐릭터를 등록해서 사용하기](04-improve.md#캐릭터를-등록해서-사용하기) 기능을 워크플로로 세밀하게 조정하고 싶을 때를 위한 것입니다. 보통은 생성 탭에서 등록한 캐릭터를 사용하면 충분합니다. 막대 인간의 자세는 [캔버스](05-canvas.md)의 '{{ui:pose.title}}'로 만들 수 있습니다.

## 확장 기능(노드 팩)

**{{ui:workflows.panel.packs}}** 탭에서는 ComfyUI에 확장 기능을 추가하거나 제거합니다. 확장 기능은 노드를 늘리기 위한 추가 부품입니다. 설치한 노드는 노드 추가 목록의 **{{ui:workflows.categories.extension}}**에 나옵니다.

처음에는 '{{ui:workflows.packs.whatToDo}}'의 큰 타일이 나열됩니다. 하고 싶은 일(얼굴을 깔끔하게 수정, 배경 지우기, 크고 고해상도로 만들기 등)을 선택하면 그에 맞는 확장 기능이 설명과 함께 나열됩니다.

1. 사용하고 싶은 확장 기능의 **{{ui:workflows.packs.install}}** 버튼을 누릅니다.
2. 설치가 끝나면 '{{ui:workflows.packs.restartNeeded}}'라고 나옵니다. **{{ui:workflows.packs.restart}}** 버튼을 누릅니다.
3. 다시 시작이 끝나면 그 확장 기능의 노드나 템플릿을 사용할 수 있습니다.

주의 사항이 있는 확장 기능이 있습니다. 'Git이 필요', '설치에 시간과 용량이 많이 든다', '업데이트가 중단되었다' 등입니다. 설치하기 전에 읽어 보세요.

카탈로그에 없는 것은 **{{ui:workflows.packs.byAddress}}**에서 GitHub 주소(https://github.com/사용자명/이름 형태)를 입력해서 설치할 수 있습니다. 그 밖에 설치되어 있는 확장 기능은 **{{ui:workflows.packs.others}}**에 나옵니다. 필요 없는 확장 기능은 **{{ui:workflows.packs.remove}}**로 제거할 수 있습니다(확인을 위해 한 번 더 누릅니다).

확장 기능은 워크플로 화면이 아니어도 언제든 볼 수 있습니다. 왼쪽 사이드바의 **{{ui:app.nav.extensions}}**(퍼즐 아이콘)을 누르면 **{{ui:workflows.packs.mgr.title}}**가 열립니다. 공개된 확장 기능이 카드로 나열되며, 왼쪽 목록의 **{{ui:workflows.packs.mgr.installed}}**·**{{ui:workflows.packs.mgr.notInstalled}}**·목적별로 좁히거나 위쪽 입력란에서 이름·제작자·설명으로 검색할 수 있습니다. **{{ui:workflows.packs.mgr.sort.label}}**은 처음에는 **{{ui:workflows.packs.mgr.sort.downloads}}**가 많은 순입니다. 카드에는 제작자·버전·업데이트 날짜·다운로드 수가 표시되고, 설치된 것에는 **{{ui:workflows.packs.installed}}**이 표시됩니다. 설치되지 않은 것은 카드의 **{{ui:workflows.packs.install}}**로 설치할 수 있습니다. 카드를 누르면 오른쪽에 상세가 열리고, **{{ui:workflows.packs.mgr.license}}**와 배포처를 확인하거나 **{{ui:workflows.packs.remove}}**를 할 수 있습니다. 목록에 없는 확장 기능은 위쪽의 **{{ui:workflows.packs.mgr.addTitle}}**에 GitHub 주소를 입력해 설치할 수 있습니다. 설치하거나 제거한 뒤에는 같은 화면의 **{{ui:workflows.packs.restart}}**을 누르면 반영됩니다. 각 카드의 상세 정보에는 **{{ui:agent.ask.button}}** 버튼이 있고, 검색창에 단어를 입력하면 **{{ui:agent.ask.resultsButton}}**도 나타납니다. 누르면 AI 어시스턴트가 그 확장 기능이 무엇을 하는지, 어떻게 쓰는지 설명합니다([AI 어시스턴트와 설정](09-assistant-settings.md) 참조).

상세의 **{{ui:workflows.packs.version.label}}**에는 지금 설치된 버전이 표시됩니다. 그 확장 기능의 저장소가 버전을 공개하고 있을 때만 **{{ui:workflows.packs.version.change}}**이 나타나며, 누르면 고를 수 있는 버전이 나열되고 **{{ui:workflows.packs.version.apply}}**으로 그 버전으로 바꿉니다. 지금 설치된 버전에는 **{{ui:workflows.packs.installed}}**이 표시됩니다. 버전을 공개하지 않는 확장 기능에는 이 버튼이 나오지 않습니다. 반영하려면 같은 화면의 **{{ui:workflows.packs.restart}}**을 누르세요. 다른 확장 기능이나 ComfyUI가 지원하지 않는다고 알려진 버전에는 **{{ui:workflows.packs.version.deprecated}}**이 표시되고, 무엇이 지원하지 않는지도 함께 적힙니다. 직접 넣은 확장 기능은 여기에서 버전을 바꿀 수 없습니다.

ComfyUI의 버전도 같은 화면에서 바꿀 수 있습니다. 목록 맨 앞의 **{{ui:workflows.packs.version.comfyTitle}}** 카드를 누르고, 오른쪽의 **{{ui:workflows.packs.version.change}}**으로 고를 수 있는 버전을 나열합니다. **{{ui:workflows.packs.version.apply}}**을 누른 뒤 한 번 더 **{{ui:workflows.packs.version.confirm}}**를 누르면 전환이 시작됩니다. 설치된 확장 기능을 모두 다시 설치하므로 몇 분이 걸리고, 끝날 때까지 이미지를 만들 수 없습니다. 새 버전이 시작되지 않으면 원래 버전으로 돌아갑니다.

> 확장 기능은 이 컴퓨터에서 동작하는 프로그램입니다. 출처를 알 수 없는 것은 설치하지 마세요.

> 앱이 관리하지 않는 ComfyUI를 연결하고 있을 때는 이 화면에서는 설치할 수 없습니다. 그 ComfyUI 쪽에서 설치하세요.

[그림 수정하고 다시 쓰기](04-improve.md)의 '{{ui:cutout.menu}}'나 '{{ui:facefix.menu}}' 등 확장 기능을 사용하는 기능은 필요해졌을 때 같은 방식으로 설치를 안내합니다.
