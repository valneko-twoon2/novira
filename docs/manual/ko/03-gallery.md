# 갤러리와 뷰어

만든 그림은 화면 오른쪽의 **갤러리**에 나열됩니다. 갤러리에서 선택한 그림은 가운데의 **{{ui:app.views.viewer}}**에서 크게 볼 수 있습니다.
이 장에서는 그림을 정리하는 방법, 찾는 방법, 뷰어에서 보는 방법, 설정을 불러오는 방법, 삭제와 다운로드를 설명합니다.

## 갤러리 보는 법

오른쪽 패널은 위아래 2개 부분으로 이루어져 있습니다.

- 위: **{{ui:gallery.boards.title}}**. 그림을 넣어 두는 폴더 같은 것입니다.
- 아래: 선택한 보드의 그림 썸네일입니다.

썸네일 위의 줄에는 다음이 있습니다.

- '{{ui:gallery.view.images}}'와 '{{ui:gallery.view.assets}}'의 전환, 그리고 그림의 수.
- 돋보기 버튼: 검색({{ui:gallery.search.label}})
- 달력 버튼: {{ui:gallery.date.button}}
- 톱니바퀴 버튼: {{ui:gallery.settings.title}}
- 위쪽 화살표 버튼: {{ui:gallery.upload}}

**{{ui:gallery.view.images}}**에는 novira에서 만든 그림(동영상과 오디오도 포함합니다)이 들어갑니다.
**{{ui:gallery.view.assets}}**에는 업로드한 이미지나 로고처럼 '작품과는 별개의 소재'로 다루는 것이 들어갑니다. 보이지 않는 그림이 있을 때는 다른 쪽을 살펴보세요.

썸네일의 크기는 톱니바퀴 버튼의 슬라이더로 바꿀 수 있습니다.
동영상과 오디오의 썸네일에는 재생 표시가 붙어 있으며, 커서를 올리고 옆으로 움직이면 그 위치의 장면을 확인할 수 있습니다.

## 보드

보드는 그림을 나누어 정리하기 위한 그릇입니다. '{{ui:gallery.boards.uncategorized}}'는 처음부터 있는 보드이며, 보드에 넣지 않은 그림이 들어갑니다.

- **만들기**: 보드 영역 오른쪽 위의 **＋**({{ui:gallery.boards.add}})를 누릅니다. 이름을 그 자리에서 입력할 수 있습니다.
- **전환하기**: 보드를 클릭합니다. 그 보드의 그림만 아래에 나열됩니다.
- **이름 바꾸기**: 보드 이름을 더블클릭하거나 오른쪽 클릭 메뉴에서 '{{ui:common.rename}}'을 선택합니다.
- **찾기**: 보드 영역의 돋보기로 보드 이름을 검색할 수 있습니다.
- **접기**: '{{ui:gallery.boards.title}}' 제목을 클릭합니다. 보드 영역의 아래쪽 끝을 드래그하면 높이를 바꿀 수 있습니다.

### 새 그림이 어느 보드에 들어가는지

새로 만든 그림(업로드한 그림도)은 '**{{ui:gallery.boards.autoBadge}}**' 표시가 붙은 보드에 들어갑니다.
처음에는 보드를 클릭할 때마다 그 보드가 '{{ui:gallery.boards.autoBadge}}'이 됩니다. 고정하고 싶을 때는 갤러리 설정에서 '{{ui:gallery.settings.autoAssign}}'를 끄고, 보드의 오른쪽 클릭 메뉴에서 '{{ui:gallery.boards.setAutoAdd}}'으로 정합니다.

### 보드의 오른쪽 클릭 메뉴

