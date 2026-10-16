---
title: "[Databricks] Genie로 데이터 질문하고 대시보드 만들기 - 활용 2편"
date: 2026-10-14T11:06:34+09:00
draft: false
description: "Genie Agent로 판매 데이터를 질문한 뒤 뉴욕 택시 데이터로 전환한다. Genie Code로 운행 추이·히트맵·지역 순위와 파라미터를 갖춘 대시보드를 자동 구성한다."
slug: "databricks-applications-2"
categories: ["Data Engineering"]
tags: ["Data Engineering", "Databricks", "SQL", "Genie"]
series: "Databricks 활용"
seriesOrder: 2
---

[활용 1편](/posts/databricks-applications-1/)에서는 카드와 필터를 직접 만들었다. 이번에는 **Genie에 한국어로 질문하고, AI로 대시보드까지 구성한다.** 질문 실습은 1편의 판매 Gold로 시작하고, 대시보드 실습부터 뉴욕 택시 데이터로 전환한다.

대시보드가 정해 둔 지표를 반복해서 보는 화면이라면, Genie는 질문에 맞는 조회를 만드는 대화형 분석 도구다. 예를 들어 “상품별 판매 금액을 보여줘”라고 질문하면 그에 맞는 SQL과 결과를 만든다.

먼저 **Genie Agent**에서 데이터를 질문하고 SQL로 검산한다. 이어서 대시보드 편집 화면의 **Genie Code**에 카드·차트·파라미터 생성을 맡긴다. 두 기능은 실행 위치와 역할이 다르다. Genie Agent의 예전 이름은 **Genie Space**다. [Genie Agent 개념](https://docs.databricks.com/aws/en/genie-agents/concepts)

| 실습 | 실행 위치 | 결과 |
| --- | --- | --- |
| 1~5절: 판매 데이터 질문 | Genie Agent 대화 | SQL과 결과 검산 |
| 6절: 택시 데이터 준비 | Notebook | 분석용 뷰와 기준값 |
| 7절: 택시 대시보드 자동 구성 | 대시보드의 Genie Code | 카드·추이·히트맵·지역 분석·입력 위젯 |

실습 화면은 2026년 10월 14일과 16일 Databricks Free Edition에서 촬영했다. 메뉴와 기능 설명은 10월 16일 공식 문서를 기준으로 작성했다. 답변의 문장·컬럼명·표현 순서는 달라질 수 있으므로 **조회 조건과 계산 결과**를 기준으로 확인한다.

## 1. 기준값 SQL로 확인하기

**기초 5편의 두 번째 CSV 처리와 Gold 집계까지 마친 상태**에서 시작한다. 질문 실습에 사용할 테이블은 다음 하나다.

```text
workspace.bakehouse_file_lab.gold_daily_product_sales
```

활용 1편에서 만든 `bakehouse_bi_lab` 폴더에 Python Notebook `01_check_genie`를 추가하고, Compute는 Serverless로 선택한다. **첫 SQL 셀에서 아래 코드를 실행한다.**

```sql
%sql
SELECT
    SUM(total_sales_amount) AS sales_amount,
    SUM(total_quantity) AS quantity,
    SUM(source_row_count) AS source_rows,
    COUNT(*) AS gold_rows
FROM workspace.bakehouse_file_lab.gold_daily_product_sales;
```

예상 결과는 **금액 67.00·수량 16·원본 판매 내역 3행·Gold 2행**이다. 이 값을 Genie 답변의 비교 기준으로 사용한다.

Gold 한 행은 날짜·매장·상품별 집계다. **원본 판매 내역 수는 `SUM(source_row_count)`** 이며, `COUNT(*)`는 집계된 Gold 행 수다. 이 차이를 알아야 “판매 내역이 몇 건인가?”라는 질문을 제대로 검산할 수 있다. 이 예제의 내역 수를 주문 수나 고객 수로 해석하지 않는다.

[![Notebook에서 판매 금액 67.00·수량 16·원본 내역 3·Gold 2행을 확인한 결과](/images/databricks-applications-2/verify-sales-baseline.png)](/images/databricks-applications-2/verify-sales-baseline.png)

## 2. Genie Agent 만들기

1. 왼쪽 **Genie Agents**를 누른다.
2. 오른쪽 위 **New**를 누른다.
3. 데이터 선택 창에서 `workspace → bakehouse_file_lab → gold_daily_product_sales`를 선택한다.
4. **Create**를 누른다.

Genie의 SQL은 Notebook Compute가 아닌 **SQL warehouse**에서 실행된다. 작성 계정에는 warehouse의 `CAN USE`와 대상 테이블의 조회 권한이 필요하다. [생성과 설정](https://docs.databricks.com/aws/en/genie-agents/set-up)

이 Agent에는 **Gold 테이블 하나만 연결한다.** 1편의 `daily_product_sales`는 대시보드 안의 데이터셋 이름이다. 여기서는 원본 Unity Catalog 테이블을 선택한다.

생성 직후 Genie Code가 설명이나 예제 쿼리를 제안할 수 있다. 아래에서 직접 등록할 규칙과 충돌하지 않는지 확인한 뒤 채택한다.

[![Genie Agents의 Connect your data에서 bakehouse_file_lab의 Gold 테이블을 선택하고 Create하는 화면](/images/databricks-applications-2/connect-genie-gold-table.png)](/images/databricks-applications-2/connect-genie-gold-table.png)

## 3. 지표 규칙 등록하기

Genie는 컬럼 이름뿐 아니라 **테이블이 어떤 단위로 집계됐는지** 알아야 한다. 이번에는 모든 질문에 적용할 규칙을 짧은 텍스트로 등록한다. [규칙 구성](https://docs.databricks.com/aws/en/genie-agents/best-practices)

**Configure → Instructions의 General Instructions에 아래 내용을 넣고 Save를 누른다.**

```text
한국어로 답한다.

이 테이블은 가상 판매 데이터의 날짜·매장·상품별 집계다.
- 판매일: sales_date, 상품: product, 매장: franchise_id
- 판매 금액: SUM(total_sales_amount)
- 판매 수량: SUM(total_quantity)
- 원본 판매 내역 수: SUM(source_row_count)
- Gold 집계 행 수: COUNT(*)

'판매 내역 수'와 'Gold 행 수'를 구분한다.
주문 수·고객 수는 이 데이터로 알 수 없다.
통화 정보가 없으므로 원화나 달러로 단정하지 않는다.
기간을 지정하지 않으면 테이블에 있는 전체 기간을 조회한다.
데이터에 없는 값이나 판매 원인을 추측하지 않는다.
```

규칙에 정답인 67이나 16을 넣지 않는다. **값을 외우게 하는 대신 계산 방법을 알려주는 것**이다. 규칙을 등록해도 생성된 SQL이 맞는지는 별도로 확인한다.

[![Configure의 Instructions에서 금액·수량·내역 수의 계산 규칙을 입력하고 Save하는 화면](/images/databricks-applications-2/configure-genie-instructions.png)](/images/databricks-applications-2/configure-genie-instructions.png)

## 4. 예제 질문과 SQL 등록하기

텍스트 규칙은 의미를 설명하고, 예제 SQL은 **질문을 실제 쿼리로 옮기는 방법**을 보여준다. **Configure → Examples → Add → Example query**를 선택한다. 질문 제목에는 아래 문장을 넣는다.

```text
전체 판매 금액, 판매 수량, 원본 판매 내역 수를 알려줘.
```

SQL 입력란에는 다음 코드를 넣고 저장한다. **여기에는 `%sql`을 붙이지 않는다.**

```sql
SELECT
    SUM(total_sales_amount) AS sales_amount,
    SUM(total_quantity) AS quantity,
    SUM(source_row_count) AS source_rows
FROM workspace.bakehouse_file_lab.gold_daily_product_sales
```

예제 SQL은 비슷한 질문을 처리할 때 참고하는 기준이다. 이후 질문에서 항상 이 쿼리를 그대로 쓴다는 뜻은 아니다. [예제 SQL과 텍스트 지침](https://docs.databricks.com/aws/en/genie-agents/tune-quality)

[![Configure의 Examples에서 Add와 Example query를 선택하는 메뉴](/images/databricks-applications-2/add-genie-example-query.png)](/images/databricks-applications-2/add-genie-example-query.png)

[![전체 판매 합계 질문과 세 컬럼을 SUM으로 집계하는 예제 SQL을 입력한 화면](/images/databricks-applications-2/save-genie-example-query.png)](/images/databricks-applications-2/save-genie-example-query.png)

## 5. 전체·상품별 결과 질문하기

Agent의 **New chat**을 열고 아래 질문을 입력한다. 모드 선택이 보이면 이번 단순 집계는 **Chat** 모드에서 진행한다.

```text
전체 판매 금액, 판매 수량, 원본 판매 내역 수를 알려줘.
```

예상 값은 **67.00·16·3**이다. 답변의 **Show code** 또는 **Show generated code**를 열고 다음을 확인한다.

- `workspace.bakehouse_file_lab.gold_daily_product_sales`를 조회했는가.
- 금액·수량·내역 수에 각각 `SUM`을 썼는가.
- 요청하지 않은 날짜·상품 조건이 붙지 않았는가.

**문장이 자연스럽다는 이유만으로 정답으로 보지 않는다.** SQL이 질문에 맞고 결과도 기준값과 같아야 한다. [질문과 생성 코드 확인](https://docs.databricks.com/aws/en/genie-agents/talk-to-genie)

같은 대화에서 이어서 질문한다.

```text
상품별 판매 금액, 판매 수량, 원본 판매 내역 수를 보여줘.
판매 금액이 큰 순서로 정렬해줘.
```

| product | 판매 금액 | 판매 수량 | 원본 판매 내역 수 |
| --- | ---: | ---: | ---: |
| Outback Oatmeal | 40.00 | 7 | 2 |
| Orchard Oasis | 27.00 | 9 | 1 |

**`01_check_genie`의 새 SQL 셀에서 아래 코드를 실행해 비교한다.**

```sql
%sql
SELECT
    product,
    SUM(total_sales_amount) AS sales_amount,
    SUM(total_quantity) AS quantity,
    SUM(source_row_count) AS source_rows
FROM workspace.bakehouse_file_lab.gold_daily_product_sales
GROUP BY product
ORDER BY sales_amount DESC;
```

Genie의 SQL 문장이 달라도 같은 조건과 집계를 수행하면 된다. 전체 합계와 상품별 합계가 맞는지 확인한다.

Genie의 전체 합계는 **67·16·3**으로 기준값과 같았다. 상품별 답변도 **Outback Oatmeal 40·7·2, Orchard Oasis 27·9·1**로 나왔다.

[![Genie가 전체 판매 금액 67·수량 16·원본 판매 내역 3을 반환한 답변과 결과 표](/images/databricks-applications-2/genie-total-sales-answer.png)](/images/databricks-applications-2/genie-total-sales-answer.png)

[![상품별 금액·수량·내역 수의 결과 표와 Genie가 생성한 비교 차트](/images/databricks-applications-2/genie-product-sales-answer.png)](/images/databricks-applications-2/genie-product-sales-answer.png)

## 6. 대시보드용 데이터 준비하기

**여기부터는 판매 Gold 대신 뉴욕 택시 데이터를 사용한다.** 판매 예제는 Gold 2행이라 결과를 검산하기 쉽다. 반면 다양한 차트를 만들기에는 날짜와 상품이 적다. 택시 데이터에는 시간·지역·거리·운임이 있어 **AI가 여러 관점의 대시보드를 구성하는 과정**을 살펴보기 좋다.

원본은 Databricks의 `samples.nyctaxi.trips`다. 별도 파일 업로드 없이 조회하는 샘플 테이블이며, 각 행은 운행 기록이다. [샘플 데이터](https://docs.databricks.com/aws/en/discover/databricks-datasets#nyctaxi)

### 공통 분석 뷰 만들기

`bakehouse_bi_lab` 폴더에 Python Notebook **`02_prepare_taxi`** 를 추가하고 Compute는 Serverless로 선택한다. **첫 SQL 셀에서 아래 코드를 실행한다.**

```sql
%sql
CREATE SCHEMA IF NOT EXISTS workspace.nyctaxi_bi_lab;

CREATE OR REPLACE VIEW workspace.nyctaxi_bi_lab.trips_dashboard AS
SELECT
    tpep_pickup_datetime AS pickup_at,
    CAST(tpep_pickup_datetime AS DATE) AS trip_date,
    dayofweek(tpep_pickup_datetime) AS pickup_weekday,
    hour(tpep_pickup_datetime) AS pickup_hour,
    CAST(pickup_zip AS STRING) AS pickup_zip,
    CAST(dropoff_zip AS STRING) AS dropoff_zip,
    trip_distance,
    CAST(fare_amount AS DECIMAL(18, 2)) AS fare_amount,
    timestampdiff(SECOND, tpep_pickup_datetime, tpep_dropoff_datetime)
        / 60.0 AS duration_minutes
FROM samples.nyctaxi.trips
WHERE trip_distance > 0 AND trip_distance < 10
  AND fare_amount > 0 AND fare_amount < 50
  AND tpep_dropoff_datetime > tpep_pickup_datetime
  AND timestampdiff(SECOND, tpep_pickup_datetime, tpep_dropoff_datetime)
        <= 7200;
```

뷰는 원본 데이터를 복사하지 않고 조회 조건과 컬럼 계산을 저장한다. [CREATE VIEW](https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-ddl-create-view)

이번 실습은 **거리 0 초과·10마일 미만, 운임 0 초과·50달러 미만, 소요 시간 0 초과·120분 이하**의 기록만 사용한다. 전체 뉴욕 택시 통계를 대표하는 데이터로 해석하지 않는다. 거리·운임 조건은 공식 대시보드 예제와 같으며, 소요 시간 조건은 이 실습에서 추가했다. [택시 대시보드 예제](https://docs.databricks.com/aws/en/dashboards/tutorials/create-dashboard)

`duration_minutes`는 승하차 시각의 차이를 초로 구한 뒤 분으로 환산한다. `pickup_weekday`는 일요일 1부터 토요일 7까지다. [timestampdiff](https://docs.databricks.com/aws/en/sql/language-manual/functions/timestampdiff), [dayofweek](https://docs.databricks.com/aws/en/sql/language-manual/functions/dayofweek)

### 2016년 기준값 확인

**같은 Notebook의 새 SQL 셀에서 실행한다.**

```sql
%sql
SELECT
    MIN(trip_date) AS start_date,
    MAX(trip_date) AS end_date,
    COUNT(*) AS trip_count,
    SUM(fare_amount) AS total_fare,
    ROUND(AVG(fare_amount), 2) AS avg_fare,
    ROUND(AVG(trip_distance), 2) AS avg_distance
FROM workspace.nyctaxi_bi_lab.trips_dashboard
WHERE trip_date BETWEEN DATE '2016-01-01' AND DATE '2016-12-31';
```

위 SQL은 2016년 범위에서 실제 기록이 있는 첫날·마지막 날과 지표를 조회한다. 아래 대시보드 캡처에서는 2016-01-01~2016-02-29가 표시됐다.

이 출력으로 사용할 데이터의 기간과 규모를 확인한다. 0행이면 원본과 조회 조건을 확인한다.

택시 데이터의 `fare_amount`는 운임이다. 팁·통행료 등을 합친 전체 결제액이나 순이익으로 표시하지 않는다.


## 7. Genie Code로 택시 대시보드 자동 구성하기

**Genie Agent 대화창에서 나와 Dashboards로 이동한다.** 판매 Agent는 그대로 두고 택시용 대시보드를 새로 만든다. 판매 Agent의 지침은 새 대시보드에 자동 전달되지 않으므로, 필요한 규칙을 이번 프롬프트에 넣는다.

1. **Dashboards → Create**로 새 대시보드를 만든다.
2. 이름을 `NYC Taxi 운행 분석`으로 바꾼다.
3. Canvas 중앙의 **Genie Code** 입력란을 사용한다. 보이지 않으면 Genie Code 사이드 패널을 연다.
4. 모드 선택이 보이면 **Agent**를 선택한다.

대시보드 자동 작성에는 지원 지역과 AI 기능 설정 조건이 있다. 기능이 보이지 않으면 해당 workspace에서 사용할 수 있는지 확인한다. [자동 작성과 요구 조건](https://docs.databricks.com/aws/en/dashboards/manage/dashboard-agent)

**아래 내용을 대시보드의 Genie Code에 입력한다.** `@`로 뷰를 검색해 컨텍스트에 추가할 때는 `workspace.nyctaxi_bi_lab.trips_dashboard`인지 확인한다.

```text
workspace.nyctaxi_bi_lab.trips_dashboard 뷰만 사용해
현재 대시보드에 뉴욕 택시 운행 분석 화면을 실제로 만들어줘.
원본 테이블과 뷰 정의는 변경하지 마.

먼저 뷰의 컬럼, 최소·최대 trip_date, 행 수를 확인해줘.
한 행은 운행 기록이고, fare_amount는 운임(USD), trip_distance는 마일이야.
pickup_zip과 dropoff_zip은 우편번호 문자열이야.
duration_minutes는 운행 소요 시간(분)이야.

대시보드는 두 페이지로 구성해줘.

1. 운행 개요
- 카드 4개: 운행 건수 COUNT(*), 운임 합계 SUM(fare_amount),
  평균 운임 AVG(fare_amount), 평균 거리 AVG(trip_distance)
- 일별 운행 건수와 일별 운임 합계의 추이 차트
- 요일×승차 시간대별 운행 건수 히트맵
  pickup_weekday의 1은 일요일, 7은 토요일이야.

2. 지역·운행 특성
- 출발 우편번호별 운행 건수 상위 10개
- 도착 우편번호별 운행 건수 상위 10개
- 운행 거리(X)와 운임(Y)의 산점도
- 소요 시간 분포 히스토그램

두 페이지의 분석용 데이터셋에 아래 SQL 파라미터를 적용해줘.
- start_date: Date, 기본값 2016-01-01
- end_date: Date, 기본값 2016-12-31
- min_distance: Numeric, 기본값 0, 허용 범위 0~9
- pickup_zip_filter: String, 기본값 All
  선택지는 All과 뷰의 실제 출발 우편번호 값으로 구성해줘.
All이면 출발 우편번호 조건을 적용하지 마.

trip_date는 시작일·종료일을 모두 포함하고,
trip_distance >= min_distance 조건을 적용해줘.
입력 위젯은 모든 분석에 같은 값을 전달하도록 연결해줘.
우편번호 선택지를 조회하는 데이터셋은 선택 조건 때문에 목록이 줄지 않게 분리해줘.

집계 지표와 추이·순위·히트맵·히스토그램에는 조건에 맞는 전체 행을 사용해줘.
산점도만 필터 적용 후 pickup_at 순으로 최대 2,000행을 표시하고
제목에 '최대 2,000행 표시'라고 써줘. 무작위 대표 표본이라고 설명하지 마.
평균은 집계된 평균의 단순 평균 대신 운행 원본 행에서 계산해줘.

제목과 설명은 한국어로 쓰고, 숫자는 천 단위 구분을 적용해줘.
상단에 입력 컨트롤, 그 아래 핵심 지표와 차트를 정돈해서 배치해줘.
페이지마다 공통 조건을 확인할 수 있게 해줘.
결과 숫자를 고정하지 말고 데이터셋 SQL로 계산해줘.
데이터에 없는 좌표를 만들거나 다른 테이블을 연결하지 마.
```

Genie Code가 계획이나 변경 승인을 요청하면 **사용할 뷰와 생성할 요소를 확인한 뒤 진행한다.** 작업 중에는 현재 탭을 열어 둔다. 배치와 데이터셋 이름은 실행마다 달라질 수 있다. [자동 작성 흐름](https://docs.databricks.com/aws/en/dashboards/manage/dashboard-agent#use-genie-code-for-dashboard-authoring)

설명만 나오면 같은 대화에 다음을 입력한다.

```text
계획을 현재 대시보드의 데이터셋·페이지·위젯으로 구현해줘.
필요한 변경 승인을 요청하고 입력 위젯과 파라미터 연결까지 완료해줘.
```

구성이 끝나면 화면을 살펴보고 필요하다면 후속 요청한다.

```text
데이터와 계산식은 유지하고 대시보드 디자인을 다듬어줘.
핵심 지표 카드의 크기와 간격을 맞추고, 시간 추이는 가로로 넓게 배치해줘.
히트맵은 요일 순서와 시간 순서를 명확히 표시하고,
우편번호 상위 순위는 값이 큰 항목부터 읽기 쉽게 배치해줘.
```

### AI가 구성한 대시보드

운행 개요에는 입력 컨트롤 네 개, 핵심 지표 카드 네 개, 일별 추이와 요일×시간대 히트맵이 배치됐다. 전체 개요 화면의 카드는 운행 건수 **2.07만**, 운임 합계 **21.71만**, 평균 운임 **10.5**, 평균 거리 **2.21**로 표시됐다. 앞의 두 값은 화면에서 축약된 표시다.

[![Genie Code가 구성한 택시 운행 개요의 입력 컨트롤·지표 카드·일별 추이·요일 시간대 히트맵](/images/databricks-applications-2/ai-taxi-overview.png)](/images/databricks-applications-2/ai-taxi-overview.png)

일별 추이는 운행 건수를 막대, 운임 합계를 선으로 표시한 Combo 차트로 만들어졌다. 다음 캡처는 2016-02-27을 선택한 상태다. 운행 건수 394 등 카드 값은 전체 합계와 구분한다.

[![2016-02-27 선택 상태의 운행 개요와 COUNT 및 SUM을 연결한 Combo 차트 설정](/images/databricks-applications-2/ai-taxi-combo-chart.png)](/images/databricks-applications-2/ai-taxi-combo-chart.png)

지역·운행 특성 페이지에는 출발·도착 우편번호별 운행 순위, 거리와 운임의 산점도, 소요 시간 분포가 배치됐다. 이 캡처에도 차트 선택 조건이 남아 있다. 산점도는 요청한 대로 최대 2,000행 표시로 제목이 붙었다.

[![차트 선택 조건이 표시된 지역 분석 페이지의 우편번호별 운행 순위·거리 운임 산점도·소요 시간 분포](/images/databricks-applications-2/ai-taxi-region-analysis.png)](/images/databricks-applications-2/ai-taxi-region-analysis.png)

## 마무리

판매 데이터에서는 Genie Agent가 질문을 SQL로 바꾸는 과정을 살펴봤다. 택시 데이터로 전환한 뒤에는 Genie Code에 분석할 항목과 화면 구성을 요청해 **카드·추이 차트·히트맵·지역 순위·입력 컨트롤을 갖춘 두 페이지 대시보드**를 구성했다.

1편에서 직접 배치했던 데이터셋과 위젯을 이번에는 AI가 생성했다. AI에 사용할 데이터와 지표 계산법, 필요한 차트를 구체적으로 전달하고, 후속 요청으로 화면을 다듬는 데까지가 이번 실습이다.
