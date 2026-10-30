---
title: "[Databricks] 데이터 리니지: 매출의 출처와 변경 영향을 추적하기 - 심화 2편"
date: 2026-10-20T15:12:22+09:00
lastmod: 2026-10-21T15:55:40+09:00
draft: false
description: "Unity Catalog의 테이블·컬럼 리니지로 매출 합계의 출처를 추적한다. 같은 Silver를 사용하는 매출·건수 집계를 비교하고, 컬럼 변경의 영향 범위와 수정할 SQL을 찾는다."
slug: "databricks-advanced-2"
categories: ["Data Engineering"]
tags: ["Data Engineering", "Databricks", "Unity Catalog", "SQL"]
series: "Databricks 심화"
seriesOrder: 2
---

매출 합계가 예상과 다르면 집계 SQL부터 열어보게 된다. 그런데 집계에 사용한 테이블도 다른 테이블에서 만들어졌다면, 원본까지 거슬러 올라가야 한다. 반대로 원본 컬럼을 수정할 때는 그 값을 사용하는 결과물이 어디까지 이어지는지 알아야 한다.

**데이터 리니지(Data Lineage)는 데이터의 출처와 전달 경로를 연결한 기록이다.** 먼저 매출 합계가 어떤 원본 컬럼에서 계산됐는지 추적한다. 이어서 같은 Silver를 사용하는 매출 집계와 거래 건수 집계를 비교해, **금액 컬럼을 바꾸면 어떤 결과와 SQL을 검토해야 하는지** 찾는다.

[![데이터 리니지의 개념 사진](/images/databricks-advanced-2/what-is-data-lineage.jpeg)](/images/databricks-advanced-2/what-is-data-lineage.jpeg)

[심화 1편](/posts/databricks-advanced-1/)에서는 데이터 접근 권한을 다뤘다. 이번에는 같은 데이터가 어떤 결과에 사용되는지 살펴본다.

실습은 Serverless Notebook에서 진행했다. 화면과 공식 문서 확인은 2026년 10월 21일 기준이다. 그래프 이미지를 누르면 원본 크기로 볼 수 있다.

## 1. 테이블의 연결과 컬럼의 연결

다음 매출 처리 흐름을 예로 들어보자.

```text
bronze_sales          → silver_sales         → gold_city_sales
받은 거래 4건           완료 거래 3건            도시별 매출 2행
취소 거래 포함           수량 × 단가 계산         금액 합산
```

**테이블 리니지**는 `gold_city_sales`의 입력이 `silver_sales`이고, 그 이전 입력이 `bronze_sales`라는 관계를 보여준다. 매출이 잘못됐을 때 조사할 테이블을 좁힐 수 있다.

**컬럼 리니지**는 그 안의 계산 재료를 더 구체적으로 보여준다. 이번 예제에서는 Gold의 `total_revenue`가 Silver의 `amount`에서, `amount`는 Bronze의 `quantity`와 `unit_price`에서 만들어진다.

```text
bronze_sales.quantity ───┐
                        ├─→ silver_sales.amount ─→ gold_city_sales.total_revenue
bronze_sales.unit_price ─┘
```

다만 연결선만으로 계산식을 읽을 수는 없다. `quantity`와 `unit_price`가 연결됐다는 사실은 의존 관계를 뜻한다. 두 값을 곱했는지, 어떤 거래를 제외했는지는 실제 SQL에서 확인해야 한다.

화면에 나오는 **Upstream**은 현재 보고 있는 테이블의 입력 쪽, **Downstream**은 그 데이터를 사용하는 결과 쪽이다. Silver를 기준으로 보면 Bronze는 Upstream, Gold는 Downstream이다. 같은 연결을 어느 지점에서 보는지에 따라 방향의 이름이 달라진다.

Unity Catalog는 Databricks에서 실행한 쿼리를 통해 테이블·컬럼 관계를 수집한다. 따라서 테이블 이름만 세 개 만들어두는 대신, **앞 테이블을 읽어 다음 테이블을 저장하는 SQL**을 실행해야 한다. [Unity Catalog 리니지](https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage)

## 2. 실습 준비

왼쪽 **Workspace**에서 작업할 폴더를 열고 **Create → Notebook**을 선택한다. 이름은 `01_lineage`, 기본 언어는 **Python**으로 지정하고 상단의 compute는 **Serverless**를 선택한다.

이 글의 코드는 모두 첫 줄에 `%sql`이 있다. **코드 블록 하나를 새 셀 하나에 붙여 넣고 순서대로 실행한다.** 셀의 `-- 01_bronze` 같은 주석은 본문에서 실행 코드를 구분하기 위한 이름이다.