- **{{ui:gallery.boards.setAutoAdd}}**: 새 그림의 저장 위치로 삼습니다.
- **{{ui:common.rename}}**
- **{{ui:gallery.boards.archive}}**: 보드를 목록에서 숨깁니다. 사라지는 것이 아니라 갤러리 설정의 '{{ui:gallery.settings.showArchived}}'를 켜면 다시 보입니다. '{{ui:gallery.boards.unarchive}}'로 되돌릴 수 있습니다.
- **{{ui:gallery.boards.delete}}**: 확인 창이 나오며 다음 중 하나를 선택합니다.
  - '{{ui:gallery.boards.deleteBoardOnly}}': 그림은 남고 '{{ui:gallery.boards.uncategorized}}'로 옮겨집니다.
  - '{{ui:gallery.boards.deleteBoardAndImages}}': 보드 안의 그림도 지웁니다.

> '{{ui:gallery.boards.uncategorized}}'는 이름 변경, 보관, 삭제를 할 수 없습니다.

## 그림 선택하기

썸네일은 다음과 같이 선택할 수 있습니다.

| 조작 | 결과 |
|---|---|
| 클릭 | 그 1장을 선택한다. 뷰어에서 보는 그림도 그 그림으로 바뀝니다 |
| `Ctrl`을 누른 채 클릭 | 선택한 그림에 추가하거나 선택에서 뺀다(복수 선택) |
| `Shift`를 누른 채 클릭 | 앞서 선택한 그림부터 클릭한 그림까지를 한꺼번에 선택한다 |
| `Alt`를 누른 채 클릭 | 뷰어의 그림과 비교한다(뒤에서 설명) |
| 더블클릭 | 가운데를 뷰어로 전환해서 그 그림을 크게 본다 |
| `Ctrl+A` | 지금 나열된 그림을 모두 선택한다 |
| 화살표 키 | 앞뒤, 위아래의 그림으로 선택을 옮긴다. `Shift`를 누른 채로 범위를 넓힌다 |
| `Esc` | 선택을 해제한다 |

> 화살표 키 등은 커서가 갤러리 위에 있거나 가운데가 뷰어일 때 동작합니다.

선택한 그림에는 파란 테두리가 붙습니다. 썸네일에 커서를 올리면 다음이 나옵니다.

- 그림의 크기(갤러리 설정의 '{{ui:gallery.settings.alwaysShowSize}}'로 항상 표시할 수도 있습니다)
- 별 버튼(별표를 붙이거나 뗌)
- 휴지통 버튼(삭제)

별표를 붙인 그림에는 왼쪽 위에 노란 별 표시가 붙습니다.

## 썸네일을 오른쪽 클릭하기

![썸네일의 오른쪽 클릭 메뉴. 뷰어에서 열기, 다운로드, 리믹스, 캔버스로 보내기 등이 나열되어 있다](shot:gallery-menu)

썸네일을 오른쪽 클릭하면 그 그림에 사용할 수 있는 조작이 목록으로 나옵니다. 사용할 수 없는 조작은 회색이 됩니다(예를 들어 설정 기록이 없는 그림은 '{{ui:gallery.menu.remix}}'를 사용할 수 없습니다).

