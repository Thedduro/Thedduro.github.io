---
title: "[Databricks] Delta History와 Time Travel: 변경 이력과 이전 데이터 조회 - 6편"
date: 2026-10-12T17:47:11+09:00
draft: false
description: "Delta History로 테이블의 변경 작업과 버전을 확인하고, Time Travel로 수정 전후 데이터를 조회한다. 두 기능의 차이와 이전 버전 조회의 보존 조건을 실습으로 살펴본다."
slug: "databricks-basics-6"
categories: ["Data Engineering"]
tags: ["Data Engineering", "Databricks", "Delta Lake", "SQL", "PySpark"]
series: "Databricks 기초"
seriesOrder: 6
---

[5편](/posts/databricks-basics-5/)에서는 CSV의 정정 내역을 Silver에 반영했다. 현재 테이블에는 정정된 값이 남는다. **언제 바뀌었는지, 바뀌기 전 값은 무엇이었는지** 확인하려면 어떻게 해야 할까?

**Delta History는 변경 이력을, Time Travel은 특정 버전의 데이터를 조회한다.** 이번에는 금액 한 행을 수정하고 두 기능으로 변경 전후를 확인한다.

실습 화면은 2026년 10월 12일 Databricks Free Edition의 Serverless Notebook에서 촬영했다. History와 Time Travel 동작은 같은 날짜의 Databricks on AWS 공식 문서를 기준으로 설명한다.

## Delta History와 Time Travel의 차이