이번에 사용할 테이블은 모두 `workspace.uc_lineage_lab` 안에 만든다.

| 테이블 | 저장할 내용 | 처음 만든 뒤의 행 수 |
| --- | --- | ---: |
| `bronze_sales` | 원본 거래 | 4 |
| `silver_sales` | 완료 거래와 거래별 금액 | 3 |
| `gold_city_sales` | 도시별 거래 수·수량·매출 | 2 |
| `gold_city_counts` | 도시별 거래 건수 — 6절에서 추가 | 2 |

실습에는 해당 catalog에서 schema를 만들 권한이 필요하다. 앞선 글과 같은 본인 소유의 `workspace` catalog를 사용한다. 여기서 만드는 테이블은 새 실습용 데이터다.

## 3. 원본을 읽어 Gold까지 만들기

### ① Bronze: 취소 거래를 포함한 원본 4건

첫 셀을 실행한다. `sale_id = 4`는 취소된 거래다. Bronze에는 이 행도 남긴다.

```sql
%sql
-- 01_bronze
CREATE SCHEMA IF NOT EXISTS workspace.uc_lineage_lab;

CREATE OR REPLACE TABLE workspace.uc_lineage_lab.bronze_sales
USING DELTA AS
SELECT
  sale_id,
  city,
  quantity,
  CAST(unit_price AS DECIMAL(10, 2)) AS unit_price,
  status
FROM VALUES
  (1, 'Seoul', 2, 100.00, 'completed'),
  (2, 'Seoul', 1, 150.00, 'completed'),
  (3, 'Busan', 4,  25.00, 'completed'),
  (4, 'Seoul', 1,  80.00, 'cancelled')
AS source(sale_id, city, quantity, unit_price, status);

SELECT *
FROM workspace.uc_lineage_lab.bronze_sales
ORDER BY sale_id;
```

`CREATE TABLE … AS SELECT`는 쿼리 결과를 테이블에 저장한다. 이 예제의 `OR REPLACE`는 같은 셀을 다시 실행하면 기존 내용을 새 결과로 대체하도록 넣었다. [CREATE TABLE](https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-ddl-create-table-using)

### ② Silver: 완료 거래를 골라 금액 계산

두 번째 셀은 Bronze에서 `completed`인 거래만 읽는다. 수량과 단가를 곱한 결과를 `amount`에 저장한다.

```sql
%sql
-- 02_silver
CREATE OR REPLACE TABLE workspace.uc_lineage_lab.silver_sales
USING DELTA AS
SELECT
  sale_id,
  city,
  quantity,
  unit_price,
  CAST(quantity * unit_price AS DECIMAL(12, 2)) AS amount
FROM workspace.uc_lineage_lab.bronze_sales
WHERE status = 'completed';

SELECT *
FROM workspace.uc_lineage_lab.silver_sales
ORDER BY sale_id;
```

예상 결과는 다음 3행이다. 취소 거래는 빠지고, `amount` 합계는 `450.00`이다.

| sale_id | city | quantity | unit_price | amount |
| ---: | --- | ---: | ---: | ---: |
| 1 | Seoul | 2 | 100.00 | 200.00 |
| 2 | Seoul | 1 | 150.00 | 150.00 |
| 3 | Busan | 4 | 25.00 | 100.00 |

### ③ Gold: 도시별로 집계

세 번째 셀은 Silver를 읽어 도시별 거래 수, 수량 합계, 매출 합계를 저장한다.

```sql
%sql
-- 03_gold
CREATE OR REPLACE TABLE workspace.uc_lineage_lab.gold_city_sales
USING DELTA AS
SELECT
  city,
  COUNT(*) AS sales_count,
  SUM(quantity) AS total_quantity,
  SUM(amount) AS total_revenue
FROM workspace.uc_lineage_lab.silver_sales
GROUP BY city;

SELECT *
FROM workspace.uc_lineage_lab.gold_city_sales
ORDER BY city;
```

| city | sales_count | total_quantity | total_revenue |
| --- | ---: | ---: | ---: |
| Busan | 1 | 4 | 100.00 |
| Seoul | 2 | 3 | 350.00 |

[![도시별 Gold 집계 결과: 부산 매출 100.00, 서울 매출 350.00](/images/databricks-advanced-2/gold-city-sales-result.png)](/images/databricks-advanced-2/gold-city-sales-result.png)

## 4. Gold에서 원본 테이블까지 거슬러 올라가기