| 메뉴 | 기능 |
|---|---|
| **{{ui:gallery.menu.openInViewer}}** | 가운데 뷰어에서 크게 본다 |
| **{{ui:common.download}}** | 그림 파일을 저장한다 |
| **{{ui:share.menu}}** | 형식과 크기를 골라 사본을 내보낸다 (생성 정보를 제거할 수도 있다) |
| **{{ui:common.copy}}**(`Ctrl+C`) | 그림을 클립보드에 복사한다 |
| **{{ui:gallery.menu.compare}}**(`Alt+클릭`) | 뷰어에 나와 있는 그림과 비교한다 |
| **{{ui:gallery.menu.loadWorkflow}}**(`W`) | 그 그림을 만든 워크플로를 연다 |
| **{{ui:gallery.menu.remix}}**(`R`) | 시드 이외의 설정을 왼쪽 패널에 불러온다 |
| **{{ui:gallery.menu.usePrompt}}**(`P`) | 프롬프트만 불러온다 |
| **{{ui:gallery.menu.useSeed}}**(`S`) | 시드만 불러온다(시드는 고정됩니다) |
| **{{ui:gallery.menu.useAll}}**(`A`) | 설정을 모두 불러온다 |
| **{{ui:gallery.menu.useSize}}** | 너비와 높이만 불러온다 |
| **{{ui:gallery.menu.sendToCanvas}}** | 캔버스에 놓는다. 새 캔버스로 만들지, 현재 캔버스의 레이어나 마스크로 추가할지 선택할 수 있습니다 |
| **{{ui:gallery.menu.useAsReference}}** | 참조 이미지 칸에 추가한다 |
| **{{ui:gallery.menu.sendToVideo}}** | 동영상의 첫 그림으로 삼는다 |
| **{{ui:gallery.menu.sendToWorkflow}}** | 열려 있는 워크플로에 이미지 입력으로 추가한다 |
| **{{ui:gallery.menu.sendToText}}** | 텍스트의 배경으로 삼는다 |
| **{{ui:gallery.menu.upscale}}**(`Shift+U`) | 업스케일 탭으로 보낸다 |
| **{{ui:gallery.menu.segment}}** | 그림의 일부를 선택해서 오려 내거나 다시 그린다 |
| **{{ui:gallery.derive.menu}}** | 이 그림의 설정으로 다른 시드나 조금만 바꾼 그림을 만든다 |
| **{{ui:cutout.menu}}** | 배경을 제거한다 |
| **{{ui:facefix.menu}}** | 얼굴을 찾아서 다시 그린다 |
| **{{ui:gallery.menu.trim}}** | 투명한 여백을 줄이고 새 투명 이미지로 저장한다 |
| **{{ui:character.menu}}** | 그림을 캐릭터로 등록한다 |
| **{{ui:gallery.menu.changeBoard}}** | 다른 보드로 옮긴다 |
| **{{ui:gallery.menu.star}}** / **{{ui:gallery.menu.unstar}}** | 별표를 붙이거나 뗀다 |
| **{{ui:gallery.menu.delete}}**(`Del`) | 그림을 삭제한다 |

'{{ui:gallery.menu.sendToCanvas}}'나 그림을 다시 만들거나 수정하는 조작의 사용 방법은 [캔버스에서 덧그리기](05-canvas.md), [그림 수정하고 다시 쓰기](04-improve.md), [확대와 워크플로](06-upscaling-workflows.md), [동영상, 음악, 음성, 로고, 텍스트](07-media.md)에서 설명합니다.

> 컴퓨터의 브라우저에서 열었을 때만 '{{ui:gallery.menu.openInNewTab}}'도 나옵니다. 데스크톱 버전에는 나오지 않습니다.

## 여러 그림을 한꺼번에 조작하기

![2장을 선택해서 오른쪽 클릭했을 때의 메뉴](shot:gallery-multi-menu)

그림을 2장 이상 선택한 뒤 선택한 그림 중 하나를 오른쪽 클릭하면 한꺼번에 사용할 수 있는 메뉴가 나옵니다. 맨 위에 '2장 선택됨'처럼 선택한 수가 나옵니다.

- **{{ui:gallery.menu.changeBoard}}**: 선택한 그림을 한꺼번에 다른 보드로 옮깁니다.
- **{{ui:gallery.menu.starAll}}** / **{{ui:gallery.menu.unstarAll}}**
- **{{ui:common.download}}**: 선택한 그림을 이어서 저장합니다.
- **{{ui:share.menu}}**: 선택한 그림을 공유용 사본으로 한꺼번에 내보냅니다(동영상과 오디오는 제외).
- **{{ui:gallery.menu.batch}}**: 선택한 모든 그림에 같은 처리(배경 제거, 확대 등)를 적용합니다. 1장마다 대기열에 들어갑니다.
- 맨 아래의 빨간 항목: 선택한 그림을 한꺼번에 삭제합니다.

> 선택하지 않은 그림을 오른쪽 클릭했을 때는 그 1장의 메뉴가 나옵니다. 여러 그림에 사용하고 싶을 때는 먼저 선택한 뒤 선택한 그림 위에서 오른쪽 클릭하세요.

## 찾기, 좁히기, 정렬하기

### 검색

