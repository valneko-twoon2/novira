# 에이전트, 설정, 단축키

이 장에서는 문장으로 전달하면 설정을 맞춰 주는 에이전트와 설정 화면, 단축키 목록, 앱 정보 화면, 개발자 로그를 설명합니다.

설정 화면, 단축키, 앱 정보는 화면 왼쪽 아래의 **{{ui:app.nav.settingsMenu}}** 메뉴에서 엽니다.

## 에이전트

![오른쪽 패널의 에이전트. 사용할 AI를 선택해서 로그인하는 첫 화면](shot:agent)

오른쪽 패널 위쪽의 **{{ui:app.right.assistant}}** 탭을 누르면 갤러리와 교체되어 **{{ui:agent.title}}** 화면이 나옵니다. {{ui:app.tabs.generate}}, {{ui:app.tabs.canvas}}, {{ui:app.tabs.upscaling}}, {{ui:app.tabs.workflows}} 화면에서 사용할 수 있고, 화면을 옮겨도 채팅과 쓰던 문장은 그대로 남아 있습니다. **{{ui:app.right.gallery}}** 탭을 누르면 갤러리로 돌아갑니다. {{ui:app.nav.extensions}} 화면에서 에이전트에게 질문했을 때는 화면 위에 창으로 열립니다. 이 창은 질문한 화면에만 나오며, {{ui:app.tabs.models}}, {{ui:app.tabs.browse}} 등 다른 화면으로 옮기면 나오지 않습니다. 창은 제목 부분을 드래그해서 움직일 수 있습니다.

모델이나 LoRA를 고르고 프롬프트나 크기를 설정하는 대신, '노을 지는 바닷가에 서 있는 애니메이션 풍의 소녀'처럼 만들고 싶은 것을 문장으로 전달하면 에이전트가 설정을 골라서 입력해 줍니다.

### 사용 시작하기(로그인)

에이전트는 novira가 직접 AI를 실행하는 것이 아니라, 사용자의 PC에 있는 AI 명령(Claude 또는 Codex)을 호출해서 답을 만듭니다. 사용하려면 다음 준비가 필요합니다.

1. Anthropic의 **Claude** 또는 OpenAI의 **Codex** 중 한쪽의 명령을 PC에 설치해 둡니다.
2. 에이전트를 열고 사용하려는 쪽(**{{ui:agent.setup.claude}}** 또는 **{{ui:agent.setup.codex}}**)을 누릅니다.
3. 브라우저가 열리면 거기서 로그인합니다.

그 명령이 PC에서 발견되지 않으면 '○○ 명령을 이 PC에서 찾을 수 없습니다. 먼저 설치하세요.'라는 안내가 나옵니다. 먼저 그 명령을 설치하세요.

사용하는 서비스와 계약은 사용자가 선택한 쪽의 것입니다. Claude와 Codex에서는 novira가 API 키를 저장하지 않습니다. 주고받는 내용(보낸 문장과, 에이전트가 작업을 위해 읽은 앱의 정보. 예를 들어 모델 목록, 설정, 열려 있는 만화나 텍스트의 내용)은 선택한 서비스로 전송됩니다. 갤러리 이미지의 정보와 생성 탭의 프롬프트는 사용자가 허용했을 때만 읽습니다(아래의 '이미지와 프롬프트를 읽는 허가').

선택한 AI는 에이전트의 맨 위 줄에 나옵니다. 바꾸고 싶을 때는 그 줄 오른쪽의 **{{ui:agent.changeProvider}}** 버튼을 누릅니다.

### Ollama 등의 서버에 연결하기

![서버에 연결하는 화면. Ollama 버튼, 주소, 모델, 연결 테스트 결과](shot:agent-server)

Claude와 Codex 외에, 이 PC나 네트워크 상에서 동작하는 OpenAI 호환 API를 가진 서버(Ollama나 LM Studio 등)도 에이전트에 사용할 수 있습니다. novira가 서버에 답을 요청하고 에이전트의 도구(설정이나 편집기 조작 등)도 직접 실행하므로, 도구 호출을 지원하는 모델이 필요합니다.

연결하는 순서는 다음과 같습니다.

1. 에이전트를 열고 **{{ui:agent.setup.openai}}** 버튼을 누릅니다.
2. 사용할 서버의 버튼(Ollama라면 **Ollama** 버튼)을 누릅니다. 주소가 입력되고 서버에 있는 모델 목록을 불러옵니다. 다른 서버는 **{{ui:agent.endpoint.address}}** 항목에 보통 '/v1'로 끝나는 주소를 입력합니다.
3. **{{ui:agent.endpoint.model}}** 항목은 목록에서 고릅니다. 서버가 목록을 주지 않을 때는 이름을 입력합니다.
4. 서버가 키를 요구할 때는 **{{ui:agent.endpoint.key}}** 항목에 입력합니다. 키는 이 PC에 암호화하여 저장되며 이 서버에만 전송됩니다. 자신의 PC에 있는 서버에는 보통 필요하지 않습니다.
5. **{{ui:agent.endpoint.test}}** 버튼을 누릅니다. 서버가 응답하는지, 모델이 있는지, 그 모델이 앱의 도구를 호출할 수 있는지 확인합니다.
6. **{{ui:agent.endpoint.use}}** 버튼을 누릅니다.

모델이 도구를 호출할 수 없을 때는 테스트에서 그렇게 표시되고 서버가 돌려준 이유도 나옵니다. 입력칸 위에도 경고가 남고 메시지 전송은 거부됩니다. 채팅 이름 옆의 버튼으로 다른 모델을 선택하면 다시 확인할 수 있습니다. 서버의 컨텍스트(한 번에 읽을 수 있는 길이)가 에이전트의 요청에 부족할 때도 같은 식으로 테스트가 실패합니다. Ollama의 기본 설정이 그렇습니다. 서버의 컨텍스트 길이를 32768 이상으로 하고(Ollama의 설정 또는 환경 변수 OLLAMA_CONTEXT_LENGTH로) 다시 **{{ui:agent.endpoint.test}}** 버튼을 누르세요. novira는 도구를 사용할 수 있는 척하지 않습니다.

서버를 사용하고 있을 때는 채팅의 제목에 OpenAI API라고 나옵니다. **{{ui:agent.changeProvider}}** 버튼을 누르면 선택 화면으로 돌아갑니다. 입력한 서버는 양식에 남아 있습니다.

이 PC 밖에 있는 서버에는 사용자가 보낸 내용과, 허가한 경우 에이전트가 읽은 내용이 네트워크를 통해 전송됩니다. 그런 서버에는 주소 아래에 경고가 나옵니다. https를 사용하지 않는 서버에서는 키를 포함한 모든 것이 암호화되지 않은 채 흐르기 때문에 그 경고도 나옵니다. '{{ui:agent.permission.title}}' 확인 창에는 읽은 내용이 어디로 전송되는지도 나옵니다. 서버의 응답은 그냥 문장으로 취급하며, 요청은 Claude나 Codex와 같은 확인을 통과한 것만 실행됩니다.

