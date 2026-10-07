---
title: "[Databricks] Lakeflow Jobs 실습: Bronze·Silver·Gold 작업 자동화하기 - 3편"
date: 2026-10-07T13:56:39+09:00
draft: false
description: "Bakehouse 실습을 Lakeflow Jobs의 네 작업으로 연결한다. 품질 검사 실패 시 Gold 실행을 중단하고, 트리거와 스케줄을 설정해 매일 자동 실행한다."
slug: "databricks-basics-3"
categories: ["Data Engineering"]
tags: ["Data Engineering", "Databricks", "Lakeflow Jobs", "PySpark"]
series: "Databricks 기초"
seriesOrder: 3
---

[2편](/posts/databricks-basics-2/)에서는 Notebook의 셀을 직접 실행해 Bronze·Silver·Gold 테이블을 만들었다. 이번에는 **Lakeflow Jobs로 실행 순서를 연결하고, Silver 품질 검사에 실패하면 Gold를 갱신하지 않도록** 구성한다.

Jobs는 Notebook 같은 작업을 묶어 실행 순서와 일정을 관리한다. 하나의 실행 흐름이 **job**, 그 안에서 Notebook 하나를 실행하는 단위가 **task**다. 실제 코드는 각 task의 compute에서 실행된다. [Lakeflow Jobs](https://docs.databricks.com/aws/en/jobs/)

예제는 2026년 10월 7일의 Databricks on AWS 문서와 Free Edition의 Serverless 환경을 기준으로 작성했다. **Jobs 실행과 화면 캡처는 아직 확인하지 않은 초안**이며, 아래 상태 표는 확인할 예상 결과다.

## 1. 실행 단위를 네 개로 나누기

Workspace에 `bakehouse_jobs` 폴더를 만들고 다음 Notebook 네 개를 만든다. 기본 언어는 Python으로 선택한다. SQL 셀은 첫 줄에 `%sql`을 넣는다.

| Notebook | task 이름 | 역할 |
| --- | --- | --- |
| `01_bronze` | `bronze` | 원천에서 최대 1,000행 가져오기 |
| `02_silver` | `silver` | 날짜·금액·컬럼 정리 |
| `03_validate_silver` | `validate_silver` | 누락·행 수·중복 후보 검사 |
| `04_gold` | `gold` | 날짜·매장·상품별 집계 |

실행 순서는 `bronze → silver → validate_silver → gold`다. **폴더나 Notebook 이름에 번호를 붙이는 것만으로 실행 순서가 정해지지는 않는다.** Jobs에서 task의 의존 관계를 설정해야 한다.

2편과 같은 `workspace.bakehouse_lab`의 실습용 테이블을 사용한다. 아래 코드는 기존 데이터를 교체하므로 다른 용도로 쓰는 테이블 이름으로 실행하지 않는다. 각 Notebook은 앞 task의 Python 변수를 이어받는 대신, 저장된 테이블을 다시 읽는다.

Free Edition에서는 Serverless compute를 사용하며 계정당 동시 실행 job task는 최대 5개다. 이번 실습은 네 task를 순차 실행한다. [Free Edition 제한](https://docs.databricks.com/aws/en/getting-started/free-edition-limitations)

[![Workspace에서 Notebook을 다 만든 화면](/images/databricks-basics-3/create-notebooks.png)](/images/databricks-basics-3/create-notebooks.png)

### 01_bronze: 원천 읽기

첫 번째 Notebook에 다음 SQL 셀을 넣는다.

```sql
%sql
CREATE SCHEMA IF NOT EXISTS workspace.bakehouse_lab;

CREATE OR REPLACE TABLE workspace.bakehouse_lab.bronze_sales_transactions
USING DELTA
AS
SELECT *
FROM samples.bakehouse.sales_transactions
ORDER BY transactionID
LIMIT 1000;
```

2편에서 다른 catalog를 사용했다면 네 Notebook의 `workspace.bakehouse_lab`을 모두 같은 경로로 바꾼다. 실행 주체에는 원천 조회와 대상 schema·테이블 생성 및 갱신 권한이 필요하다.

### 02_silver: 날짜와 금액 정리

두 번째 Notebook의 SQL 셀이다. 날짜 기준을 유지하려면 **이 Notebook에서도 UTC를 지정**해야 한다.

```sql
%sql
SET TIME ZONE 'UTC';

CREATE OR REPLACE TABLE workspace.bakehouse_lab.silver_sales_transactions
USING DELTA
AS
SELECT
    transactionID AS transaction_id,
    franchiseID AS franchise_id,
    CAST(dateTime AS DATE) AS sales_date,
    product,
    quantity,
    CAST(unitPrice AS DECIMAL(18, 2)) AS unit_price,
    CAST(totalPrice AS DECIMAL(18, 2)) AS sales_amount
FROM workspace.bakehouse_lab.bronze_sales_transactions;
```

### 03_validate_silver: 검사 결과를 실패로 연결

2편에서는 검사 쿼리를 보고 사람이 다음 셀을 실행했다. 자동 실행에서는 **문제가 있으면 예외를 발생시켜 task를 실패시켜야 한다.** 숫자를 출력하는 것만으로는 Gold 실행을 막지 못한다.

세 번째 Notebook에 다음 Python 셀을 넣는다.

```python
from pyspark.sql import functions as F

# 실패 경로를 확인할 때만 true로 전달한다.
dbutils.widgets.text("force_failure", "false")
force_failure = dbutils.widgets.get("force_failure").strip().lower()
if force_failure not in {"true", "false"}:
    raise ValueError("force_failure에는 true 또는 false를 지정해야 한다.")

bronze_rows = spark.table(
    "workspace.bakehouse_lab.bronze_sales_transactions"
).count()
silver_df = spark.table("workspace.bakehouse_lab.silver_sales_transactions")
silver_rows = silver_df.count()

required_columns = [
    "transaction_id", "franchise_id", "sales_date", "product",
    "quantity", "unit_price", "sales_amount",
]
missing = F.lit(False)
for name in required_columns:
    missing = missing | F.col(name).isNull()
missing = missing | (F.trim(F.col("product")) == "")
missing_rows = silver_df.filter(missing).count()

duplicate_ids = (
    silver_df.groupBy("transaction_id").count()
    .filter(F.col("count") > 1).count()
)

metrics = {
    "bronze_rows": bronze_rows,
    "silver_rows": silver_rows,
    "missing_rows": missing_rows,
    "duplicate_ids": duplicate_ids,
}
print(metrics)

if silver_rows == 0:
    raise ValueError("Silver가 비어 있다.")
if bronze_rows != silver_rows:
    raise ValueError("Bronze와 Silver의 행 수가 다르다.")
if missing_rows > 0:
    raise ValueError(f"필수 값 누락: {missing_rows}행")
if duplicate_ids > 0:
    raise ValueError(f"거래 식별자 중복 후보: {duplicate_ids}개")
if force_failure == "true":
    raise ValueError("실습용 강제 실패: Gold 실행 차단 확인")

print("Silver 품질 검사 통과")
```

중복 식별자는 자동 삭제하지 않고 실행을 멈춘다. 한 거래에 여러 상품 행이 있을 수도 있으므로, 결과가 있으면 원천의 행 단위를 확인해 키와 검사 기준을 정해야 한다. 행 수 일치와 누락 검사만으로 매출 계산의 업무적 정확성까지 보장되지는 않는다.

`force_failure`는 데이터를 훼손하지 않고 실패 경로를 확인하기 위한 입력이다. Notebook 단독 실행에서는 기본값 `false`를 사용하고, Jobs에서는 task의 Parameters로 전달한다. Notebook에서 값은 `dbutils.widgets.get()`으로 읽는다. [Notebook 파라미터](https://docs.databricks.com/aws/en/jobs/parameter-use)

### 04_gold: 검사 통과 후 집계

네 번째 Notebook의 Python 셀이다.

```python
from pyspark.sql import functions as F

silver_df = spark.table("workspace.bakehouse_lab.silver_sales_transactions")
gold_df = silver_df.groupBy("sales_date", "franchise_id", "product").agg(
    F.sum("quantity").alias("total_quantity"),
    F.sum("sales_amount").alias("total_sales_amount"),
    F.count("*").alias("source_row_count"),
)

(
    gold_df.write.format("delta").mode("overwrite")
    .saveAsTable("workspace.bakehouse_lab.gold_daily_product_sales")
)

display(
    spark.table("workspace.bakehouse_lab.gold_daily_product_sales")
    .orderBy("sales_date", "franchise_id", "product")
    .limit(20)
)
```

Gold 코드 자체가 검사 task를 호출하지는 않는다. **Gold를 실행할 조건은 다음 단계에서 Jobs에 설정한다.**

## 2. Jobs에서 의존 관계 설정하기

왼쪽 **Jobs & Pipelines → Create → Job**을 열고 Notebook task를 선택한다. Job 이름은 `bakehouse-medallion`으로 바꾼다. [Job 만들기](https://docs.databricks.com/aws/en/jobs/jobs-quickstart)

[![Job 만들기](/images/databricks-basics-3/create-job.png)](/images/databricks-basics-3/create-job.png)

첫 task는 다음처럼 설정하고 **Save task**를 누른다.

| 항목 | 값 |
| --- | --- |
| Task name | `bronze` |
| Type | `Notebook` |
| Source | `Workspace` |
| Path | `bakehouse_jobs/01_bronze` Notebook 선택 |
| Compute | `Serverless` 사용 여부 확인 |

Path는 입력 문자열을 그대로 쓰기보다 파일 선택 창에서 본인이 만든 Notebook을 고른다. 이 실습은 SQL과 Python Notebook을 함께 실행하므로 SQL warehouse 대신 Serverless notebook 실행 환경을 사용한다. [Notebook task](https://docs.databricks.com/aws/en/jobs/tasks/notebook)

[![bronze task 만들기](/images/databricks-basics-3/create-bronze-task.png)](/images/databricks-basics-3/create-bronze-task.png)

이후 **Add task → Notebook**으로 세 task를 추가한다.

| Task name | Notebook | Depends on | Run if |
| --- | --- | --- | --- |
| `silver` | `02_silver` | `bronze` | `All succeeded` |
| `validate_silver` | `03_validate_silver` | `silver` | `All succeeded` |
| `gold` | `04_gold` | `validate_silver` | `All succeeded` |

각 task의 Source는 `Workspace`로 두고 Path를 선택한다. `validate_silver`의 **Parameters**에는 Key `force_failure`, Value `false`를 추가한다. 같은 이름의 job 파라미터는 만들지 않는다. job과 task에 같은 키가 있으면 job 값이 우선한다. [Task 파라미터](https://docs.databricks.com/aws/en/jobs/task-parameters)

**Depends on을 직접 확인한다.** task를 추가할 때 선택되어 있던 task에 따라 의존 관계가 자동으로 붙을 수 있다. 최종 그래프는 네 task가 한 줄로 연결되어야 한다.

`All succeeded`는 선행 task가 성공했을 때만 실행한다. `All done`으로 바꾸면 실패한 뒤에도 Gold가 실행되므로 이번 목적에 맞지 않는다. [Task 의존 관계](https://docs.databricks.com/aws/en/jobs/run-if)

[![모든 task 만들기](/images/databricks-basics-3/all-tasks.png)](/images/databricks-basics-3/all-tasks.png)

## 3. 검사가 실패하면 Gold가 멈추는지 확인하기

먼저 네 작업이 끝까지 실행되는지 확인하고, 그다음 검사 작업을 일부러 실패시켜 본다. **확인할 것은 검사 작업이 실패했을 때 Gold가 실행되지 않는지**다.

### 먼저 정상 실행하기

1. Job 화면에서 **Run now**를 누른다.
2. **Runs** 탭을 열고 방금 시작한 실행의 **Start time**을 클릭한다.
3. 실행이 끝나면 `bronze`, `silver`, `validate_silver`, `gold`가 모두 성공했는지 확인한다.
4. `validate_silver`를 클릭해 Notebook 출력을 연다. `Silver 품질 검사 통과`가 출력됐는지 확인한다.

[![Run now](/images/databricks-basics-3/run-job.png)](/images/databricks-basics-3/run-job.png)

검사 작업이 실패했다면 출력된 오류를 먼저 읽는다. 예를 들어 `필수 값 누락: 2행`은 Silver의 필수 컬럼에 값이 없는 행이 2개 있다는 뜻이다.

### 검사 작업을 일부러 실패시키기

앞에서 만든 `03_validate_silver` 코드에는 **`force_failure`라는 테스트용 입력값**이 있다. Databricks의 기본 기능이 아니라, 이번 실습에서 실패 상황을 만들려고 추가한 값이다.

- `false`: 실제 데이터 검사만 수행한다.
- `true`: 실제 데이터 검사를 통과해도 마지막에 `ValueError`를 발생시킨다.

데이터를 망가뜨리지 않고 검사 작업만 실패시켜, 후속 작업이 멈추는지 확인할 수 있다. 다음처럼 값을 바꾼다.

1. Job의 **Tasks** 탭을 연다.
2. `validate_silver` 작업을 선택한다.
3. **Parameters**에서 Key가 `force_failure`인 항목을 찾는다.
4. 그 항목의 **Value**를 `false`에서 `true`로 바꾸고 **Save task**를 누른다. Notebook 코드를 바꿀 필요는 없다.
5. **Run now**를 누르고, **Runs**에서 이번 실행을 연다.

[![작업 일부러 실패시키기](/images/databricks-basics-3/create-failure.png)](/images/databricks-basics-3/create-failure.png)

앞의 실제 데이터 검사를 통과했다면 `validate_silver`에서 `실습용 강제 실패: Gold 실행 차단 확인` 오류가 발생해야 한다. 이때 작업별 결과는 다음과 같다.

| 작업 | 이번 실행에서 확인할 결과 |
| --- | --- |
| `bronze` | 성공 |
| `silver` | 성공 |
| `validate_silver` | 일부러 발생시킨 오류로 실패 |
| `gold` | 실행되지 않고 `Upstream failed`로 표시 |

`Upstream failed`는 **앞선 작업이 실패해서 이 작업을 실행하지 않았다는 뜻**이다. Gold 코드에서 오류가 났다는 의미는 아니다. 앞에서 Gold의 실행 조건을 `All succeeded`로 정했기 때문에 검사 작업이 성공해야 Gold가 실행된다.

[![작업 실패](/images/databricks-basics-3/failure.png)](/images/databricks-basics-3/failure.png)

## 4. 트리거로 실행 시작 조건 정하기

지금까지는 `Run now`로 job을 시작했다. **트리거(trigger)는 job을 언제 시작할지 정하는 조건**이다. task의 `Depends on`과 `Run if`는 시작된 job 안의 실행 순서를 정하고, 트리거는 그 job 자체를 시작한다.

데이터 작업에서 사용하는 대표적인 실행 방식은 다음과 같다.

| 실행 방식 | 시작 조건 | 사용하는 상황 |
| --- | --- | --- |
| 수동 실행 | `Run now` 또는 API 요청 | 테스트·일회성 재처리 |
| `Scheduled` | 정해진 시간이나 간격 | 매일 판매 마트 갱신 |
| `Table update` | 감시하는 원천 테이블 갱신 | 원천 적재 후 가공 시작 |
| `File arrival` | 감시하는 Unity Catalog 저장 위치에 새 파일 도착 | 파일 수집 후 처리 시작 |
| `Continuous` | 앞선 job 실행이 끝난 뒤 다음 실행 시작 | 반복해서 실행할 작업 |

`Continuous`는 job 실행을 반복하는 방식이며, 이것을 선택한다고 Notebook의 배치 코드가 스트리밍 코드로 바뀌지는 않는다. [트리거 종류](https://docs.databricks.com/aws/en/jobs/triggers)

이번에는 원천이 준비된 Bakehouse 표본을 주기적으로 다시 읽으므로 **`Scheduled` 트리거 하나를 설정**한다. 트리거는 job 설정이므로 네 task는 그대로 유지한다.

## 5. 스케줄을 설정하고 예약 실행 확인하기

스케줄링은 시간 기준으로 실행 일정을 정하는 것이다. **Trigger type은 `Scheduled`로 두고, 그 아래 Schedule type에서 `Interval` 또는 `Schedule`을 선택한다.**

| Schedule type | 설정 내용 | 예시 |
| --- | --- | --- |
| `Interval` | 반복 간격과 단위 | 12시간마다 실행 |
| `Schedule` | 주기·실행 시각·시간대 | 한국 시간으로 매일 오전 9시 실행 |

`Interval`에서 `Every 1 Day`로 설정하면 하루 간격으로 반복한다. 매일 오전 9시처럼 특정 시각을 지정하려면 `Schedule`을 선택한다. [스케줄 설정](https://docs.databricks.com/aws/en/jobs/scheduled)

[![트리거 생성](/images/databricks-basics-3/add-trigger.png)](/images/databricks-basics-3/add-trigger.png)

1. Job details의 **Schedules & Triggers → Add trigger**를 연다.
2. **Trigger type**을 `Scheduled`로 선택한다.
3. **Schedule type**에서 `Interval` 옆의 **`Schedule` 버튼**을 누른다.
4. 실행 주기를 매일, 시각을 오전 9시, 시간대를 `Asia/Seoul`로 지정한다.
5. **Trigger Status**를 `Active`로 두고 **Save**를 누른다.

설정값은 다음과 같다.

| 항목 | 예시 |
| --- | --- |
| Trigger type | `Scheduled` |
| Schedule type | `Schedule` |
| 실행 주기 | 매일 |
| 실행 시각 | 오전 9시 |
| Time zone | `Asia/Seoul` |
| Trigger Status | `Active` |

[![트리거 설정](/images/databricks-basics-3/set-trigger.png)](/images/databricks-basics-3/set-trigger.png)

`Asia/Seoul`은 **job을 시작할 시각의 기준**이며, Silver의 날짜 변환에 사용한 UTC와는 별개다. 오전 9시에 실행하더라도 Silver의 `sales_date`는 코드에서 정한 UTC 기준으로 계산된다.

이 예제는 고정된 실습용 테이블을 교체하므로 **Maximum concurrent runs는 1로 유지**한다. 별도의 job이나 수동 Notebook에서도 같은 테이블을 동시에 갱신하지 않는다. [동시 실행 설정](https://docs.databricks.com/aws/en/jobs/configure-job#configure-maximum-concurrent-runs)

저장 후 다음 실행 예정 시각이 한국 시간 오전 9시인지 확인한다. 예약 시각이 지난 뒤 **Runs**에서 새 실행이 생겼는지, 네 task가 성공했는지와 `validate_silver`의 출력까지 확인한다. `Run now`는 수동 실행 확인이므로 예약 실행 확인과 구분한다. 스케줄러는 클라우드나 네트워크 상황에 따라 실행이 지연될 수 있다. [트리거 상태 관리](https://docs.databricks.com/aws/en/jobs/triggers#manage-existing-triggers)

## 다음에 바꿀 부분

실행을 자동화했지만 매번 표본 전체를 교체하는 방식은 그대로다. 원천을 다시 읽으면 표본도 달라질 수 있고, 수정된 판매 내역만 반영하는 처리도 없다. 다음 편에서는 `MERGE`로 새 행과 정정 데이터를 반영하고, 같은 입력을 다시 처리했을 때 중복되지 않는지 살펴본다.