돋보기 버튼을 누르면 검색란이 열립니다. 파일 이름이나 포지티브 프롬프트의 일부를 입력하면 그 보드의 그림이 좁혀집니다. `Esc`로 검색을 닫고 좁히기를 해제할 수 있습니다.

### 날짜로 좁히기

![날짜로 좁히는 메뉴. 오늘, 어제 등의 버튼과 월별 달력](shot:gallery-date)

달력 버튼을 누르면 날짜로 좁히는 메뉴가 열립니다.

- **{{ui:gallery.date.quick.today}}**, **{{ui:gallery.date.quick.yesterday}}**, **{{ui:gallery.date.quick.last7}}**, **{{ui:gallery.date.quick.last30}}**: 버튼 하나로 기간을 정합니다.
- 월별 달력: 그림이 있는 날에는 표시가 붙습니다. 날짜를 클릭하면 그날의 그림만 나열됩니다. 위쪽 화살표로 월을 옮길 수 있습니다.
- **{{ui:gallery.date.custom}}**: 시작일과 종료일을 입력하고 **{{ui:gallery.date.apply}}** 버튼을 누르면 그 기간의 그림만 나열됩니다. 어느 한쪽만으로도 사용할 수 있습니다.
- **{{ui:gallery.date.quick.all}}**: 좁히기를 그만둡니다.

좁히는 중에는 갤러리 위에 기간 표시가 나옵니다. 표시의 ×로도 해제할 수 있습니다.

### 갤러리 설정

톱니바퀴 버튼에서는 나열 방식과 겉모습을 바꿀 수 있습니다.

- {{ui:gallery.settings.thumbnailSize}}
- {{ui:gallery.settings.autoSwitch}}: 그림이 완성되었을 때 자동으로 그 그림을 보여 줍니다.
- {{ui:gallery.settings.autoAssign}}
- {{ui:gallery.settings.alwaysShowSize}}
- {{ui:gallery.settings.showArchived}}
- {{ui:gallery.settings.starredFirst}}: 별표를 붙인 그림을 맨 위에 나열합니다(처음부터 켜져 있습니다).
- {{ui:gallery.settings.sort}}: '{{ui:gallery.settings.sortNewest}}' 또는 '{{ui:gallery.settings.sortOldest}}'.
- {{ui:gallery.settings.groupByDate}}: 날짜별 제목을 붙여서 구분합니다.

## 뷰어에서 보기

![뷰어. 위에 도구 모음, 가운데에 그림, 오른쪽 아래에 확대·축소 버튼, 아래에 그림 정보가 나와 있다](shot:viewer)

가운데의 '{{ui:app.views.viewer}}'에는 선택한 그림이 크게 나옵니다.
앞뒤의 그림으로는 화면 좌우의 화살표로 옮길 수 있습니다. 맨 아래 줄에는 그림의 크기, 사용한 모델, 시드, 파일 이름이 나옵니다. 동영상과 음성은 그대로 재생할 수 있습니다.

### 확대와 이동

- 마우스 휠: 커서 위치를 중심으로 확대하거나 축소합니다.
- 드래그: 확대해서 그림이 화면 밖으로 넘칠 때 그림을 움직입니다. `Space`를 누른 채로, 또는 휠 버튼을 누른 채로도 움직일 수 있습니다.
- 더블클릭: 전체 표시와 원본 크기(100%)를 전환합니다.
- 오른쪽 아래의 버튼: 축소, 배율(누르면 자주 쓰는 배율 목록), 확대, `1:1`(원본 크기), 화면에 맞추기.
- 키: `+`와 `-`로 한 단계씩, `Ctrl+0`으로 화면에 맞추고, `Ctrl+1`로 원본 크기로 바꿉니다.

### 도구 모음

그림 위의 도구 모음에는 그 그림에 대한 조작이 나열되어 있습니다. 버튼에 커서를 올리면 이름과 단축키가 나옵니다.