이제 SQL로 만든 연결을 Catalog 화면에서 찾아본다.

1. 왼쪽 **Catalog → workspace → uc_lineage_lab → gold_city_sales**를 연다.
2. **Lineage** 탭에서 **See lineage graph**를 누른다.
3. 입력 쪽의 `silver_sales`를 찾고, Silver 상자 왼쪽의 **`+`** 를 눌러 `bronze_sales`까지 펼친다.

[![Catalog에서 gold_city_sales의 Lineage 탭과 See lineage graph 버튼 열기](/images/databricks-advanced-2/catalog-lineage-tab.png)](/images/databricks-advanced-2/catalog-lineage-tab.png)

그래프는 처음에 한 단계만 펼쳐질 수 있다. Gold와 Silver만 보이면 Silver의 연결을 확장한다. [리니지 그래프 열기](https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage#view-lineage-in-catalog-explorer)

찾아야 할 경로는 **`bronze_sales → silver_sales → gold_city_sales`** 다. 별도의 입력 없이 값을 직접 적어 만든 Bronze는 이번 실습에서 추적할 출발점이다.

[![Bronze에서 Silver를 거쳐 Gold로 이어지는 테이블 리니지](/images/databricks-advanced-2/bronze-silver-gold-lineage.png)](/images/databricks-advanced-2/bronze-silver-gold-lineage.png)

이 화면으로 알 수 있는 것은 Gold의 입력 경로다. 예를 들어 Gold의 매출이 이상하면 Silver의 거래별 금액부터 확인하고, 그 값도 이상하면 Bronze의 수량·단가로 올라간다. 조사 순서를 정하는 데 사용하는 것이다.

## 5. 매출 컬럼의 계산 재료와 SQL 찾기

이번에는 **Silver의 `amount`를 기준으로 입력과 출력 양쪽의 컬럼을 한눈에 확인한다.**

1. 왼쪽 **Catalog → workspace → uc_lineage_lab → silver_sales**를 연다.
2. **Lineage → See Lineage Graph**를 클릭한다.
3. Silver의 입력 쪽에 `bronze_sales`, 출력 쪽에 `gold_city_sales`가 보이는지 확인한다. 접힌 연결은 테이블 상자 가장자리의 확장 아이콘으로 펼친다.
4. **Silver 테이블 상자의 `amount` 컬럼을 클릭한다.**

이 실습 화면에서는 왼쪽의 Bronze `quantity`·`unit_price`가 Silver `amount`로 연결되고, 오른쪽으로는 Gold `total_revenue`까지 이어진다. **수량과 단가로 거래별 금액을 만들고, 그 금액으로 매출 합계를 계산했다는 경로**다. [컬럼 리니지](https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage#view-lineage-in-catalog-explorer)

이 연결을 3절의 SQL과 대조하면 다음과 같다.

| 결과 컬럼 | 계산에 사용한 입력 컬럼 | 이 실습의 계산식 |
| --- | --- | --- |
| Gold `total_revenue` | Silver `amount` | `SUM(amount)` |
| Silver `amount` | Bronze `quantity`, `unit_price` | `quantity * unit_price` |

여러 입력 컬럼을 조합해 결과 컬럼 하나를 만들면 입력별 의존 관계가 생긴다. `amount`가 그 예다. [컬럼 리니지 기록 예시](https://docs.databricks.com/aws/en/admin/system-tables/lineage)

[![Silver의 amount를 기준으로 Bronze의 quantity와 unit_price, Gold의 total_revenue가 연결된 컬럼 리니지](/images/databricks-advanced-2/amount-column-lineage.png)](/images/databricks-advanced-2/amount-column-lineage.png)

여기서 중요한 조건은 `WHERE status = 'completed'`다. 취소 거래 80.00은 Bronze에 있지만 Silver로 넘어오지 않았다. 따라서 Gold의 전체 매출은 원본 4건의 금액 합계인 530.00이 아니라 **완료 거래 3건의 450.00**이다.

리니지는 관련 테이블과 컬럼을 찾는 데 사용하고, 합계에 어떤 거래가 포함됐는지는 SQL의 필터와 실제 행을 대조한다. 연결선만 보고 “원본의 모든 거래가 집계됐다”고 해석하면 안 된다.

## 6. 같은 테이블을 읽어도 사용하는 컬럼은 다르다

지금까지는 Silver의 결과를 사용하는 Gold가 하나였다. 이제 **거래 건수만 집계하는 Gold**를 하나 더 만든다. 두 결과가 같은 Silver를 읽더라도, 금액 컬럼의 변경에 똑같이 영향을 받는지 구분하기 위해서다.

### ① 거래 건수 집계 추가

`01_lineage` Notebook의 맨 아래에 새 SQL 셀을 만들고 실행한다. 앞에서 만든 세 테이블은 그대로 사용한다.

```sql
%sql
-- 04_gold_counts
CREATE OR REPLACE TABLE workspace.uc_lineage_lab.gold_city_counts
USING DELTA AS
SELECT
  city,
  COUNT(*) AS transaction_count
FROM workspace.uc_lineage_lab.silver_sales
GROUP BY city;

SELECT *
FROM workspace.uc_lineage_lab.gold_city_counts
ORDER BY city;
```

| city | transaction_count |
| --- | ---: |
| Busan | 1 |
| Seoul | 2 |

`gold_city_sales`는 수량과 매출까지 집계하고, 새 `gold_city_counts`는 도시별 행 수만 센다. 두 테이블의 입력은 모두 `silver_sales`다.

### ② Silver를 사용하는 두 Gold 테이블 찾기

**`04_gold_counts` 셀이 성공한 뒤**, **Catalog → workspace → uc_lineage_lab → silver_sales → Lineage → See Lineage Graph**를 다시 연다. 이미 열어둔 화면은 새로고침한다. Silver의 출력 쪽에서 이름이 **`gold_city_sales`와 `gold_city_counts`인 두 테이블 상자**를 찾는다.

```text
                              ┌→ gold_city_sales   : 거래 수·수량·매출
bronze_sales → silver_sales ───┤
                              └→ gold_city_counts  : 거래 건수
```

두 Gold 테이블은 Silver를 읽어 결과를 만들므로 Silver의 **소비자(Consumer)** 라고 부른다. 화면의 **`Consumers → Assets that read data` 상자는 두 번째 Gold 테이블이 아니다.** 이 실습에서 비교할 대상은 이름이 표시된 두 Gold 테이블이다.

테이블 연결만 보면 둘 다 Silver의 변경을 검토해야 할 후보가 된다.

[![Silver의 출력이 gold_city_counts와 gold_city_sales 두 Gold 테이블로 갈라지는 리니지](/images/databricks-advanced-2/silver-two-gold-tables.png)](/images/databricks-advanced-2/silver-two-gold-tables.png)

### ③ 금액 컬럼을 사용하는 결과 찾기

Silver 테이블 상자에서 **`amount`를 선택**한다. 5절과 같은 조작이다. 이번에는 출력 쪽의 두 Gold 중 어디에 컬럼 연결선이 생기는지 비교한다.

이 예제의 SQL에서 찾을 연결은 **`silver_sales.amount → gold_city_sales.total_revenue`** 다. 건수 집계에는 `amount`를 사용하는 식이나 조건이 없다.

| 결과 테이블 | `amount`를 사용하는 부분 | 금액 계산식만 바꿀 때 검토할 결과 |
| --- | --- | --- |
| `gold_city_sales` | `SUM(amount)` | 매출 합계 `total_revenue` |
| `gold_city_counts` | 없음 | 행과 도시가 같다면 건수는 그대로 |

테이블 리니지에서 찾은 두 후보 중, 금액 변경을 검토할 대상은 `gold_city_sales.total_revenue`로 좁혀진다. 단, 건수에 영향이 없다는 결론은 **금액만 바뀌고 거래 행과 도시 값은 유지되는 경우**에 해당한다.

### ④ 도시 컬럼은 두 결과가 모두 사용한다

같은 경로로 Silver의 Lineage 그래프를 다시 열고, 이번에는 **`city`를 선택**한다. 두 Gold의 `city`로 이어지는 컬럼 연결을 찾는다.

두 집계 모두 `GROUP BY city`를 사용한다. 예를 들어 거래 한 건의 도시를 Seoul에서 Busan으로 정정하면, 그 거래가 속하는 그룹이 양쪽 집계에서 모두 달라진다.

[![Silver의 city가 건수 집계와 매출 집계 양쪽 Gold의 city로 연결된 컬럼 리니지](/images/databricks-advanced-2/city-column-two-gold-tables.png)](/images/databricks-advanced-2/city-column-two-gold-tables.png)

테이블 단위에서는 두 집계가 같은 입력을 쓴다는 것까지 보였다. 컬럼 단위에서는 **금액은 매출 집계가, 도시는 두 집계가 함께 사용한다**는 차이를 찾았다. 이처럼 바꾸려는 컬럼을 기준으로 영향을 받는 결과를 찾는 것이 **영향 분석(Impact Analysis)** 이다.

## 7. 연결을 만든 SQL에서 수정 위치 찾기

변경 전 검토 상황을 하나 정해보자. **Silver의 `amount` 이름을 `net_amount`로 바꾸려 한다면 어떤 코드를 수정해야 할까?** 여기서는 실제 이름을 바꾸기 전에 수정 대상을 찾는다.

1. Silver의 Lineage 그래프에서 `gold_city_sales`로 이어지는 **테이블 연결선의 아이콘**을 누른다.
2. **Lineage details**에서 연결을 만든 Notebook `01_lineage`를 연다.
3. `-- 03_gold` 셀의 **`SUM(amount) AS total_revenue`** 를 찾는다.
4. Notebook의 `-- 04_gold_counts` 셀도 읽어 `amount` 참조가 있는지 비교한다.

연결 상세에서 입력·출력 테이블과 관련 Notebook을 찾을 수 있다. 이번 실습은 한 Notebook에 모았지만, 작업이 흩어진 프로젝트에서는 이 연결을 통해 살펴볼 코드를 좁힌다. [연결을 만든 작업 확인](https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage#view-lineage-in-catalog-explorer)

이 실습 코드에서 수정할 곳은 다음과 같다.

| 위치 | 변경 전 검토할 내용 |
| --- | --- |
| `02_silver` | 계산 결과의 별칭 `AS amount`를 `AS net_amount`로 바꿀 계획 |
| `03_gold` | 바뀐 컬럼을 읽도록 `SUM(amount)`도 `SUM(net_amount)`로 수정 필요 |
| `04_gold_counts` | `city`와 `COUNT(*)`만 사용하므로 컬럼 이름 변경에 따른 SQL 수정 없음 |

`02_silver`만 바꾸고 `03_gold`를 그대로 두면, 다음 실행에서 Gold가 기존 이름인 `amount`를 찾다가 실패한다. 리니지에서 발견한 소비자를 코드와 대조하면 이런 누락을 변경 전에 찾을 수 있다.

검토 결과, **Silver를 만드는 `02_silver`와 그 금액을 읽는 `03_gold`를 함께 수정해야 한다.** 실제 변경 작업에서는 이 목록을 바탕으로 수정·검증·배포 순서를 정한다.

## 8. 연결선만으로 영향이 없다고 판단하면 안 되는 이유

이번에 건수 집계가 금액을 사용하지 않는다고 판단한 근거는 두 가지다. `amount`의 컬럼 연결을 살펴봤고, 건수 집계 SQL에도 금액 참조가 없음을 확인했다. **선이 보이지 않는다는 사실 하나만으로 결론을 내린 것은 아니다.**

특히 다음 두 상황은 구분해야 한다.

| 변경 상황 | 건수 집계에 미치는 영향 |
| --- | --- |
| 같은 거래 행의 `amount` 계산식만 변경 | 금액을 읽지 않으므로 건수는 유지 |
| Silver의 완료 거래 필터를 바꿔 포함되는 행이 변경 | `COUNT(*)`가 세는 대상이 달라지므로 건수도 바뀔 수 있음 |

필터·조인·그룹 조건까지 살펴봐야 결과가 바뀌는 이유를 판단할 수 있다. 컬럼 리니지는 계산에 관계된 경로를 찾는 출발점이며, 행이 포함되거나 제외되는 조건은 SQL에서 확인한다.

또한 리니지는 수집된 실행의 기록이다. 아직 실행하지 않은 코드의 참조나 수집되지 않은 처리는 빠질 수 있다. 관계 기록이 없다는 것과 실제 의존성이 없다는 것을 같게 취급하면 안 된다. [리니지 수집 범위](https://docs.databricks.com/aws/en/admin/system-tables/lineage)

새 건수 집계가 보이지 않으면 먼저 `04_gold_counts` 셀의 성공 여부를 확인한다. 이어서 Silver의 Lineage 화면을 새로고침하고, 조회 기간에 실행 시각이 포함됐는지 확인한다. 원본 컬럼 추적에는 5절에서 확인한 **Silver 기준 화면**을 사용한다.

이 글에서 따라간 흐름은 **출처 찾기 → 소비자 구분 → 변경할 SQL 특정**이다. 데이터가 바뀐 시각이나 변경 전 값이 필요할 때는 [Delta History와 Time Travel](/posts/databricks-basics-6/)을 함께 사용한다. 리니지는 그 이력을 조사할 테이블과 작업을 찾는 데 쓰인다.