Delta 테이블은 데이터를 기록·변경할 때 버전을 남긴다. **Delta History**에서는 버전 번호, 실행 시각, 작업 종류와 작업별 지표를 확인한다. 금액을 수정했다면 `UPDATE` 작업의 이력을 찾는 식이다. [DESCRIBE HISTORY](https://docs.databricks.com/aws/en/sql/language-manual/delta-describe-history), [이력 컬럼과 작업 지표](https://docs.databricks.com/aws/en/tables/history-schema)

**Time Travel**은 버전 번호나 시각을 지정해 당시 테이블을 읽는다. 수정 전 버전을 조회하면 이전 금액을 확인할 수 있다. 과거 데이터를 조회하는 동안 현재 테이블의 값은 그대로 유지된다. [이전 버전 조회](https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-qry-select-table-reference#as-of-syntax)

| 구분 | Delta History | Time Travel |
| --- | --- | --- |
| 확인할 질문 | 언제, 어떤 작업으로 바뀌었나? | 그 버전의 데이터는 무엇인가? |
| 조회 대상 | 변경 작업과 버전의 이력 | 특정 버전의 행·컬럼 |
| 사용 방법 | `DESCRIBE HISTORY` | `VERSION AS OF`, `TIMESTAMP AS OF` |
| 이번 실습 | 금액 수정의 작업·버전 확인 | 수정 전후 금액·합계 비교 |
| 현재 데이터 변경 | 없음 | 없음 |

보통 **History에서 필요한 버전을 찾고 → Time Travel로 그 버전을 읽는다.**

## 1. 실습용 테이블 준비하기

**5편을 마친 상태에서 시작한다.** Workspace에 `bakehouse_history_lab` 폴더와 `01_history_time_travel` Notebook을 만든다. 기본 언어는 Python, Compute는 Serverless로 선택한다. 이번 실습은 **이 Notebook 하나에서 셀을 순서대로 실행**한다.

**첫 SQL 셀에 아래 코드를 넣고 실행한다.** 5편의 Silver를 별도 테이블로 복사하고, 복사한 테이블만 수정한다.

```sql
%sql
CREATE SCHEMA IF NOT EXISTS workspace.bakehouse_history_lab;

CREATE OR REPLACE TABLE workspace.bakehouse_history_lab.sales_demo
USING DELTA
AS
SELECT * FROM workspace.bakehouse_file_lab.silver_sales;

SELECT COUNT(*) AS rows,
       SUM(quantity) AS quantity,
       SUM(sales_amount) AS amount
FROM workspace.bakehouse_history_lab.sales_demo;

SELECT transaction_id, product, quantity, sales_amount
FROM workspace.bakehouse_history_lab.sales_demo
ORDER BY transaction_id;
```

기준은 **3행·수량 16·금액 67.00**이다. 거래 `1000000`의 금액은 20.00이다. 결과가 다르면 5편의 처리 결과를 먼저 확인한다.

이 준비 셀은 처음 한 번만 실행한다. 이후에는 해당하는 새 셀만 실행한다. 처음부터 다시 실습하려면 1절부터 순서대로 진행한다.

복사된 세 행의 금액은 20.00·27.00·20.00이며 합계는 67.00이다.

[![5편의 Silver를 복사한 실습 테이블에서 거래 세 행과 금액 20.00·27.00·20.00을 확인한 화면](/images/databricks-basics-6/prepare-sales-demo.png)](/images/databricks-basics-6/prepare-sales-demo.png)

## 2. 실습 A: Delta History로 변경 이력 확인하기

### 수정 전 버전 저장

**새 Python 셀에서 현재 버전을 읽는다.**

```python
%python
before_version = int(spark.sql(
    "DESCRIBE HISTORY workspace.bakehouse_history_lab.sales_demo LIMIT 1"
).first()["version"])
print({"before_version": before_version})
```

`before_version`은 수정 전 버전 번호다. 실습 B에서 그대로 사용하므로 **같은 Notebook에서 이어서 실행**한다. 테이블 생성·재실행 이력에 따라 번호가 달라질 수 있어 0이나 1로 고정하지 않는다.

실습에서 `before_version`은 0으로 출력됐다.

[![DESCRIBE HISTORY로 읽은 수정 전 before_version이 0으로 출력된 화면](/images/databricks-basics-6/capture-before-version.png)](/images/databricks-basics-6/capture-before-version.png)

### 금액 한 행 수정

**새 SQL 셀에서 거래 `1000000`의 금액을 20.00에서 25.00으로 바꾼다.**

```sql
%sql
UPDATE workspace.bakehouse_history_lab.sales_demo
SET sales_amount = 25.00
WHERE transaction_id = 1000000;
```

수량과 다른 거래는 그대로다. 금액 합계는 **67.00 + 5.00 = 72.00**이 된다. [UPDATE](https://docs.databricks.com/aws/en/sql/language-manual/delta-update)

### History 조회

**새 Python 셀에서 변경 이력을 조회한다.**

```python
%python
history = spark.sql("DESCRIBE HISTORY workspace.bakehouse_history_lab.sales_demo")
display(history.select("version", "timestamp", "operation", "operationMetrics"))
after_version = int(history.orderBy("version", ascending=False).first()["version"])
print({"before_version": before_version, "after_version": after_version})
```

`operation`이 `UPDATE`인 행을 찾는다. `operationMetrics`의 `numUpdatedRows`는 1이어야 한다. 수정 전보다 큰 버전이 생겼는지도 확인한다.

| 컬럼 | 확인할 내용 |
| --- | --- |
| `version` | 작업이 반영된 테이블 버전 |
| `timestamp` | 작업 시각 |
| `operation` | 이번 금액 수정은 `UPDATE` |
| `operationMetrics` | 수정 행 수 등 작업별 지표 |

History에는 최적화 같은 작업도 나타날 수 있다. **버전이 늘었다는 사실만으로 특정 금액이 바뀌었다고 판단하지 않는다.** 실제 값은 다음 실습에서 비교한다.

이력에는 버전 0의 테이블 생성, 버전 1의 `UPDATE`, 버전 2의 `OPTIMIZE`가 표시됐다. 따라서 이번 코드의 `after_version`은 2다. `OPTIMIZE`는 데이터 파일 배치를 최적화하는 작업이며, 금액을 바꾼 작업은 버전 1의 `UPDATE`다. [OPTIMIZE](https://docs.databricks.com/aws/en/delta/optimize)

[![버전 0의 테이블 생성, 버전 1의 UPDATE, 버전 2의 OPTIMIZE 이력과 전후 버전 출력](/images/databricks-basics-6/describe-table-history.png)](/images/databricks-basics-6/describe-table-history.png)

## 3. 실습 B: Time Travel로 이전 데이터 조회하기

### 수정 전후 테이블 읽기

**새 Python 셀에서 저장한 두 버전을 조회한다.**

```python
%python
comparison_sql = f"""
SELECT '수정 전' AS state, COUNT(*) AS rows,
       SUM(quantity) AS quantity, SUM(sales_amount) AS amount
FROM workspace.bakehouse_history_lab.sales_demo VERSION AS OF {before_version}
UNION ALL
SELECT '수정 후' AS state, COUNT(*) AS rows,
       SUM(quantity) AS quantity, SUM(sales_amount) AS amount
FROM workspace.bakehouse_history_lab.sales_demo VERSION AS OF {after_version}
"""
display(spark.sql(comparison_sql).orderBy("state"))
```

Python의 문자열에 `before_version`, `after_version`을 넣어 SQL을 만든다. **버전 번호를 직접 수정할 필요는 없다.** 핵심 문법은 테이블 이름 뒤의 `VERSION AS OF 버전번호`다.

| 조회한 버전 | 행 수 | 수량 합계 | 금액 합계 |
| --- | --- | --- | --- |
| 수정 전 `before_version` | 3 | 16 | 67.00 |
| 수정 후 `after_version` | 3 | 16 | 72.00 |

현재 테이블이 72.00인 상태에서도 수정 전 버전에서는 67.00을 읽을 수 있다.

버전 0과 2를 조회한 결과, 행 수는 모두 3이고 수량 합계는 16이었다. 금액 합계만 67.00에서 72.00으로 달라졌다.

[![Time Travel로 버전 0과 2를 조회해 각각 3행·수량 16과 금액 합계 67.00·72.00을 비교한 결과](/images/databricks-basics-6/compare-version-totals.png)](/images/databricks-basics-6/compare-version-totals.png)

### 금액이 달라진 거래 찾기

**새 Python 셀에서 두 버전을 거래 식별자로 연결한다.**

```python
%python
changed_sql = f"""
SELECT b.transaction_id, b.product,
       b.sales_amount AS before_amount,
       a.sales_amount AS after_amount,
       a.sales_amount - b.sales_amount AS amount_difference
FROM workspace.bakehouse_history_lab.sales_demo VERSION AS OF {before_version} b
JOIN workspace.bakehouse_history_lab.sales_demo VERSION AS OF {after_version} a
    ON b.transaction_id = a.transaction_id
WHERE b.sales_amount <> a.sales_amount
"""
display(spark.sql(changed_sql))
```

이번에는 삭제·추가 없이 한 행의 금액만 수정했으므로 같은 거래를 연결해 비교한다. 결과는 **거래 `1000000` 한 행, 이전 금액 20.00·이후 금액 25.00·차이 5.00**이어야 한다.

실제 비교 결과도 거래 `1000000` 한 행이며 금액 차이는 5.00이었다.

[![거래 1000000의 버전별 금액 20.00·25.00과 차이 5.00을 확인한 결과](/images/databricks-basics-6/compare-changed-transaction.png)](/images/databricks-basics-6/compare-changed-transaction.png)

### 현재 값이 유지되는지 확인

**마지막 SQL 셀에서 버전을 지정하지 않고 조회한다.**

```sql
%sql
SELECT transaction_id, sales_amount
FROM workspace.bakehouse_history_lab.sales_demo
WHERE transaction_id = 1000000;

SELECT SUM(sales_amount) AS current_amount
FROM workspace.bakehouse_history_lab.sales_demo;
```

현재 거래 금액은 25.00, 합계는 72.00이어야 한다. **Time Travel은 과거 데이터를 읽는 기능이며, 조회만으로 현재 값이 복원되지는 않는다.** 현재 테이블을 이전 상태로 되돌리는 `RESTORE`와 역할이 다르다. [조회와 복원](https://docs.databricks.com/aws/en/tables/history#restore-a-table-to-an-earlier-state)

과거 버전을 읽은 뒤 현재 합계를 조회해도 72.00이 유지됐다.

[![과거 버전을 조회한 뒤 현재 테이블 금액 합계가 72.00으로 유지된 결과](/images/databricks-basics-6/verify-current-total.png)](/images/databricks-basics-6/verify-current-total.png)

## 이전 버전은 언제까지 조회할 수 있을까

이력과 과거 데이터는 보존 조건이 다르다. 기본 설정은 **이력 로그 30일**, **사용되지 않는 데이터 파일의 보존 기준 7일**이다. 이전 버전을 읽으려면 그 버전의 로그와 데이터 파일이 모두 남아 있어야 하며, 실행 환경의 보존 기간 제한도 적용된다. [보존 조건](https://docs.databricks.com/aws/en/tables/history#configure-data-retention-for-time-travel-queries)

History에 버전이 보여도 필요한 파일이 삭제됐다면 Time Travel로 읽을 수 없다. 따라서 장기 백업을 대신하는 기능으로 보지는 않는다. 이번에는 생성·수정·조회를 같은 실습에서 진행하고 `VACUUM`은 실행하지 않는다.

## 랩업

**History는 변경된 작업을 찾고, Time Travel은 그때의 데이터를 읽는다.** 이번 실습에서는 `UPDATE` 이력과 버전을 확인한 뒤, 수정 전후 금액이 20.00과 25.00이라는 것을 직접 비교했다.

기초 시리즈에서는 테이블 구성·작업 자동화·변경 반영·파일 수집에 이어 이전 데이터 조회까지 다뤘다. 데이터를 갱신하는 것뿐 아니라 **무엇이 바뀌었는지 확인할 방법**도 함께 준비해야 한다.