| 그룹 | 버튼 |
|---|---|
| 정보 | **{{ui:gallery.viewer.toggleMetadata}}**(`I`) |
| 설정 불러오기 | **{{ui:gallery.menu.remix}}**(`R`), **{{ui:gallery.menu.usePrompt}}**(`P`), **{{ui:gallery.menu.useSeed}}**(`S`), **{{ui:gallery.menu.useAll}}**(`A`), **{{ui:gallery.menu.loadWorkflow}}**(`W`), **{{ui:gallery.derive.menu}}** |
| 보내기와 수정하기 | **{{ui:gallery.menu.sendToCanvas}}**, **{{ui:gallery.menu.useAsReference}}**, **{{ui:gallery.menu.upscale}}**(`Shift+U`), **{{ui:gallery.menu.segment}}**, **{{ui:cutout.menu}}**, **{{ui:facefix.menu}}**, **{{ui:character.menu}}**, **{{ui:gallery.compare.toggle}}**(`C`) |
| 정리 | **{{ui:gallery.menu.star}}**, **{{ui:common.download}}**, **{{ui:share.menu}}**, **{{ui:gallery.menu.delete}}**(`Del`) |

기능은 썸네일의 오른쪽 클릭 메뉴에서 같은 이름의 항목과 같습니다. 설정이 없는 그림(업로드한 이미지 등)에서는 설정을 불러오는 버튼이 회색이 됩니다.

## 그림 정보와 설정 불러오기

![메타데이터 패널. 프롬프트, 모델, 시드, 스텝 수 등의 목록](shot:viewer-metadata)

도구 모음의 **{{ui:gallery.viewer.toggleMetadata}}** 버튼(`I`)을 누르면 그림 위에 정보 패널이 열립니다. 한 번 더 누르거나 오른쪽 위의 ×로 닫습니다.
패널에는 4개의 탭이 있습니다.

- **{{ui:gallery.meta.tabRecall}}**: 그림을 만들었을 때의 설정이 항목별로 나열됩니다(프롬프트, 모델, 시드, 스텝 수, CFG 스케일, 스케줄러, 크기, LoRA 등). 각 행 오른쪽의 화살표 버튼으로 **그 항목만** 왼쪽 패널에 불러올 수 있습니다.
- **{{ui:gallery.meta.tabMetadata}}**: 기록된 내용을 그대로 볼 수 있습니다. 오른쪽 위의 버튼으로 복사할 수 있습니다.
- **{{ui:gallery.meta.tabDetails}}**: 파일 이름, 크기, 만든 일시, 보드, 별표 여부 등입니다.
- **{{ui:gallery.meta.tabWorkflow}}**: 워크플로로 만든 그림이라면 그 내용이 나옵니다.

설정을 불러오는 방법은 사용하고 싶은 범위에 따라 선택합니다.

| 방법 | 불러오는 것 |
|---|---|
| **{{ui:gallery.menu.useAll}}** | 프롬프트, 모델, 시드, 크기 등 설정 전부. 시드는 고정됩니다 |
| **{{ui:gallery.menu.remix}}** | 시드 이외의 전부. 현재 시드 설정(무작위인지 고정인지)은 그대로 남습니다. '같은 설정으로 다른 그림을 만들고 싶을' 때 사용합니다 |
| **{{ui:gallery.menu.usePrompt}}** | 프롬프트(포지티브와 네거티브)만 |
| **{{ui:gallery.menu.useSeed}}** | 시드만. 시드는 고정됩니다 |
| **{{ui:gallery.menu.useSize}}** | 너비와 높이만(오른쪽 클릭 메뉴에서만) |

불러온 뒤에는 왼쪽 패널을 확인하고 **{{ui:params.invoke.invoke}}** 버튼을 누르기만 하면 됩니다.

> novira로 만든 그림의 이미지 파일(PNG)에는 설정도 함께 기록되어 있습니다. 그래서 파일을 다른 곳으로 옮긴 뒤 다시 업로드한 그림에서도 설정을 불러올 수 있는 경우가 있습니다. 다른 소프트웨어로 만든 이미지나 가공해서 다시 저장한 이미지에는 설정이 들어 있지 않습니다.

## 2장 비교해서 보기

![슬라이더로 2장을 비교하고 있는 뷰어. 가운데의 세로선을 좌우로 움직인다](shot:viewer-compare)