### 무엇을 해 주는가

에이전트가 사용자의 문장에서 다음 사항을 정해 설정에 넣습니다. 넣은 내용은 응답 안에 목록으로 나옵니다.

| 내용 | 예 |
|---|---|
| 모델 선택 | 설치된 모델 중에서 맞는 것을 고름 |
| LoRA 추가 | 화풍에 맞는 LoRA를 추가함 |
| 프롬프트 | 프롬프트와 네거티브 프롬프트를 씀 |
| 설정 변경 | 크기, 스텝 수, CFG, 스케줄러, 시드 |
| 워크플로 | 그래프를 만들거나 열려 있는 그래프를 고침(ComfyUI 본체의 노드를 사용한 음악, 동영상, 음성 그래프도 구성합니다. 실행하는 것은 사용자이며 **{{ui:params.invoke.invoke}}** 버튼을 누릅니다) |
| 텍스트 | **{{ui:media.tab.text}}** 화면에서 열려 있는 글자나 말풍선을 고침 |
| 동영상, 음악, 음성 | 각각의 화면에서 설정을 바꿈 |
| 만화 | **{{ui:app.tabs.comic}}** 화면에서 컷 나누기, 컷의 추가와 분할, 각 컷의 프롬프트와 포즈, 말풍선을 바꿈(아래의 '만화 도와받기') |
| 포즈 | **{{ui:app.tabs.canvas}}** 화면에서 문장으로 요청한 포즈의 막대 인간을 놓음([캔버스](05-canvas.md#캔버스에서-포즈-만들기)를 보세요) |
| 생성 | 요청했을 때(와 아래의 시험 그리기)만 현재 설정이나 만화의 컷을 생성 대기열에 넣음 |
| 확장 기능 추천 | 하고 싶은 일에 맞는 확장 기능을 안내하고 버튼으로 설치할 수 있음 |
| 앱 사용법 | 화면의 이름을 사용해 어디를 눌러야 하는지 답함 |
| 확장 기능 설명 | 무엇을 할 수 있고 어떻게 사용하는지 설명함(아래의 '사용법이나 확장 기능 질문하기') |

에이전트는 어느 화면을 열고 있는지를 보고 있습니다. 예를 들어 **{{ui:media.tab.text}}** 화면을 열고 '글자를 세로쓰기로 해 줘'라고 전달하면 그 글자가 바뀝니다.

에이전트는 바꾼 내용을 작업하면서 바로 화면에 넣습니다. 작업 중에는 바꾼 내용이 '{{ui:agent.thinking}}' 아래에 차례로 나옵니다. 그림이나 동영상은 요청했을 때만 만듭니다(생성 대기열에 넣습니다). 요청하지 않으면 설정만 바꾸므로, 결과를 보고 괜찮으면 응답의 **{{ui:agent.generate}}** 버튼을 누르면 그대로 만들기 시작합니다. 만화를 열고 있을 때는 그 옆에 '전체 페이지 생성' 버튼도 나옵니다. 누르면 프롬프트가 있는 컷을 전체 페이지 분량 한꺼번에 대기열에 넣습니다(누르지 않으면 넣지 않습니다). 이미지를 지우거나 모델이나 확장 기능을 설치하지는 않습니다(확장 기능은 추천만 합니다). 응답 안의 굵은 글씨, 글머리 기호 목록, 표 등은 기호 그대로가 아니라 그 형태로 표시됩니다.

### 되묻기와 시험 그리기

요청한 내용에서 어느 인물을 바꿀지, 배경인지 인물인지, 머리 모양인지 머리 색인지처럼 결과가 크게 달라지는 부분을 알 수 없을 때는 에이전트가 바꾸기 전에 되묻습니다. 대답하면 그대로 바꿉니다. 고쳐 준 뒤에 '앞의 것이 더 좋았어', '그 아이는 그대로 두면 됐어'라고 전달하면, 에이전트는 이 채팅에서 바꾸기 전의 상태를 확인해 그 부분을 원래대로 되돌립니다(앱을 닫으면 바꾸기 전의 상태를 알 수 없게 됩니다).

'여름 같은 분위기로'처럼 말만으로는 전해지기 어려운 모습을 요청했을 때는 에이전트가 1장만 시험 삼아 생성하고, 그 이미지를 보고 '이런 분위기인가요?'라고 확인하는 경우가 있습니다. 시험 이미지는 응답 아래에 나옵니다. 이미지를 볼 때는 아래의 '이미지와 프롬프트를 읽는 허가'와 같은 확인 창이 나옵니다. 시험 그리기를 시키고 싶지 않을 때는 설정의 **{{ui:settings.assistantTrial.label}}** 항목을 끕니다(아래의 '설정').

### 만화 도와받기

**{{ui:app.tabs.comic}}** 화면을 연 상태에서 요청하면 에이전트는 열려 있는 페이지(컷의 모양, 각 컷의 프롬프트, 포즈, 말풍선)를 읽고 직접 고칩니다. 예를 들어 다음과 같이 요청할 수 있습니다.

- '볼거리가 있는 5컷으로 해 줘. 1컷을 크게, 비스듬하게 나눠'라고 요청하면 컷 나누기를 만듭니다. 특별히 모양을 정하지 않고 요청하면 실제 만화처럼 단의 높이나 컷의 폭을 들쭉날쭉하게 하고, 볼거리가 있는 컷을 크게 잡으며, 장면에 따라 비스듬한 경계나 종이 끝까지 뻗는 컷을 넣은 컷 나누기로 만듭니다. 컷 사이는 위아래를 좌우보다 넓게 띄웁니다. 페이지마다 나누는 방식을 바꿉니다. 표준 템플릿을 사용하기도 하고 컷의 모양을 직접 정하기도 합니다.
- '이 이야기로 각 컷의 프롬프트를 써 줘'라고 요청하면 이야기의 흐름에 맞는 구도(클로즈업, 롱샷, 로앵글 등)를 넣은 프롬프트를 컷마다 씁니다.
- '이 이야기로 각 컷의 지문을 써 줘'라고 요청하면 컷마다 장면(장소, 시간, 누가 무엇을 하는가)을 문장으로 씁니다.
- '각 컷에 대사를 넣어 줘'라고 요청하면 말풍선을 놓고 대사를 넣습니다. 대사가 말풍선 밖으로 튀어나올 때는 글자를 작게 해서 말풍선에 맞춥니다.
- '2컷의 여자아이를 달리는 포즈로 해 줘'라고 요청하면 그 컷에 포즈를 줍니다. 등장인물(각 캐릭터의 모습)도 써서 어느 컷에서나 얼굴과 옷이 일치하도록 합니다. 말풍선은 말하는 사람 옆에 다른 사람과 겹치지 않는 크기로 놓습니다.
- '새로 만화를 만들어서 30페이지 분량의 컷 나누기를 구성해 줘'라고 요청하면 만화를 새로 만들고 페이지를 추가해서 컷 나누기, 프롬프트, 대사를 끝까지 진행합니다. 다른 화면에서 요청해도 만화 화면으로 전환하여 작업합니다. 긴 작업이라도 한 번의 요청 안에서 끝날 때까지 계속합니다. 도중에 그만둘 때는 **{{ui:agent.stop}}** 버튼을 누릅니다.

그림은 요청했을 때만 그립니다(그리기 대기열에 넣습니다). 요청하지 않으면 프롬프트가 들어간 뒤에 **{{ui:comic.panel.draw}}**, **{{ui:comic.page.drawAll}}**, **{{ui:comic.comic.drawAll}}** 중 하나를 누르세요. '전체 페이지를 그려 줘'라고 요청하면 전체 페이지의 모든 컷을 한꺼번에 대기열에 넣습니다. 응답 아래의 '전체 페이지 생성' 버튼으로도 같습니다. **{{ui:agent.undo}}** 버튼을 누르면 그 응답으로 바뀐 만화 페이지가 한꺼번에 원래대로 돌아갑니다.

### 이미지 첨부하기

메시지에 이미지를 붙여서 '이 이미지를 바탕으로 프롬프트를 생각해 줘'처럼 요청할 수 있습니다.

- 입력칸 왼쪽의 클립 버튼(**{{ui:agent.attach.add}}**)으로 PC의 이미지를 선택합니다.
- 갤러리의 이미지나 PC의 이미지 파일을 입력칸으로 드래그해서 놓아도 붙일 수 있습니다.
- 복사한 이미지를 입력칸에 붙여 넣어도 붙일 수 있습니다.

붙인 이미지는 입력칸 위에 나열되며 오른쪽 위의 ×로 뺄 수 있습니다. 한 메시지에 4장까지 붙일 수 있습니다. 글을 쓰지 않고 이미지만 보내면 '{{ui:agent.attach.defaultAsk}}'라고 요청한 것이 됩니다. PC에서 붙인 이미지는 갤러리에도 들어갑니다. 이미지는 그 메시지와 함께 선택한 AI(Claude, Codex, 연결한 서버)로 전송됩니다. 이후의 메시지에는 따라가지 않으므로 같은 이미지에 대해 다시 요청할 때는 한 번 더 붙이세요. 이미지를 읽을 수 없는 모델에서는 제대로 답하지 못합니다.

### 이미지와 프롬프트를 읽는 허가

갤러리 이미지의 정보(프롬프트나 모델 등)와 생성 탭의 프롬프트 칸에는 보여 주고 싶지 않은 내용이 있을 수 있습니다. 그래서 에이전트가 이것들을 읽으려 하면 처음에는 채팅 안에 '{{ui:agent.permission.title}}' 확인 창이 나옵니다. 무엇을 읽으려 하는지도 나옵니다.

- **{{ui:agent.permission.once}}**: 이번 1회만 읽게 합니다. 다음에 읽으려 할 때는 다시 확인 창이 나옵니다.
- **{{ui:agent.permission.always}}**: 앞으로는 확인 없이 읽게 합니다(설정이 **{{ui:settings.assistantRead.always}}**(으)로 바뀝니다).
- **{{ui:agent.permission.deny}}**: 읽게 하지 않습니다. 에이전트는 읽지 않고 작업을 계속하거나 무엇이 필요한지 답합니다.

만화 화면을 열고 있을 때는 에이전트가 다 그린 페이지의 그림을 보는 경우가 있습니다(요청을 받아 인물의 모습이나 말풍선을 확인하기 위해). 이때도 같은 확인 창이 나오며, 허가했을 때만 페이지의 그림이 전송됩니다. 다른 화면에서는 보지 않습니다.

확인할지 여부는 설정의 **{{ui:settings.tab.generation}}** 탭의 **{{ui:settings.section.assistant}}** 항목에 있는 **{{ui:settings.assistantRead.label}}** 설정에서 바꿀 수 있습니다(아래의 '설정'). 만화, 텍스트, 워크플로, 동영상·음악·음성 화면, 캔버스의 포즈처럼 에이전트가 고쳐 주는 화면의 내용은 확인 없이 읽습니다.

### Wikipedia에서 조사하기

이야기를 만들 때(시대, 복장, 장소, 직업, 용어 등) 에이전트는 일본어 또는 영어 Wikipedia에서 사실을 조사하고, 문서의 첫머리를 최대 3건까지 읽을 수 있습니다. PC 밖으로 나가는 것은 짧은 검색어뿐이며 전송처는 Wikipedia뿐입니다. 전송하는 것은 앱 본체이며, 화면이 직접 연결되는 일은 없습니다. 검색어가 인터넷으로 나가므로 조사하기 전에 채팅에서 '{{ui:agent.permission.webTitle}}' 확인 창이 나오고, 보낼 검색어도 표시됩니다.

- **{{ui:agent.permission.once}}**: 이번만 조사하게 합니다. 다음에 조사하려 하면 다시 확인합니다.
- **{{ui:agent.permission.always}}**: 이후에는 확인 없이 조사하게 합니다(설정이 **{{ui:settings.assistantRead.always}}**(으)로 바뀝니다).
- **{{ui:agent.permission.deny}}**: 조사하게 하지 않습니다. 에이전트는 아는 범위에서 진행하며, 그 요청 동안에는 다시 요청하지 않습니다.

이것은 별도의 설정으로, 설정의 **{{ui:settings.tab.generation}}** 탭의 **{{ui:settings.section.assistant}}** 항목에 있는 **{{ui:settings.assistantWeb.label}}** 설정입니다. 이미지 읽기를 허가해도 조사는 허가되지 않습니다(반대도 마찬가지입니다). Wikipedia의 글은 CC BY-SA 4.0 라이선스이므로, 에이전트는 사실을 사용할 때 원래 문서의 이름을 알려 줍니다. 답이 틀릴 때도 있으므로 중요한 것은 확인하세요.

### 모델과 사고의 깊이 선택하기

채팅 이름 오른쪽에 있는 뇌 모양의 작은 버튼을 누르면 에이전트가 사용할 **{{ui:agent.model.label}}**과 **{{ui:agent.effort.label}}**을 선택할 수 있습니다. 선택한 것은 다음에 보내는 메시지부터 사용됩니다. Claude와 Codex에서 따로따로 기억해 둡니다.

- Claude의 모델은 Fable 5.1, Opus 5.5, Sonnet 5.5, Haiku 5.5 중에서 고를 수 있습니다. 이름 그대로의 버전이 사용됩니다. 사고의 깊이는 **{{ui:agent.effort.low}}**부터 **{{ui:agent.effort.max}}**까지 5단계입니다.
- Codex의 모델은 Codex가 사용자의 계정에서 사용할 수 있다고 하는 모델의 목록에서 고를 수 있습니다(목록은 Codex가 PC에 저장한 것을 읽습니다). 사고의 깊이는 선택한 모델이 받아들이는 것만 나옵니다(**{{ui:agent.effort.ultra}}**까지 받아들이는 모델도 있습니다).
- 서버에서는 서버가 목록으로 제공하는 모델이 나옵니다. 이름을 입력할 수도 있습니다. 사고의 깊이는 없습니다. 모델은 서버 설정의 일부이므로 다른 모델을 선택하면 그것이 저장됩니다.

아직 선택하지 않았을 때는 Claude에서는 Sonnet 5.5, Codex에서는 목록의 첫 모델이 선택되어 있으며 버튼에도 그 이름이 나옵니다. 버튼에 나와 있는 이름의 모델이 항상 답합니다(Codex가 목록을 저장하지 않았을 때만 **{{ui:agent.model.default}}**라고 나오며 Codex가 모델을 정합니다). 사고의 깊이는 항상 어느 하나가 선택되어 있습니다. 처음에는 모델별 표준 깊이가 선택되어 있으며, 다른 모델로 바꿨을 때 지금의 깊이를 그 모델이 받아들이지 않으면 그 모델의 표준 깊이로 돌아갑니다.

### 입력칸의 높이 바꾸기

입력칸 위쪽 가장자리에 있는 가로로 긴 핸들을 위로 드래그하면 입력칸이 높아지고, 아래로 드래그하면 낮아집니다. 핸들을 선택하고 위아래 화살표 키를 눌러도 바꿀 수 있습니다. 높이는 다음에 열었을 때도 같습니다.

### 템플릿 불러오기

입력칸의 맨 앞에 '/'를 입력하면 자주 쓰는 요청 방식의 템플릿이 목록으로 열립니다. '/'에 이어서 글자를 입력하면 이름, 명령, 문장 중 어딘가에 그 글자를 포함한 것만으로 좁혀집니다(예를 들어 '/만화'나 '/comic').

위아래 화살표 키로 고르고 Enter나 Tab으로 결정합니다. 목록의 행을 눌러도 결정됩니다. 결정한 템플릿의 문장이 입력칸에 들어가므로 이어서 쓸 내용을 덧붙인 다음 보내세요(결정만 해서는 전송되지 않습니다). Esc 키로 목록을 닫습니다.

### 사용법이나 확장 기능 질문하기

설정을 요청할 뿐 아니라 질문도 할 수 있습니다. 예를 들어 '배경을 지우려면 어떻게 해?', '모델을 추가하려면 어디를 눌러?'처럼 물으면 화면에 나와 있는 이름을 사용해서 어디를 눌러야 하는지 답합니다. 답은 지금 사용하는 언어로 돌아옵니다.

확장 기능에 대해서도 물을 수 있습니다. 무엇을 할 수 있는지, 어떤 때 사용하는지, 어떻게 사용하는지를 쉬운 말로 설명합니다. 묻는 방법은 3가지가 있습니다.

- **{{ui:app.nav.extensions}}** 목록에서 카드를 눌러 상세를 열고 **{{ui:agent.ask.button}}** 버튼을 누릅니다. 그 확장 기능에 대해 묻는 질문이 새 채팅으로 전송됩니다.
- **{{ui:app.nav.extensions}}** 위쪽의 검색칸에 말을 입력하면 나오는 **{{ui:agent.ask.resultsButton}}** 버튼을 누릅니다. 검색된 확장 기능(처음 8건까지)의 차이와 어느 것부터 시도하면 좋은지 답합니다.
- 채팅에 확장 기능의 이름(영문)을 써서 묻습니다. 공개되어 있는 확장 기능 중에서 이름이나 설명이 일치하는 것을 찾아서 답합니다(목록이 아직 불러와지지 않았다면 그때 불러옵니다).

설치되어 있는 확장 기능이라면 추가되는 노드의 이름과 무엇에 연결하는지도 답합니다. 아직 설치되지 않은 것은 응답에 카드가 붙으며 **{{ui:workflows.packs.install}}** 버튼으로 그대로 설치할 수 있습니다.

> 확장 기능의 설명은 공개되어 있는 설명문과 노드 정보를 바탕으로 합니다. 모르는 것은 '모르겠습니다'라고 답할 것이지만 틀릴 때도 있습니다. 설치하기 전에 배포처의 페이지도 확인하세요.

### 되돌리기

설정이나 편집을 바꾼 응답에는 **{{ui:agent.undo}}** 버튼이 붙습니다. 누르면 그 요청으로 바뀐 설정이나 편집이 한꺼번에 요청하기 전으로 돌아갑니다. 생성 대기열에 넣은 것은 취소되지 않습니다(대기열에서 취소하세요).

다만 앱을 다시 연 뒤에는 그 이전의 변경을 되돌릴 수 없습니다(버튼을 누를 수 없게 됩니다).

### 닮을 때까지 반복해서 그려 달라고 하기

'이 이미지를 닮게 해 줘', '몇 장 생성하면서 가까워지게 해 줘'라고 요청하면 에이전트는 시험 그리기를 반복합니다. 1장을 그릴 때마다 목표 이미지와 비교하여 다른 부분만 고치고 다음 1장을 그립니다.

- 한 번의 답이 끝나도 앱이 자동으로 다음 1장을 요청합니다. 에이전트가 멈추는 것은 목표에 가까워졌다고 판단했을 때나 2장 연속으로 가까워지지 않았을 때뿐입니다.
- 최대 30장까지입니다.
- 채팅에는 '가까워지게 하는 작업: 몇 / 몇 번째'라고 나옵니다.
- 멈추고 싶을 때는 **{{ui:agent.stop}}** 버튼을 누르거나 새 메시지를 보내세요. 보낸 메시지는 다음 1장 대신 전송됩니다.
- {{ui:settings.assistantTrial.label}} 설정을 끄면 이 반복은 시작되지 않습니다.

### 대화의 길이 확인하기

같은 채팅 안에서는 에이전트가 이전의 대화를 기억한 채로 답합니다. 첨부한 이미지나 에이전트가 보여 준 이미지도 이름이 이어지며, 필요할 때는 다시 봅니다.

- 입력칸 위에 다음 전송에 붙는 대화의 크기가 '약 몇 / 몇 토큰'으로 나옵니다. 숫자는 기준입니다.
- 같은 줄의 '{{ui:agent.context.limit}}' 스위치가 켜져 있는 동안(처음부터 켜져 있습니다)은 대화가 30000토큰을 넘을 것 같으면 오래된 메시지를 한 줄씩의 짧은 요약으로 만들어 전송합니다. 새 메시지는 그대로 전송되며, 요약한 건수가 줄에 나옵니다. 요약은 앞부분 140자 정도이므로 세세한 표현은 남지 않습니다. 줄이면 어시스턴트가 이전 이야기를 잊어버릴 때는 스위치를 끄면 대화 전체를 전송합니다(길면 사용하는 모델의 상한을 넘을 수 있습니다).
- 이 스위치가 켜져 있는 동안에는 어시스턴트가 {{ui:app.tabs.generate}}의 프롬프트 칸에 쓰는 프롬프트도 칸마다 77토큰(칸 아래에 나오는 숫자)까지로 제한됩니다. 넘는 프롬프트는 앱이 받아들이지 않으며 어시스턴트는 짧게 줄여서 다시 씁니다. 긴 프롬프트를 쓰게 하고 싶을 때는 스위치를 끕니다.
- 화제를 바꿀 때는 {{ui:agent.session.new}} 버튼으로 새 채팅을 시작하면 오래된 대화에 끌려가지 않습니다.

### 채팅 기록

에이전트와 주고받은 내용은 '채팅'으로 남습니다. 창 위쪽의 채팅 이름 부분을 누르면 **{{ui:agent.session.history}}** 목록이 열립니다.

- 목록에서 선택하면 그 채팅의 이어서 대화할 수 있습니다.
- **{{ui:agent.session.rename}}** 버튼으로 이름을 붙일 수 있습니다.
- **{{ui:agent.session.delete}}** 버튼으로 지울 수 있습니다.
- 옆의 **{{ui:agent.session.new}}** 버튼으로 새 채팅을 시작할 수 있습니다.

채팅의 글자는 드래그로 선택해서 복사할 수 있습니다. 메시지마다 오른쪽 아래에 있는 버튼(**{{ui:agent.copy}}**)을 누르면 그 메시지의 글이 통째로 복사됩니다.

> 응답을 기다리는 동안 써서 보낸 메시지는 대기 상태가 되며, 지금의 응답이 끝나면 자동으로 전송됩니다. 대기 중인 메시지는 흐리게 표시되고 ×로 뺄 수 있습니다. 응답이 실패했을 때는 대기 중인 메시지가 입력칸으로 돌아옵니다. 중단할 때는 **{{ui:agent.stop}}** 버튼으로 취소하세요. 취소할 때까지 바뀐 내용은 그대로 남으며 **{{ui:agent.undo}}** 버튼으로 한꺼번에 원래대로 되돌릴 수 있습니다.

오른쪽 패널의 폭은 패널의 경계를 드래그해서 바꿀 수 있습니다. 화면 위에 열린 창은 네 변과 네 모서리 어디를 드래그해도 크기를 바꿀 수 있습니다. 오른쪽 아래 모서리에는 그 표시가 나옵니다. 크기는 기억해 둡니다. 응답에 판단의 흐름이 붙어 있을 때는 응답 위에 한 줄로 나옵니다. 누르면 전체가 열립니다(**{{ui:agent.thoughts.label}}**). 이것은 AI가 어떻게 읽어 내고 왜 그렇게 했는지를 짧게 정리한 것이며 AI의 내부 사고를 그대로 옮긴 것은 아닙니다.

## 설정

![설정 화면. 왼쪽에 탭이 나열되고 오른쪽에 선택한 탭의 항목이 나온다](shot:settings)

왼쪽 아래의 **{{ui:app.nav.settingsMenu}}** 메뉴에서 **{{ui:app.nav.settings}}** 항목을 선택하면 설정 화면이 열립니다. 왼쪽의 탭을 선택하면 오른쪽에 그 탭의 항목이 나옵니다. 바꾼 내용은 바로 사용되고 앱을 닫아도 남습니다. 다시 열면 마지막으로 보던 탭이 열립니다.

> 이 이미지는 브라우저에서 동작하는 샘플 화면입니다. 데스크톱 버전에만 있는 **{{ui:settings.uiZoom.label}}** 항목은 나와 있지 않습니다.

### {{ui:settings.tab.general}}

| 항목 | 내용 |
|---|---|
| {{ui:settings.language.label}} | {{ui:settings.language.ja}}, {{ui:settings.language.en}}, {{ui:settings.language.zhcn}}, {{ui:settings.language.zhtw}}, {{ui:settings.language.ko}}, {{ui:settings.language.ru}}, {{ui:settings.language.es}}, {{ui:settings.language.ptbr}}, {{ui:settings.language.fr}}, {{ui:settings.language.de}} 중에서 고릅니다. 화면의 언어가 바로 전환됩니다 |
| {{ui:settings.theme.label}} | **{{ui:settings.theme.dark}}**(초기값) 또는 **{{ui:settings.theme.light}}** |
| {{ui:settings.uiZoom.label}} | 데스크톱 버전 전용. 화면 전체의 크기입니다. 50%부터 300%까지 고를 수 있습니다. `Ctrl`과 `+` / `-`로도 바꿀 수 있습니다 |
| {{ui:settings.startTab.label}} | 앱을 열었을 때 처음에 표시할 탭입니다. 처음에는 **{{ui:app.tabs.generate}}** 탭입니다. **{{ui:settings.startTab.last}}** 항목을 선택하면 이전에 닫았을 때의 탭이 열립니다 |
| {{ui:settings.waitForEngine.label}} | 처음에는 켜져 있으며, 시작 화면은 이미지 엔진의 로딩이 끝날 때까지 기다립니다. 끄면 로딩 도중에도 앱을 엽니다. 엔진의 상태는 배너에 나옵니다 |
| {{ui:settings.toastSeconds.label}} | 알림이 자동으로 사라질 때까지의 초 수입니다. 2초부터 15초까지 고를 수 있습니다(처음에는 3.5초) |

### {{ui:settings.tab.generation}}

- **{{ui:settings.antialiasProgressImages}}**: 생성 도중의 그림을 갤러리의 '{{ui:gallery.generating.title}}' 상자에서 부드럽게 표시합니다. 끄면 거친 점 그대로 보입니다.
- **{{ui:settings.draftCount.label}}**: 초안 화면을 열었을 때 장수의 초기값입니다(1~24장. 처음에는 4장). 화면에서 그때그때 바꿀 수도 있습니다.
- **{{ui:settings.draftPosition.label}}**: 초안 화면을 열었을 때 위치의 초기값입니다(25~60 %. 처음에는 35 %).
- **{{ui:settings.lowMemory.label}}**: GPU 메모리가 적은 PC용입니다. 켜면 모델을 GPU 메모리에 올려 둔 채로 두지 않으므로 적은 메모리로 만들 수 있지만 만드는 속도는 느려집니다. 전환하면 엔진을 다시 시작합니다. 만드는 중인 항목이 있을 때는 엔진을 다음에 시작할 때부터 사용됩니다. 다른 곳에서 시작한 엔진에 연결되어 있을 때는 사용할 수 없습니다.
- **{{ui:settings.assistantRead.label}}**(**{{ui:settings.section.assistant}}**): 에이전트가 갤러리 이미지의 정보와 생성 탭의 프롬프트를 읽어도 되는지 여부입니다. **{{ui:settings.assistantRead.ask}}**(초기값), **{{ui:settings.assistantRead.always}}**, **{{ui:settings.assistantRead.never}}** 중에서 고릅니다.
- **{{ui:settings.assistantWeb.label}}**(**{{ui:settings.section.assistant}}**): 에이전트가 Wikipedia에서 사실을 조사해도 되는지 여부입니다. 고르는 방법은 같으며 이미지 읽기와는 별도의 설정입니다.
- **{{ui:settings.assistantTrial.label}}**(**{{ui:settings.section.assistant}}**): 요청의 의도를 알기 어려울 때 에이전트가 스스로 1장만 시험 삼아 생성해도 되는지 여부입니다. 처음에는 켜져 있습니다.

### {{ui:settings.tab.gallery}}

- **{{ui:gallery.settings.thumbnailSize}}**, **{{ui:gallery.settings.sort}}**, **{{ui:gallery.settings.starredFirst}}**, **{{ui:gallery.settings.groupByDate}}**, **{{ui:gallery.settings.alwaysShowSize}}**, **{{ui:gallery.settings.showArchived}}**, **{{ui:gallery.settings.autoSwitch}}**, **{{ui:gallery.settings.autoAssign}}**: 갤러리의 톱니바퀴 버튼으로 여는 **{{ui:gallery.settings.title}}** 화면과 같은 항목입니다. 어느 쪽에서 바꿔도 똑같이 바뀝니다.
- **{{ui:settings.confirmOnDelete}}**: 이미지를 지우기 전에 확인 창을 띄웁니다. 확인 화면에서 '{{ui:common.dontAskAgain}}'을 선택했을 때도 여기가 꺼집니다.
- **{{ui:settings.clearIntermediates}}**: 캔버스의 중간 결과 등 갤러리에 나오지 않는 이미지를 지웁니다. 지울 개수가 버튼에 나옵니다.

### {{ui:settings.tab.edit}}

- **{{ui:settings.undoLimit.label}}**: 캔버스, 만화, 텍스트, 워크플로 편집에서 되돌릴 수 있는 조작의 수입니다. 10부터 200까지 고를 수 있습니다(처음에는 60). 많이 하면 메모리를 많이 사용합니다.

### {{ui:settings.tab.comicText}}

- **{{ui:settings.comicFont.label}}**: 글꼴을 선택하지 않은 말풍선의 글자에 사용하는 글꼴입니다. 앱의 글꼴과 이 PC에 설치되어 있는 글꼴 중에서 고를 수 있습니다. **{{ui:common.font.standard}}** 항목은 앱의 표준 글자입니다.
- **{{ui:settings.textFont.label}}**: 텍스트 화면에서 새로 추가하는 글자에 사용하는 글꼴입니다. 고르는 방법은 말풍선의 글꼴과 같습니다.
- **{{ui:settings.section.comicPage}}**: 새로 만드는 만화와 나중에 추가하는 페이지의 **{{ui:comic.page.size}}**, **{{ui:comic.page.direction}}**, **{{ui:settings.comicPage.panels}}**(1부터 6), **{{ui:comic.page.frameWidth}}**, **{{ui:comic.page.margin}}** 항목을 정합니다. 이미 있는 페이지는 바뀌지 않습니다.

### {{ui:settings.tab.engine}}

앱이 데이터를 두는 위치와 이미지 엔진(ComfyUI)을 시작하는 방법입니다. 여기서 바꾼 내용은 앱을 다음에 시작할 때부터 사용됩니다(그 점이 위쪽에 나옵니다).

| 항목 | 내용 |
|---|---|
| {{ui:settings.engine.dataDir.label}} | 만든 그림, 모델, 이미지 엔진 등을 두는 폴더입니다. 처음에는 사용자 폴더 안의 `novira-data`입니다. **{{ui:settings.engine.dataDir.change}}** 버튼을 누르면 먼저 지금 데이터의 처리 방법을 고릅니다. **{{ui:settings.engine.dataDir.dialog.move}}** 항목은 선택한 폴더로 지금의 데이터를 옮깁니다. 폴더에 다른 것이 있어도 같은 이름의 것이 없으면 옮길 수 있습니다(다음 시작 때 맨 처음에 하므로 양이 많으면 시간이 걸립니다). **{{ui:settings.engine.dataDir.dialog.use}}** 항목은 데이터를 옮기지 않고 선택한 폴더를 엽니다(데이터가 있으면 그것을, 비어 있으면 새로 시작합니다). 그 뒤에 폴더를 선택하는 창이 열리고, 선택한 장소는 다음 시작부터 사용됩니다. **{{ui:settings.engine.dataDir.cancel}}** 버튼으로 취소할 수 있습니다. 이동하지 못했을 때는 이유가 나오고 지금의 폴더 그대로 시작합니다. 환경 변수 `NOVIRA_DATA_DIR`로 정해 두었을 때는 여기서 바꿀 수 없습니다 |
| {{ui:settings.engine.comfyui.label}} | 사용 중인 ComfyUI입니다. 평소에는 데이터 폴더 안의 `comfyui`에 있으며 그 위치가 나옵니다. 설정 파일로 다른 ComfyUI를 지정했을 때는 그 위치가 나옵니다. **{{ui:settings.engine.comfyui.change}}** 버튼으로 앱이 설치하는 ComfyUI의 보관 위치를 바꿀 수 있습니다. 선택한 폴더가 비어 있으면 다음 시작 때 새로 설치합니다(큰 다운로드입니다). 이미 설치된 폴더라면 그대로 사용합니다. 이전 위치의 파일은 자동으로 지워지지 않습니다. 데이터 폴더 안으로 되돌릴 때는 그 안의 `comfyui`를 선택합니다 |
| {{ui:settings.engine.package.label}} | **{{ui:settings.engine.package.nvidia}}** 또는 **{{ui:settings.engine.package.amd}}**. 다음에 ComfyUI를 다운로드할 때(첫 설치나 버전 전환) 사용됩니다. ComfyUI가 설치되어 있을 때 다른 종류를 선택하면 확인 창이 나옵니다. 확인하면 다음에 novira를 시작할 때 선택한 종류로 ComfyUI를 다시 설치합니다(다운로드가 크고 시간이 걸립니다) |
| {{ui:settings.engine.timeout.label}} | ComfyUI를 시작하고 응답할 때까지 기다리는 초 수입니다. 30초부터 1800초까지 고를 수 있습니다. 느린 PC에서는 길게 합니다 |
| {{ui:settings.engine.modelRoots.label}} | 데이터 폴더의 models 외에 모델을 찾을 폴더입니다. **{{ui:settings.engine.modelRoots.add}}** 버튼을 누르면 폴더를 선택하는 창이 열립니다. ComfyUI나 Stability Matrix의 폴더 형태를 알아봅니다. 동영상, 음악, 음성, 지우기의 추가 모델도 여기서 찾을 수 있습니다(읽기만 하며 새로 설치할 때는 항상 데이터 폴더에 들어갑니다). 16개까지 추가할 수 있습니다. 데이터 폴더 안이나 이미 있는 폴더는 추가할 수 없습니다. × 버튼으로 뺍니다. 브라우저에서 열고 있을 때는 추가할 수 없고 빼는 것만 할 수 있습니다 |

### {{ui:settings.tab.accounts}}

모델 배포 사이트에 로그인이 필요할 때를 위한 칸입니다. 입력한 내용은 암호화되어 이 PC에 저장되며 화면에는 표시되지 않습니다.

| 항목 | 내용 |
|---|---|
| {{ui:settings.civitaiKey.label}} | 로그인이 필요한 모델의 다운로드에 사용합니다 |
| {{ui:settings.hfToken.label}} | 접근 신청이 필요한 모델의 다운로드에 사용합니다 |

붙여 넣고 **{{ui:settings.civitaiKey.save}}** 버튼을 누릅니다. 나중에 **{{ui:settings.civitaiKey.change}}** 버튼이나 **{{ui:settings.civitaiKey.remove}}** 버튼도 사용할 수 있습니다.

### {{ui:settings.tab.data}}

#### {{ui:share.backup.section}}

![설정 화면의 백업 칸. 백업을 만드는 버튼과 백업에서 복원하는 버튼](shot:settings-backup)

만든 그림과 앱 안에서 설정·등록한 것을 하나의 zip 파일로 묶어 저장할 수 있습니다. 다른 PC로의 이전이나 만일의 경우를 위한 대비에 사용합니다.

- **{{ui:share.backup.createLabel}}**: 저장할 곳을 선택하는 창이 열립니다. 파일 이름은 처음부터 'novira-backup-날짜-시각.zip'으로 되어 있습니다. 그림이 많으면 시간이 걸리며 진행 상황이 이 칸에 나옵니다.
- **{{ui:share.backup.restoreLabel}}**: 백업 zip 파일을 선택합니다. 내용을 확인한 뒤 확인 창이 나옵니다.

백업에 들어가는 것과 들어가지 않는 것은 다음과 같습니다.

| 들어가는 것 | 들어가지 않는 것 |
|---|---|
| 갤러리의 그림, 동영상, 음성과 그 썸네일 | 모델 |
| 보드, 워크플로, 만화, 대기열의 기록 | 이미지 엔진(ComfyUI)과 확장 기능 |
| 캐릭터, 프리셋, 프롬프트 목록, 초안, AI 채팅, 화면의 설정 | API 키와 토큰, ComfyUI의 위치 등 PC별 설정 |

![복원 확인 창. 백업을 만든 일시와 내용의 개수, 교체에 관한 주의가 나와 있다](shot:restore-confirm)

확인 창에는 백업을 만든 일시와 들어 있는 이미지, 보드, 워크플로의 개수가 나옵니다. **{{ui:share.backup.confirm}}** 버튼을 누르면 앱이 일단 종료되었다가 다시 시작되고, 지금의 데이터가 백업의 내용으로 교체됩니다. 잘 되지 않았을 때는 원래 데이터로 되돌리고 그 사실을 알려 줍니다.

> 교체한 데이터는 원래대로 되돌릴 수 없습니다. 필요하다면 복원하기 전에 지금 상태의 백업을 만들어 두세요. API 키와 토큰은 이 PC 전용으로 암호화되어 있으므로 복원한 뒤에 **{{ui:settings.tab.accounts}}** 탭에서 다시 입력하세요. 브라우저에서 열고 있을 때는 백업 생성도 복원도 할 수 없습니다. 데스크톱 앱에서 사용하세요.

#### {{ui:settings.section.unfinished}}

다운로드가 도중에 멈추면 쓰다 만 파일이 데이터 폴더에 남습니다. 이 칸에서는 남아 있는 파일의 이름, 놓여 있는 폴더, 크기를 확인할 수 있습니다. **{{ui:settings.unfinished.delete}}** 버튼으로 하나씩, **{{ui:settings.unfinished.deleteAll}}** 버튼으로 전부 지울 수 있습니다(누르면 먼저 확인을 요구합니다). 남은 파일은 같은 다운로드를 다음에 시작할 때 이어서 사용됩니다. 지우면 그 다운로드는 처음부터 다시 받습니다. 사용 중인 파일은 지워지지 않고 남습니다.

#### {{ui:settings.section.reset}}

**{{ui:settings.reset.scope.label}}** 항목에서 되돌릴 범위를 선택하고 **{{ui:settings.resetWebUi}}** 버튼을 누른 다음, 다시 한 번 **{{ui:settings.resetConfirm}}** 버튼을 눌러 확정합니다. 이미지, 모델, 만화, 캔버스는 지워지지 않습니다.

설정, 프리셋, 초안, 기록 등 화면의 상태는 데이터 폴더에 저장됩니다. 같은 데이터 폴더를 사용하는 한 데스크톱 앱과 브라우저에서 열었을 때 같은 내용이 됩니다. 둘을 동시에 열 수는 없으므로 이어서 사용할 때 인계됩니다. 초기화도 양쪽에 반영됩니다.

| 범위 | 초기값으로 돌아가는 것 |
|---|---|
| {{ui:settings.reset.scope.settings}} | 설정 화면의 항목. 바로 돌아갑니다 |
| {{ui:settings.reset.scope.generation}} | 생성 화면의 프롬프트, 모델, 각 파라미터 |
| {{ui:settings.reset.scope.gallery}} | 갤러리의 표시(썸네일의 크기, 정렬 순서 등) |
| {{ui:settings.reset.scope.assistant}} | 에이전트와의 대화. 모두 지워집니다 |
| {{ui:settings.reset.scope.all}} | 브라우저에 저장된 설정과 화면의 상태 전부. 프리셋, 캐릭터, 프롬프트 목록, 에이전트의 대화도 지워집니다 |

'{{ui:settings.reset.scope.settings}}' 외에는 확정한 뒤에 나오는 **{{ui:settings.reload}}** 버튼을 눌러 다시 불러오면 반영됩니다.

### {{ui:settings.tab.developer}}

- **{{ui:settings.showDevLog}}**: 왼쪽 내비게이션에 {{ui:app.devlog.short}} 버튼을 표시합니다(아래의 '개발자 로그' 참조).

## 단축키

![단축키 목록. 앱, 캔버스 등의 분류별로 조작과 키가 나열된다](shot:hotkeys)

왼쪽 아래의 **{{ui:app.nav.settingsMenu}}** 메뉴에서 **{{ui:app.nav.hotkeys}}** 항목을 선택하거나 `Shift+?`를 누르면 목록이 열립니다. 위쪽의 검색칸에서 조작 이름이나 키로 찾을 수 있습니다.

여기에는 자주 쓰는 것을 정리했습니다. 전체는 화면의 목록에서 확인하세요.

### 앱 전체

| 키 | 조작 |
|---|---|
| `Ctrl+Enter` | 생성(대기열에 추가) |
| `Ctrl+Shift+Enter` | 대기열의 맨 앞에 추가하여 생성 |
| `Shift+X` | 처리 중인 항목을 취소 |
| `Ctrl+Shift+X` | 대기열을 모두 지우기 |
| `Alt+A` | 프롬프트 칸으로 이동 |
| `T` | 왼쪽 패널을 열고 닫기 |
| `G` | 오른쪽 패널(갤러리와 에이전트)을 열고 닫기 |
| `F` | 좌우 패널을 한꺼번에 열고 닫기 |
| `1` ~ `9` | 번호의 탭으로 이동 |
| `Shift+?` | 단축키 목록을 열기 |
| `Ctrl` + `+` / `-` | 화면 전체를 확대·축소 |

### 캔버스

| 키 | 조작 |
|---|---|
| `B` | {{ui:settings.hotkeys.canvas.brush}} |
| `E` | {{ui:settings.hotkeys.canvas.eraser}} |
| `U` | {{ui:settings.hotkeys.canvas.rect}} |
| `V` | {{ui:settings.hotkeys.canvas.move}} |
| `C` | {{ui:settings.hotkeys.canvas.bbox}} |
| `H` | 표시를 움직이기 |
| `I` | {{ui:settings.hotkeys.canvas.colorPicker}} |
| `[` / `]` | 브러시를 작게·크게 |
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
| `Delete` | 선택한 노드와 연결을 삭제 |
| `Ctrl+C`, `Ctrl+V` | {{ui:settings.hotkeys.workflows.copy}}, {{ui:settings.hotkeys.workflows.paste}} |
| `Ctrl+S` | {{ui:settings.hotkeys.workflows.save}} |
| `Ctrl+Z`, `Ctrl+Shift+Z` | {{ui:settings.hotkeys.workflows.undo}}, {{ui:settings.hotkeys.workflows.redo}} |

글자를 입력하는 도중에는 `T`나 `G` 같은 한 글자 키는 작동하지 않습니다.

## 이 앱에 대하여

![앱 정보 화면. 로고, 버전, 라이선스, 사용 중인 오픈 소스 목록](shot:about)

왼쪽 아래의 **{{ui:app.nav.settingsMenu}}** 메뉴에서 **{{ui:app.nav.about}}** 항목을 선택하면 위쪽에 앱의 이름, 버전, 라이선스, 저작권 표시가 나옵니다. 그 아래는 2개의 탭으로 나뉘어 있습니다.

- **{{ui:settings.about.license.title}}**: novira의 라이선스(Apache License 2.0) 전문입니다. 설치된 폴더에도 같은 문서(`LICENSE`)가 있습니다.
- **{{ui:settings.about.oss.title}}**: 사용 중인 오픈 소스 소프트웨어 목록입니다. 각 행에 이름과 버전이 나열됩니다. **{{ui:settings.about.oss.showLicense}}** 버튼을 누르면 그 아래에 라이선스 전문이 나옵니다(다시 누르면 닫힙니다). **{{ui:settings.about.oss.homepage}}** 버튼을 누르면 그 소프트웨어의 페이지가 브라우저에서 열립니다. 앱에 포함되어 있지 않은 생성 엔진과 확장 기능은 라이선스 전문을 홈페이지에서 확인하세요.

목록 위쪽의 버튼으로 **{{ui:settings.about.oss.short.frontend}}**, **{{ui:settings.about.oss.short.backend}}**, **{{ui:settings.about.oss.short.engine}}**, **{{ui:settings.about.oss.short.packs}}**(현재 설치된 확장 기능)로 좁힐 수 있습니다. 검색칸에서는 이름으로 찾을 수 있습니다. 포함되어 있는 소프트웨어의 라이선스 전문은 설치된 폴더의 `THIRD_PARTY_NOTICES.txt`에도 정리되어 있습니다.

확장 기능(ComfyUI의 커스텀 노드)과 모델은 설치했을 때 각각의 배포처 라이선스를 따릅니다.

## 개발자 로그

뭔가 잘 되지 않을 때 원인을 찾기 위한 로그입니다. 평소에는 사용하지 않아도 됩니다.

**{{ui:settings.title}}** 화면의 **{{ui:settings.showDevLog}}** 설정을 켜면 왼쪽 내비게이션에 '{{ui:app.devlog.short}}' 버튼이 나옵니다. 누르면 오른쪽에 **{{ui:app.devlog.title}}** 패널이 열립니다.

여기에는 앱 내부의 기록(백엔드 로그), 화면의 경고, 잡아내지 못한 오류가 시각과 함께 나열됩니다.

- 위쪽 선택 항목에서 **{{ui:app.devlog.level.all}}**, **{{ui:app.devlog.level.warn}}**, **{{ui:app.devlog.level.error}}**로 좁힐 수 있습니다.
- 필터 칸에 말을 입력하면 그 말을 포함한 행만 나옵니다.
- **{{ui:app.devlog.copy}}** 버튼으로 표시된 행을 문장으로 복사할 수 있습니다. 문제를 보고할 때 붙여 넣어 사용할 수 있습니다.
- **{{ui:app.devlog.clear}}** 버튼으로 지울 수 있습니다.

> 로그는 앱을 열고 있는 동안의 기록입니다. 닫으면 화면의 로그는 사라집니다. 자세한 조사 방법은 [문제가 생겼을 때](10-troubleshooting.md)로.

