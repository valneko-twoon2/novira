# AI 어시스턴트, 설정, 단축키

이 장에서는 문장으로 전달하면 설정을 맞춰 주는 AI 어시스턴트와 설정 화면, 단축키 목록, 앱 정보 화면, 개발자 로그를 설명합니다.

설정 화면, 단축키, 앱 정보는 화면 왼쪽 아래의 **{{ui:app.nav.settingsMenu}}**에서 엽니다.

## AI 어시스턴트

![AI 어시스턴트 창. 사용할 AI를 선택해서 로그인하는 첫 화면](shot:agent)

왼쪽 내비게이션의 **AI** 버튼(**{{ui:agent.open}}**)를 누르면 **{{ui:agent.title}}** 창이 열립니다. 창은 제목 부분을 드래그해서 움직일 수 있습니다.

모델이나 LoRA를 선택하거나 프롬프트나 크기를 설정하는 대신 '석양의 해변에 서 있는 애니메이션풍 소녀'처럼 만들고 싶은 것을 문장으로 전달하면 어시스턴트가 설정을 골라서 넣어 줍니다.

### 사용 시작하기(로그인)

AI 어시스턴트는 novira가 직접 AI를 동작시키는 것이 아니라 이 컴퓨터에 있는 AI 명령(Claude 또는 Codex)을 호출해서 답을 만듭니다. 사용하려면 다음 준비가 필요합니다.

1. Anthropic의 **Claude** 또는 OpenAI의 **Codex** 중 어느 한쪽의 명령을 컴퓨터에 설치해 둡니다.
2. 어시스턴트를 열고 사용하고 싶은 쪽(**{{ui:agent.setup.claude}}** 또는 **{{ui:agent.setup.codex}}**)을 누릅니다.
3. 브라우저가 열리므로 거기에서 로그인합니다.

그 명령이 컴퓨터에서 발견되지 않을 때는 '○○ 명령이 이 컴퓨터에서 발견되지 않습니다. 먼저 설치하세요.'라는 안내가 나옵니다. 먼저 그 명령을 설치하세요.

사용하는 서비스와 계약은 선택한 쪽의 것입니다. novira는 API 키를 저장하지 않습니다. 주고받는 내용(보낸 문장, 현재 모델 목록이나 설정 등)은 선택한 서비스로 전송됩니다.

선택한 AI는 창 위쪽의 제목에 나옵니다. 바꾸고 싶을 때는 위쪽의 **{{ui:agent.changeProvider}}** 버튼을 누릅니다.

### 무엇을 해 주는가

어시스턴트가 문장에서 다음을 정해서 설정에 넣습니다. 넣은 내용은 답변 안에 목록으로 나옵니다.