두 그림의 차이를 보고 싶을 때는 비교를 사용합니다.

1. 비교하고 싶은 그림 중 첫 번째 그림을 클릭해서 선택하고, 가운데를 '{{ui:app.views.viewer}}' 탭으로 합니다.
2. 두 번째 그림의 썸네일을 `Alt`를 누른 채 클릭합니다(오른쪽 클릭 메뉴의 '{{ui:gallery.menu.compare}}'로도 할 수 있습니다).
3. 두 번째 그림의 썸네일에 '{{ui:gallery.compare.badge}}' 표시가 붙고 뷰어가 비교 화면으로 바뀝니다.

> `Ctrl`을 누른 채 2장을 선택해 두고 도구 모음의 비교 버튼이나 `C` 키를 눌러도 시작할 수 있습니다. 1장만 선택했을 때는 '{{ui:gallery.compare.hint}}'라는 안내가 나옵니다.

비교 화면 위에는 다음 버튼이 나옵니다.

- **{{ui:gallery.compare.slider}}**: 2장을 겹치고 가운데의 세로선을 드래그하면 좌우에서 어떻게 다른지 볼 수 있습니다.
- **{{ui:gallery.compare.sideBySide}}**: 2장을 좌우로 나란히 놓습니다.
- **{{ui:gallery.compare.hover}}**: 커서를 그림에 올리고 있는 동안만 두 번째 그림으로 전환됩니다.
- **{{ui:gallery.compare.swap}}**: 첫 번째 그림과 두 번째 그림을 서로 바꿉니다.
- **{{ui:gallery.compare.exit}}**: 비교를 그만둡니다. `Esc`로도 그만둘 수 있습니다.

확대와 이동은 2장이 연동되어 움직입니다. 세부의 차이는 확대해서 보면 알기 쉬워집니다.

## 별표와 삭제

### 별표 붙이기

마음에 드는 그림에는 별표를 붙여 둘 수 있습니다. 썸네일의 별 버튼, 오른쪽 클릭 메뉴, 뷰어의 도구 모음 중 어디에서든 붙이거나 뗄 수 있습니다.
갤러리 설정의 '{{ui:gallery.settings.starredFirst}}'가 켜져 있으면 별표가 붙은 그림이 맨 앞에 모입니다.

### 삭제하기

그림을 삭제하는 방법은 다음과 같습니다.

- 썸네일의 휴지통 버튼
- 오른쪽 클릭 메뉴의 '{{ui:gallery.menu.delete}}'
- 뷰어 도구 모음의 휴지통 버튼
- 그림을 선택하고 `Delete` 키(`Backspace`도 같습니다)

확인 창이 나오며 '{{ui:common.delete}}'를 누르면 삭제됩니다.

> 삭제한 그림은 되돌릴 수 없습니다. 휴지통 같은 보관 장소는 없습니다.

확인 창의 '{{ui:common.dontAskAgain}}'에 체크하면 이후로는 확인 없이 삭제합니다. 확인을 되돌리고 싶을 때는 **{{ui:app.nav.settings}}**의 '{{ui:settings.confirmOnDelete}}'을 켭니다.

## 업로드와 다운로드

### 업로드

가지고 있는 이미지를 갤러리에 넣을 수 있습니다.

- 갤러리 위의 **{{ui:gallery.upload}}** 버튼을 눌러 파일을 선택합니다.
- 탐색기에서 이미지 파일을 갤러리에 드래그 앤 드롭합니다. 보드 위에 드롭하면 그 보드에 들어갑니다.

업로드한 이미지는 '{{ui:gallery.boards.autoBadge}}' 보드의 **{{ui:gallery.view.assets}}**에 들어가며 화면도 거기로 전환됩니다. 여러 파일을 한 번에 넣을 수 있습니다. 이미지가 아닌 파일은 무시됩니다.

### 다운로드

그림 파일을 저장하려면 오른쪽 클릭 메뉴나 뷰어 도구 모음의 **{{ui:common.download}}**를 사용합니다. 여러 그림을 선택하고 있을 때는 한꺼번에 저장됩니다.

### 공유용으로 내보내기

![공유용으로 내보내기 창. 형식(PNG·JPEG·WebP), 화질, 긴 변 최대, 생성 정보를 제거하는 스위치가 있다](shot:share-export)

SNS에 올리거나 다른 사람에게 건넬 그림의 사본은 오른쪽 클릭 메뉴(여러 그림을 선택했을 때도 사용할 수 있습니다)나 뷰어 도구 모음의 **{{ui:share.menu}}**로 만듭니다. 원래 그림은 바뀌지 않습니다.

- **{{ui:share.format}}**: PNG·JPEG·WebP 중에서 고릅니다. JPEG에서는 **{{ui:share.quality}}**(1~100)을 정할 수 있고, 투명한 부분은 흰색이 됩니다. WebP는 손실 없이 저장합니다.
- **{{ui:share.size}}**: '{{ui:share.size.original}}', 2048·1536·1024 px, 또는 '{{ui:share.size.custom}}'으로 길이를 입력합니다. 그보다 작은 그림은 확대하지 않습니다.
- **{{ui:share.removeInfo}}**: 처음에는 꺼져 있습니다. 켜면 프롬프트·설정·워크플로를 포함하지 않고, 그림을 픽셀에서 다시 저장하므로 다른 내장 정보도 남지 않습니다. 꺼져 있을 때는 PNG만 설정을 남깁니다. 남에게 건네기 전에 프롬프트를 보여 주고 싶지 않다면 켜 주세요.

**{{ui:share.run}}**를 누르면 데스크톱 버전에서는 저장할 폴더를 고르는 창이 열립니다. 파일 이름은 갤러리의 파일 이름에 새 확장자를 붙인 것이며, 같은 이름의 파일이 있으면 '-2', '-3'처럼 번호를 붙이고 덮어쓰지 않습니다. 내보낸 뒤에는 **{{ui:share.openFolder}}**로 그 폴더를 열 수 있습니다.

> 내보낼 수 있는 것은 이미지뿐입니다. 선택한 것 중 동영상과 오디오는 제외됩니다. 브라우저에서 열었을 때는 브라우저의 다운로드에 저장됩니다.

## 드래그 앤 드롭

썸네일은 다른 곳으로 드래그해서 사용할 수 있습니다. 여러 장을 선택하고 있을 때는 선택한 그림이 한꺼번에 움직입니다.

- **보드 위로**: 그 그림을 보드로 옮깁니다.
- **{{ui:params.refImage.sectionLabel}} 칸으로**: 참조 이미지로 삼습니다([이미지 만들기](02-generate.md) 참조).
- **캔버스나 업스케일의 이미지 입력란, 시작 화면의 카드로**: 그 화면의 소재로 사용합니다.

탐색기의 파일은 갤러리, 보드, 참조 이미지 칸, 시작 화면의 카드 등에 드롭할 수 있습니다.

## 갤러리 단축키

| 조작 | 키 |
|---|---|
| 앞뒤, 위아래의 그림을 선택한다 | 화살표 키(`Shift`로 범위를 넓힘) |
| 모두 선택한다 | `Ctrl+A` |
| 선택을 해제한다 | `Esc` |
| 선택한 그림을 삭제한다 | `Delete` |
| 뷰어의 그림을 복사한다 | `Ctrl+C` |
| 정보 패널을 열고 닫는다 | `I` |
| 리믹스, 프롬프트, 시드, 전부 | `R`, `P`, `S`, `A` |
| 워크플로를 불러온다 | `W` |
| 업스케일로 보낸다 | `Shift+U` |
| 비교를 시작하거나 그만둔다 | `C` |
| 전체 표시, 원본 크기 | `Ctrl+0`, `Ctrl+1` |
| 확대, 축소 | `+`, `-` |

이것들은 커서가 갤러리 위에 있거나 가운데가 뷰어일 때 동작합니다. 목록은 **{{ui:app.nav.settings}}** 메뉴의 '{{ui:app.nav.hotkeys}}'에서도 볼 수 있습니다.