| 내용 | 예 |
|---|---|
| 모델 선택 | 설치되어 있는 모델 중에서 맞는 것을 선택한다 |
| LoRA 추가 | 화풍에 맞는 LoRA를 추가한다 |
| 프롬프트 | 프롬프트와 네거티브 프롬프트를 쓴다 |
| 설정 변경 | 크기, 스텝 수, CFG, 스케줄러, 시드 |
| 워크플로 | 그래프를 만든다, 열려 있는 그래프를 고친다 |
| 텍스트 | **{{ui:media.tab.text}}**에서 열려 있는 글자나 말풍선을 고친다 |
| 동영상, 음악, 음성 | 각각의 화면의 설정을 바꾼다 |
| 만화 | **{{ui:app.tabs.comic}}**에서 컷 나누기, 컷 추가와 분할, 각 컷의 프롬프트와 포즈, 말풍선을 바꾼다(아래 '만화 도움받기') |
| 포즈 | **{{ui:app.tabs.canvas}}**에서, 문장으로 부탁한 포즈의 막대 인간을 놓는다([캔버스에서 덧그리기](05-canvas.md#캔버스에서-포즈-만들기)를 보세요) |
| 확장 기능 추천 | 하고 싶은 일에 맞는 확장 기능을 안내하고 버튼으로 설치할 수 있다 |
| 앱 사용법 | 화면에 표시된 이름으로 어디를 누르면 되는지 알려 줍니다 |
| 확장 기능 설명 | 확장 기능이 무엇을 하는지, 어떻게 쓰는지 설명 (아래 '사용법과 확장 기능 묻기' 참조) |

어느 화면을 열고 있는지를 어시스턴트는 보고 있습니다. 예를 들어 **{{ui:media.tab.text}}**를 열고 '글자를 세로쓰기로 해 줘'라고 전달하면 그 글자가 바뀝니다.

어시스턴트는 설정을 바꿀 뿐입니다. 그림은 만들지 않습니다. 결과를 보고 괜찮으면 답변의 **{{ui:agent.generate}}** 버튼을 누르면 그대로 만들기 시작합니다.

### 만화 도움받기

**{{ui:app.tabs.comic}}**를 연 상태에서 부탁하면, 어시스턴트는 열려 있는 페이지(컷의 모양, 각 컷의 프롬프트, 포즈, 말풍선)를 읽고 직접 고쳐 씁니다. 예를 들어 다음과 같이 부탁할 수 있습니다.

- '클라이맥스가 있는 5컷으로 해 줘. 1컷째를 크게, 비스듬히 나눠 줘'라고 부탁하면 컷 나누기를 만듭니다. 기본 템플릿을 쓸 때도 있고, 컷의 모양을 직접 정할 때도 있습니다.
- '이 이야기로 각 컷의 프롬프트를 써 줘'라고 부탁하면, 이야기의 흐름에 맞는 구도(클로즈업, 롱숏, 앙각 등)를 넣은 프롬프트를 컷마다 씁니다.
- '각 컷에 대사를 넣어 줘'라고 부탁하면 말풍선을 놓고 대사를 넣습니다.
- '2컷째의 여자아이를 달리는 포즈로 해 줘'라고 부탁하면 그 컷에 포즈를 붙입니다.

그림 자체는 그리지 않습니다. 프롬프트가 들어가면 **{{ui:comic.panel.draw}}**나 **{{ui:comic.page.drawAll}}**를 누르세요. **{{ui:agent.undo}}**를 누르면 그 답변으로 바뀐 만화 페이지가 한꺼번에 원래대로 돌아갑니다.

### 모델과 생각의 깊이 고르기

채팅 이름 오른쪽에 있는 뇌 모양의 작은 버튼을 누르면 어시스턴트가 쓰는 **{{ui:agent.model.label}}**과 **{{ui:agent.effort.label}}**를 고를 수 있습니다. 고른 것은 다음에 보내는 메시지부터 쓰입니다. Claude와 Codex는 각각 따로 기억합니다.

- Claude의 모델은 **{{ui:agent.model.default}}**, Fable, Opus, Sonnet, Haiku 중에서 고를 수 있습니다. **{{ui:agent.model.custom}}**을 누르면 모델 이름을 직접 입력할 수 있습니다. 생각의 깊이는 **{{ui:agent.effort.low}}**부터 **{{ui:agent.effort.max}}**까지 5단계입니다.
- Codex의 모델은 고를 수 없습니다(그 명령 자체의 설정을 따릅니다). 생각의 깊이는 **{{ui:agent.effort.low}}**, **{{ui:agent.effort.medium}}**, **{{ui:agent.effort.high}}**입니다.

**{{ui:agent.model.default}}**일 때는 그 명령 자체의 설정을 따릅니다.

### 템플릿 불러오기

입력란 맨 앞에 '/'를 입력하면 자주 쓰는 부탁의 템플릿이 목록으로 열립니다. '/'에 이어서 글자를 입력하면 이름, 명령, 문장 중 어딘가에 그 글자가 들어 있는 것만 남습니다(예: '/만화'나 '/comic').

위아래 화살표 키로 고르고 Enter나 Tab으로 정합니다. 목록의 행을 눌러도 정해집니다. 정한 템플릿의 문장이 입력란에 들어가므로, 뒷부분을 덧붙여 쓴 다음 보내세요(정하기만 해서는 보내지지 않습니다). Esc 키로 목록을 닫습니다.

### 사용법과 확장 기능 묻기

설정을 부탁하는 것 외에 질문도 할 수 있습니다. 예를 들어 '배경은 어떻게 지우나요?', '모델은 어디에서 추가하나요?'라고 물으면, 화면에 표시된 이름을 사용해 어디를 누르면 되는지 알려 줍니다. 답변은 지금 사용 중인 언어로 돌아옵니다.

확장 기능에 대해서도 물을 수 있습니다. 확장 기능이 무엇을 하는지, 언제 쓰면 좋은지, 어떻게 쓰는지를 쉬운 말로 설명합니다. 묻는 방법은 세 가지입니다.

- **{{ui:app.nav.extensions}}** 목록에서 카드를 눌러 상세 정보를 열고 **{{ui:agent.ask.button}}**를 누릅니다. 그 확장 기능에 대한 질문이 새 채팅으로 전송됩니다.
- **{{ui:app.nav.extensions}}** 위쪽 검색창에 단어를 입력하면 나타나는 **{{ui:agent.ask.resultsButton}}**를 누릅니다. 검색된 확장 기능(처음 8개까지)의 차이와 어느 것부터 써 보면 좋을지 알려 줍니다.
- 채팅에 확장 기능의 이름(영문)을 적어서 묻습니다. 공개된 확장 기능 중에서 이름이나 설명이 맞는 것을 찾아 답합니다(목록이 아직 로드되지 않았다면 먼저 로드합니다).

설치된 확장 기능이라면 추가되는 노드의 이름과 무엇에 연결하는지도 알려 줍니다. 아직 설치하지 않은 것은 답변에 카드가 붙으며, **{{ui:workflows.packs.install}}**로 바로 설치할 수 있습니다.

> 설명은 확장 기능의 공개된 소개문과 노드 정보를 바탕으로 합니다. 모르는 것은 '모르겠다'고 답하도록 되어 있지만, 틀릴 수도 있습니다. 설치하기 전에 배포처 페이지도 확인하세요.

### 되돌리기

설정을 넣은 답변에는 **{{ui:agent.undo}}** 버튼이 붙습니다. 누르면 그 답변 이전의 설정으로 돌아갑니다.

다만 앱을 다시 연 뒤에는 그 이전의 변경은 되돌릴 수 없습니다(버튼을 누를 수 없게 됩니다).

### 채팅 기록

어시스턴트와 주고받은 내용은 '채팅'으로 남습니다. 창 위쪽의 채팅 이름 부분을 누르면 **{{ui:agent.session.history}}** 목록이 열립니다.

- 목록에서 선택하면 그 채팅에서 이어서 대화할 수 있습니다.
- **{{ui:agent.session.rename}}**으로 이름을 붙일 수 있습니다.
- **{{ui:agent.session.delete}}**로 지울 수 있습니다.
- 옆의 **{{ui:agent.session.new}}**으로 새 채팅을 시작할 수 있습니다.

> 답변을 기다리는 동안에는 이어서 보낼 수 없습니다. '{{ui:agent.thinking}}' 표시가 사라질 때까지 기다리거나, 보내기 버튼 대신 나타나는 **{{ui:agent.stop}}** 버튼으로 취소하세요. 취소한 요청은 설정을 바꾸지 않습니다.

창의 네 변과 네 모서리 중 어디를 드래그해도 크기를 바꿀 수 있습니다. 오른쪽 아래 모서리에는 그 표시가 나타납니다. 크기는 기억됩니다. 답변에 AI가 요청을 어떻게 이해했는지가 붙어 있으면 답변 위에 한 줄로 표시됩니다. 누르면 전체가 펼쳐집니다(**{{ui:agent.thoughts.label}}**). 이것은 AI가 어떻게 이해하고 왜 그렇게 골랐는지를 짧게 요약한 것이며, AI의 내부 사고를 그대로 보여 주는 것은 아닙니다.

## 설정

![설정 화면. 일반, 계정, 생성, UI, 개발자 항목이 나열되어 있다](shot:settings)

왼쪽 아래의 **{{ui:app.nav.settingsMenu}}**에서 **{{ui:app.nav.settings}}**을 선택하면 설정 화면이 열립니다. 바꾼 내용은 바로 사용되며 앱을 닫아도 남습니다.

> 이 이미지는 브라우저에서 동작시키는 견본 화면입니다. 데스크톱 버전에만 있는 **{{ui:settings.uiZoom.label}}**은 담겨 있지 않습니다.

### {{ui:settings.section.general}}

| 항목 | 내용 |
|---|---|
| {{ui:settings.language.label}} | {{ui:settings.language.ja}}, {{ui:settings.language.en}}, {{ui:settings.language.zhcn}}, {{ui:settings.language.zhtw}}, {{ui:settings.language.ko}}, {{ui:settings.language.ru}}, {{ui:settings.language.es}}, {{ui:settings.language.ptbr}}, {{ui:settings.language.fr}}, {{ui:settings.language.de}} 중에서 선택합니다. 화면의 언어가 바로 전환됩니다 |
| {{ui:settings.theme.label}} | **{{ui:settings.theme.dark}}**(초기값) 또는 **{{ui:settings.theme.light}}** |

### {{ui:settings.section.accounts}}

모델 배포 사이트에 로그인이 필요할 때를 위한 입력란입니다. 입력한 내용은 암호화되어 이 컴퓨터에 저장되며 화면에는 표시되지 않습니다.

| 항목 | 내용 |
|---|---|
| {{ui:settings.civitaiKey.label}} | 로그인이 필요한 모델의 다운로드에 사용합니다 |
| {{ui:settings.hfToken.label}} | 접근 신청이 필요한 모델의 다운로드에 사용합니다 |

붙여넣고 **{{ui:settings.civitaiKey.save}}** 버튼을 누릅니다. 나중에 **{{ui:settings.civitaiKey.change}}**이나 **{{ui:settings.civitaiKey.remove}}**도 할 수 있습니다.

### {{ui:settings.section.generation}}

- **{{ui:settings.antialiasProgressImages}}**: 생성 도중의 그림을 갤러리의 '{{ui:gallery.generating.title}}' 틀에서 부드럽게 표시합니다. 끄면 거친 점 그대로 보입니다.
- **{{ui:settings.lowMemory.label}}**: GPU 메모리가 적은 컴퓨터용입니다. 켜면 모델을 GPU 메모리에 계속 두지 않으므로 적은 메모리로 만들 수 있지만, 만드는 속도는 느려집니다. 전환하면 엔진을 다시 시작합니다. 만드는 중인 항목이 있으면 엔진을 다음에 시작할 때부터 적용됩니다. 다른 곳에서 시작한 엔진에 연결되어 있을 때는 사용할 수 없습니다.

### {{ui:settings.section.ui}}

- **{{ui:settings.uiZoom.label}}**(데스크톱 버전 전용): 화면 전체의 크기입니다. 50%부터 300%까지 선택할 수 있습니다. `Ctrl`과 `+` / `-`로도 바꿀 수 있습니다.
- **{{ui:settings.confirmOnDelete}}**: 이미지를 지우기 전에 확인을 표시합니다. 확인 화면에서 '{{ui:common.dontAskAgain}}'를 선택했을 때도 여기가 꺼집니다.

### {{ui:share.backup.section}}

![설정 화면의 백업 영역. 백업을 만드는 버튼과 백업에서 복원하는 버튼](shot:settings-backup)

만든 그림과 앱 안에서 설정·등록한 것을 하나의 zip 파일로 묶어 저장할 수 있습니다. 다른 컴퓨터로 옮기거나 만일에 대비할 때 사용합니다.

- **{{ui:share.backup.createLabel}}**: 저장할 위치를 고르는 창이 열립니다. 파일 이름은 처음부터 'novira-backup-날짜-시각.zip'으로 되어 있습니다. 그림이 많으면 시간이 걸리며, 진행 상황이 이 영역에 표시됩니다.
- **{{ui:share.backup.restoreLabel}}**: 백업 zip 파일을 고릅니다. 내용을 확인한 뒤 확인 창이 나타납니다.

백업에 들어가는 것과 들어가지 않는 것은 다음과 같습니다.

| 들어가는 것 | 들어가지 않는 것 |
|---|---|
| 갤러리의 그림·동영상·오디오와 그 썸네일 | 모델 |
| 보드, 워크플로, 만화, 대기열 기록 | 이미지 엔진(ComfyUI)과 확장 기능 |
| 캐릭터, 프리셋, 프롬프트 목록, 초안, AI 채팅, 화면 설정 | API 키와 토큰, ComfyUI 위치 등 컴퓨터마다 다른 설정 |

![복원 확인 창. 백업을 만든 날짜와 시각, 내용의 개수, 교체에 대한 주의가 표시되어 있다](shot:restore-confirm)

확인 창에는 백업을 만든 날짜와 시각, 들어 있는 이미지·보드·워크플로의 개수가 표시됩니다. **{{ui:share.backup.confirm}}**을 누르면 앱이 한 번 종료된 뒤 다시 시작되고, 현재 데이터가 백업 내용으로 교체됩니다. 실패했을 때는 원래 데이터로 되돌리고 그 사실을 알려 줍니다.

> 교체된 데이터는 되돌릴 수 없습니다. 필요하면 복원하기 전에 현재 상태의 백업을 만드세요. API 키와 토큰은 이 컴퓨터 전용으로 암호화되어 있으므로, 복원한 뒤 **{{ui:settings.section.accounts}}**에서 다시 입력하세요. 브라우저에서 열었을 때는 이미지를 포함하지 않는 JSON 파일을 다운로드하며, 복원은 할 수 없습니다.

### {{ui:settings.section.developer}}

- **{{ui:settings.showDevLog}}**: 왼쪽 내비게이션에 {{ui:app.devlog.short}} 버튼을 표시합니다(아래의 '개발자 로그'를 참조).
- **{{ui:settings.clearIntermediates}}**: 캔버스의 중간 결과 등 갤러리에 나오지 않는 이미지를 지웁니다. 지우는 수가 버튼에 나옵니다.
- **{{ui:settings.resetWebUi}}**: 화면의 설정과 상태를 초기값으로 되돌립니다. 이미지와 모델은 지워지지 않습니다. 누른 뒤 **{{ui:settings.resetConfirm}}**로 확정하고 **{{ui:settings.reload}}**으로 다시 불러옵니다.

설정 화면에는 이 밖에도 '{{ui:settings.useCpuNoise}}', '{{ui:settings.enableInformationalPopovers}}', '{{ui:settings.enableImageDebugging}}', '{{ui:settings.clearIntermediatesOnStartup}}' 스위치가 있습니다. 이것들은 현재 버전에서는 생성이나 화면의 동작을 바꾸지 않습니다.

화면 맨 아래에는 앱의 버전이 나옵니다.

## 단축키

![단축키 목록. 앱, 캔버스 등의 분류별로 조작과 키가 나열되어 있다](shot:hotkeys)

왼쪽 아래의 **{{ui:app.nav.settingsMenu}}**에서 **{{ui:app.nav.hotkeys}}**를 선택하거나 `Shift+?`로 목록이 열립니다. 위쪽 검색란에서 조작 이름이나 키로 찾을 수 있습니다.

여기에 자주 쓰는 것을 정리합니다. 전부는 화면의 목록에서 확인하세요.

### 앱 전체

| 키 | 조작 |
|---|---|
| `Ctrl+Enter` | 생성(대기열에 추가) |
| `Ctrl+Shift+Enter` | 대기열의 맨 앞에 추가해서 생성 |
| `Shift+X` | 처리 중인 항목 취소 |
| `Ctrl+Shift+X` | 대기열을 모두 지우기 |
| `Alt+A` | 프롬프트 입력란으로 이동 |
| `T` | 왼쪽 패널 열고 닫기 |
| `G` | 오른쪽 패널 열고 닫기 |
| `F` | 좌우 패널을 한꺼번에 열고 닫기 |
| `1` ~ `9`, `0` | 번호의 탭으로 이동 |
| `Shift+?` | 단축키 목록 열기 |
| `Ctrl` + `+` / `-` | 화면 전체를 확대, 축소 |

### 캔버스

| 키 | 조작 |
|---|---|
| `B` | {{ui:settings.hotkeys.canvas.brush}} |
| `E` | {{ui:settings.hotkeys.canvas.eraser}} |
| `U` | {{ui:settings.hotkeys.canvas.rect}} |
| `V` | {{ui:settings.hotkeys.canvas.move}} |
| `C` | {{ui:settings.hotkeys.canvas.bbox}} |
| `H` | 보기 이동 |
| `I` | {{ui:settings.hotkeys.canvas.colorPicker}} |
| `[` / `]` | 브러시를 작게, 크게 |
| `Ctrl+Z` | {{ui:settings.hotkeys.canvas.undo}} |
| `Ctrl+Shift+Z`, `Ctrl+Y` | {{ui:settings.hotkeys.canvas.redo}} |
| `Q` | 직전에 사용한 도구와 전환 |
| `Enter`, `Esc` | {{ui:settings.hotkeys.canvas.acceptStaged}}, {{ui:settings.hotkeys.canvas.discardStaged}} |

### 갤러리와 뷰어

| 키 | 조작 |
|---|---|
| 화살표 키 | {{ui:settings.hotkeys.gallery.navigate}} |
| `Ctrl+A` | {{ui:settings.hotkeys.gallery.selectAll}} |
| `Esc` | {{ui:settings.hotkeys.gallery.clearSelection}} |
| `.` | {{ui:settings.hotkeys.gallery.star}} |
| `I` | {{ui:settings.hotkeys.viewer.toggleMetadata}} |
| `R` | {{ui:settings.hotkeys.viewer.remix}}(시드 이외를 불러오기) |
| `P`, `S`, `A` | 프롬프트, 시드, 전부를 불러오기 |
| `W` | {{ui:settings.hotkeys.viewer.loadWorkflow}} |
| `Shift+U` | {{ui:settings.hotkeys.viewer.upscale}} |
| `C` | {{ui:settings.hotkeys.viewer.compare}} |
| `Delete` | {{ui:settings.hotkeys.viewer.delete}} |
| `Ctrl+0`, `Ctrl+1` | {{ui:settings.hotkeys.viewer.zoomFit}}, {{ui:settings.hotkeys.viewer.zoomActual}} |

### 워크플로

| 키 | 조작 |
|---|---|
| `Shift+A`, `Space` | {{ui:settings.hotkeys.workflows.addNode}} |
| `Delete` | 선택한 노드와 연결 삭제 |
| `Ctrl+C`, `Ctrl+V` | {{ui:settings.hotkeys.workflows.copy}}, {{ui:settings.hotkeys.workflows.paste}} |
| `Ctrl+S` | {{ui:settings.hotkeys.workflows.save}} |
| `Ctrl+Z`, `Ctrl+Shift+Z` | {{ui:settings.hotkeys.workflows.undo}}, {{ui:settings.hotkeys.workflows.redo}} |

문자를 입력하는 중에는 `T`나 `G` 같은 한 글자 키는 동작하지 않습니다.

## 이 앱에 대하여

![앱 정보 화면. 로고, 버전, 라이선스, 사용 중인 오픈 소스 목록](shot:about)

왼쪽 아래의 **{{ui:app.nav.settingsMenu}}**에서 **{{ui:app.nav.about}}**를 선택하면 위쪽에 앱 이름, 버전, 라이선스, 저작권 표시가 나옵니다. 그 아래는 두 개의 탭으로 나뉩니다.

- **{{ui:settings.about.license.title}}**: novira 라이선스(Apache License 2.0)의 전문입니다. 설치 폴더에도 같은 파일(`LICENSE`)이 있습니다.
- **{{ui:settings.about.oss.title}}**: 앱이 사용하는 오픈 소스 소프트웨어 목록입니다. 각 행에 이름과 버전이 표시됩니다. **{{ui:settings.about.oss.showLicense}}**를 누르면 그 아래에 라이선스 전문이 나옵니다(다시 누르면 닫힙니다). **{{ui:settings.about.oss.homepage}}**를 누르면 해당 페이지가 브라우저에서 열립니다. 생성 엔진과 확장 기능은 앱에 포함되어 있지 않으므로 라이선스 전문은 홈페이지에서 확인하세요.

목록 위의 버튼으로 **{{ui:settings.about.oss.short.frontend}}**, **{{ui:settings.about.oss.short.backend}}**, **{{ui:settings.about.oss.short.engine}}**, **{{ui:settings.about.oss.short.packs}}**(지금 설치된 확장 기능)로 좁힐 수 있습니다. 검색란에서는 이름으로 찾을 수 있습니다. 포함된 소프트웨어의 라이선스 전문은 설치 폴더의 `THIRD_PARTY_NOTICES.txt`에도 모여 있습니다.

확장 기능(ComfyUI의 커스텀 노드)과 모델은 설치할 때 각 배포처의 라이선스를 따릅니다.

## 개발자 로그

뭔가 잘 되지 않을 때 원인을 찾기 위한 로그입니다. 평소에는 사용하지 않아도 됩니다.

**{{ui:settings.title}}**의 **{{ui:settings.showDevLog}}**를 켜면 왼쪽 내비게이션에 '{{ui:app.devlog.short}}' 버튼이 나옵니다. 누르면 오른쪽에 **{{ui:app.devlog.title}}** 패널이 열립니다.

여기에는 앱 내부의 기록(백엔드 로그), 화면의 경고, 붙잡지 못한 오류가 시각과 함께 나열됩니다.

- 위쪽 선택으로 **{{ui:app.devlog.level.all}}**, **{{ui:app.devlog.level.warn}}**, **{{ui:app.devlog.level.error}}**으로 좁힐 수 있습니다.
- 좁히기 입력란에 말을 입력하면 그 말을 포함하는 줄만 나옵니다.
- **{{ui:app.devlog.copy}}**로 나와 있는 줄을 문장으로 복사할 수 있습니다. 문제를 보고할 때 붙여넣어서 사용할 수 있습니다.
- **{{ui:app.devlog.clear}}**로 지울 수 있습니다.

> 로그는 앱을 열고 있는 동안의 기록입니다. 닫으면 화면의 로그는 사라집니다. 자세한 조사 방법은 [문제가 생겼을 때](10-troubleshooting.md)를 보세요.

