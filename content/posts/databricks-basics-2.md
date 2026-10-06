---
title: "[Databricks] 메달리온 아키텍처 실습: Bronze·Silver·Gold 테이블 만들기 - 2편"
date: 2026-10-06T13:31:56+09:00
draft: false
description: "Databricks Notebook에서 Bronze·Silver·Gold Delta 테이블을 만들고, 계층별 역할과 품질 확인·매출 집계·검산 과정을 살펴본다."
slug: "databricks-basics-2"
categories: ["Data Engineering"]
tags: ["Data Engineering", "Databricks", "Delta Lake", "Medallion Architecture", "SQL"]
---

[1편](/posts/databricks-basics-1/)에서는 Databricks의 구성 요소와 레이크하우스의 장점을 살펴봤다. 이번에는 **Notebook에서 판매 데이터를 읽어 Bronze·Silver·Gold 테이블을 만든다.** 데이터를 어디에 저장할지에 이어, 어떤 상태로 보관하고 언제 정제·집계할지 직접 구성하는 실습이다.

1편의 쇼핑몰은 개념을 설명하기 위한 예시였다. 실습에서는 Databricks에 준비된 **Bakehouse의 가상 베이커리 판매 데이터**를 사용한다. 직접 주문 데이터를 입력할 필요 없이, Catalog에 있는 테이블을 찾는 단계부터 시작할 수 있다.

> **초안 안내:** 2026년 10월 6일 Free Edition에서 촬영한 Notebook 생성·Catalog 탐색·샘플 조회 화면을 반영했다. 이후 테이블 생성·집계·검산 코드는 실습할 순서로 작성했으며, 실행 결과와 추가 캡처는 확인 후 채울 예정이다. 본문의 ‘실습 화면 대기’ 표시는 그 위치를 뜻한다.

## 메달리온 아키텍처는 무엇을 나누는가

[![메달리온 아키텍처 설명의 이미지](/images/databricks-basics-2/medallion-architecture.png)](/images/databricks-basics-2/medallion-architecture.png)

메달리온 아키텍처는 데이터를 **원본 보관, 정제·검증, 목적별 활용** 단계로 나누는 설계 방식이다. 보통 Bronze, Silver, Gold라는 이름으로 부르며, 다음 단계로 갈수록 사용 목적에 맞게 구조와 품질 기준을 갖춰 간다. [메달리온 아키텍처](https://docs.databricks.com/aws/en/lakehouse/medallion)

판매 내역에서 날짜를 잘못 계산했다고 하자. 원본 형태를 보관한 Bronze가 있으면 그 데이터를 읽어 변환을 다시 적용할 수 있다. 상품팀과 매장 운영팀이 같은 정제 기준을 써야 한다면 Silver를 공유하고, 각 팀에 필요한 집계는 Gold로 구성할 수 있다. **가공 전 데이터와 재사용할 상세 데이터, 업무 목적의 결과를 구분하는 것**이 계층을 나누는 이유다.

| 계층 | 맡는 역할 | 이번 실습에서 하는 일 |
| --- | --- | --- |
| Bronze | 원천 데이터를 원본에 가까운 형태로 보관 | 표본의 원본 컬럼·값을 복사 |
| Silver | 데이터를 정리하고 품질을 확인 | 날짜·금액 자료형·컬럼 이름 정리, 누락·중복 후보 확인 |
| Gold | 업무에 필요한 데이터 제공 | 날짜·매장·상품별 수량과 금액 집계 |

레이크하우스가 저장·테이블 관리·분석을 연결하는 기반이라면, 메달리온은 그 안의 데이터를 단계별로 조직하는 패턴이다. 별도 제품을 설치하거나 테이블에 특별한 ‘메달’ 속성을 설정하는 기능이 아니다. Gold도 항상 집계 테이블이어야 하는 것은 아니며, 여기서는 상품 판매 마트로 구현한다.

## 이번 실습에서 만들 세 테이블

하나의 Notebook 안에서 준비 → Bronze → Silver → Gold → 검산 순서로 진행한다.

모든 결과 테이블은 `workspace.bakehouse_lab` 아래에 만든다. 실습에서는 접두사로 계층을 구분하며, 운영 환경에서는 권한과 관리 요구에 따라 schema를 나누는 구성도 가능하다.

| 단계 | 테이블 이름 | 한 행의 단위 |
| --- | --- | --- |
| 제공된 원천 | `samples.bakehouse.sales_transactions` | 샘플의 판매 내역 한 행 |
| Bronze | `bronze_sales_transactions` | 선택한 원천 데이터 한 행 |
| Silver | `silver_sales_transactions` | 정리한 판매 상세 내역 한 행 |
| Gold | `gold_daily_product_sales` | 날짜·매장·상품 조합 하나 |

원천에서 거래 식별자 순으로 최대 1,000행을 Bronze에 저장하고, 이후에는 그 표본으로 실습한다.

## 1. Notebook 만들고 실행 자원 확인하기

Workspace에서 작업할 폴더를 열고 **Create → Notebook**을 선택한다.

[![Workspace의 Create 메뉴에서 Notebook을 선택하는 화면](/images/databricks-basics-2/create-notebook.png)](/images/databricks-basics-2/create-notebook.png)

이 글의 조회 화면은 Notebook 상단에서 **Serverless**를 사용하고 있다. Notebook은 코드와 설명·결과를 모아 두는 문서이고, 코드를 실행하는 연산 자원은 이 실행 환경이 제공한다. 계정 환경에 따라 연결 가능한 자원은 달라질 수 있다.

실습은 SQL로 진행한다. Notebook 기본 언어가 Python이어도 각 코드 셀 첫 줄에 `%sql`을 넣으면 그 셀은 SQL로 실행할 수 있다. 아래 코드 블록 하나를 새 셀 하나에 붙여 넣고, 왼쪽의 실행 버튼을 누르면 된다. [Notebook의 셀 언어](https://docs.databricks.com/aws/en/notebooks/notebooks-code)

## 2. Catalog에서 원본 테이블 찾기

왼쪽 **Catalog**에서 `samples → bakehouse → sales_transactions`를 연다.

[![Catalog에서 samples, bakehouse, sales_transactions를 차례로 선택하고 판매 테이블의 컬럼을 확인하는 화면](/images/databricks-basics-2/select-bakehouse-table.png)](/images/databricks-basics-2/select-bakehouse-table.png)

`samples.bakehouse.sales_transactions`는 테이블의 전체 이름이다. `samples`는 catalog, `bakehouse`는 schema, `sales_transactions`는 table에 해당한다. SQL에서 전체 이름을 쓰면 현재 선택한 catalog나 schema에 따라 다른 테이블을 찾는 일을 피할 수 있다.

실습에 사용할 컬럼은 다음과 같다.

| 원본 컬럼 | 사용할 의미 |
| --- | --- |
| `transactionID` | 거래 식별자 |
| `franchiseID` | 매장 식별자 |
| `dateTime` | 거래 시각 |
| `product` | 상품 이름 |
| `quantity` | 판매 수량 |
| `unitPrice` | 단가 |
| `totalPrice` | 판매 내역의 금액 |

화면에는 고객 식별자와 결제 관련 컬럼도 있지만 이번 집계에는 필요하지 않다. Bronze에는 원본 컬럼을 보존하고, 화면 조회와 Silver에서는 필요한 컬럼을 선택한다. 주문 상태 컬럼을 가정해서 취소 건을 제외하거나, 거래 식별자가 같다는 이유만으로 행을 삭제하는 처리도 넣지 않는다. 그런 규칙을 적용하려면 먼저 원본의 행 단위와 업무 의미를 확인해야 한다.

Notebook으로 돌아가 첫 셀에서 10행을 조회한다.

```sql
%sql
SELECT
    transactionID,
    dateTime,
    product,
    quantity,
    unitPrice,
    totalPrice
FROM samples.bakehouse.sales_transactions
ORDER BY transactionID
LIMIT 10;
```

[![Notebook에서 Bakehouse 판매 데이터를 SELECT로 조회하고 거래 식별자 순으로 10행을 표시한 결과](/images/databricks-basics-2/query-sample-data.png)](/images/databricks-basics-2/query-sample-data.png)

촬영된 첫 행의 거래 식별자는 `1000000`이고, 수량 5 · 단가 3 · 금액 15가 표시돼 있다. 이렇게 실제 컬럼과 몇 행의 값을 먼저 보면 가공 코드를 작성할 때 어떤 데이터를 다루는지 알 수 있다.

## 3. 실습용 schema 준비하기

제공된 `samples`는 원본을 읽는 용도로 사용하고, 새 테이블은 catalog에 저장한다. 화면에 보이는 `workspace` catalog를 사용하는 예제로 진행한다.

```sql
%sql
CREATE SCHEMA IF NOT EXISTS workspace.bakehouse_lab;
```

`bakehouse_lab`은 이번 실습의 테이블들을 모아 둘 이름 공간이다. `IF NOT EXISTS`가 있으므로 같은 schema가 이미 있다면 생성하지 않는다. `workspace`라는 catalog가 없거나 생성 권한이 없다면, 쓰기 권한이 있는 catalog와 schema로 뒤의 테이블 이름을 함께 바꿔야 한다. schema를 새로 만들 때는 대상 catalog의 `USE CATALOG`, `CREATE SCHEMA` 권한이 필요하다. [CREATE SCHEMA](https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-ddl-create-schema)

[![bakehouse_lab의 스키마를 만든 화면](/images/databricks-basics-2/create-schema.png)](/images/databricks-basics-2/create-schema.png)

## 4. Bronze: 원본 형태를 보관하는 기준점 만들기

Bronze에서는 선택한 원천 데이터를 가공 전 형태로 남긴다. 이후 날짜 변환이나 금액 처리 규칙을 바꾸더라도 Bronze를 다시 읽어 Silver를 만들 수 있게 하는 것이다.

이미 테이블로 제공되는 Bakehouse 데이터를 복사한다. 원본 전체를 수집하는 대신 최대 1,000행을 선택하고, 선택한 행의 컬럼과 값은 그대로 보관한다.

```sql
%sql
CREATE OR REPLACE TABLE workspace.bakehouse_lab.bronze_sales_transactions
USING DELTA
AS
SELECT *
FROM samples.bakehouse.sales_transactions
ORDER BY transactionID
LIMIT 1000;
```

`USING DELTA`는 저장 형식을 지정한다. 경로를 직접 지정하지 않았으므로 Databricks가 저장 위치를 관리하는 관리형 테이블로 만든다. **Bronze라는 계층은 데이터의 역할이고, Delta는 테이블 형식**이다. 뒤의 Silver와 Gold도 **Delta 테이블**로 만든다. [CREATE TABLE](https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-ddl-create-table-using)

`CREATE OR REPLACE TABLE`은 같은 이름의 테이블과 내용을 교체한다. 재실행해도 행을 계속 덧붙이지 않지만, Bronze 생성 셀을 다시 실행하면 원천을 다시 읽으므로 표본이 달라질 수 있다. 이 실습의 Bronze는 한 번 가져온 표본을 확인하는 용도이며, 운영 환경의 원본 이력을 누적·보존하는 수집 방식은 별도로 설계해야 한다.

[![bronze 테이블 생성](/images/databricks-basics-2/create-bronze.png)](/images/databricks-basics-2/create-bronze.png)

새 셀에서 `bronze` 테이블의 결과를 확인한다.
```sql
%sql
SELECT COUNT(*) AS bronze_rows
FROM workspace.bakehouse_lab.bronze_sales_transactions;
```

```sql
%sql
SELECT transactionID, franchiseID, dateTime, product,
       quantity, unitPrice, totalPrice
FROM workspace.bakehouse_lab.bronze_sales_transactions
ORDER BY transactionID
LIMIT 10;
```

[![bronze 테이블 생성](/images/databricks-basics-2/result-bronze.png)](/images/databricks-basics-2/result-bronze.png)

## 5. Silver: 분석에 쓸 상세 데이터로 정리하기

`Silver`에서는 `Bronze`를 읽어 자료형과 컬럼을 정리하고 품질 기준을 확인한다. 날짜별 매출을 계산하려면 거래 시각에서 날짜를 추출해야 하고, 금액을 더하려면 어떤 컬럼과 자료형을 사용할지도 정해야 한다.

이번 실습의 기준은 다음과 같다.

- 날짜는 UTC 기준으로 계산한다. 매장별 현지 영업일로 해석하지 않는다.
- 컬럼 이름을 `transaction_id`, `sales_date`처럼 일관되게 바꾼다.
- 금액은 `DECIMAL(18, 2)`로 다루고, 원본 `totalPrice`를 `sales_amount`로 사용한다.
- 필수 값의 누락과 거래 식별자의 중복 후보를 확인한다. 의미를 확인하지 않고 행을 삭제하지 않는다.

먼저 세션의 시간대를 지정한다. 세션을 새로 시작했다면 날짜 변환 전에 다시 실행한다. [SET TIME ZONE](https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-aux-conf-mgmt-set-timezone)

```sql
%sql
SET TIME ZONE 'UTC';
```

다음 셀에서 Silver를 만든다. 이제 읽는 대상은 원천 `samples`가 아니라 앞에서 저장한 `Bronze`다.

```sql
%sql
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

고객·결제 관련 컬럼은 `Bronze`에 남겨 두고, `Silver`에는 이번 판매 분석에 필요한 컬럼을 선택했다. 집계 전의 상세 단위를 유지하므로 다른 분석에서도 이 테이블을 재사용할 수 있다.

```sql
%sql
SELECT *
FROM workspace.bakehouse_lab.silver_sales_transactions
ORDER BY transaction_id
LIMIT 10;
```

Bronze의 `dateTime`과 Silver의 `sales_date`, `totalPrice`와 `sales_amount`를 비교한다. 단순히 테이블 이름만 바꾼 것이 아니라, 분석에 사용할 표현과 자료형을 정리한 결과다.

[![silver 테이블 생성](/images/databricks-basics-2/create-silver.png)](/images/databricks-basics-2/create-silver.png)

### 누락과 중복 후보 확인하기

테이블을 생성한 뒤 다음 셀에서 필수 값 누락을 확인한다.

```sql
%sql
SELECT
    COUNT(*) AS silver_rows,
    COUNT_IF(
        transaction_id IS NULL OR sales_date IS NULL
        OR franchise_id IS NULL OR product IS NULL OR TRIM(product) = ''
        OR quantity IS NULL OR unit_price IS NULL OR sales_amount IS NULL
    ) AS missing_required_rows
FROM workspace.bakehouse_lab.silver_sales_transactions;
```

`missing_required_rows`가 0인지 확인한다. NULL을 포함한 수량과 금액을 확인하지 않고 집계하면 `SUM`이 해당 값을 건너뛰어 누락을 놓칠 수 있다.

다음으로 같은 거래 식별자가 여러 행에 등장하는지 확인한다.

```sql
%sql
SELECT transaction_id, COUNT(*) AS row_count
FROM workspace.bakehouse_lab.silver_sales_transactions
GROUP BY transaction_id
HAVING COUNT(*) > 1
ORDER BY transaction_id;
```

결과가 있으면 중복 수집인지, 한 거래에 여러 상품 행이 있는 것인지 원본을 확인해야 한다. `DISTINCT`를 붙여 행을 지우는 것으로 해결하지 않는다. 이번에는 필수 값 누락이나 설명되지 않은 중복 후보가 있으면 원인을 확인한 뒤 `Gold`로 넘어간다.

이 검사는 실행자가 결과를 보고 다음 셀 실행 여부를 판단하는 방식이다. 테이블 이름에 `silver`를 붙이거나 검사 쿼리를 실행했다고 자동으로 품질 제약이 걸리지는 않는다. 운영에서는 검사 실패 시 후속 작업을 중단하거나 문제 행을 별도 보관하는 흐름까지 연결해야 한다.

[![silver 테이블 체크](/images/databricks-basics-2/silver-checks.png)](/images/databricks-basics-2/silver-checks.png)

## 6. Gold: 날짜·매장·상품별 매출 마트 만들기

`Silver`의 판매 내역을 분석 질문에 맞게 집계한다. `Gold`의 한 행은 **날짜·매장·상품 조합 하나**가 되며, ‘어느 날, 어느 매장에서, 어떤 상품이 얼마나 팔렸는가’를 알 수 있다.

지금까지는 SQL로 처리했지만 Databricks Notebook에서는 **Spark의 Python API인 PySpark**로도 테이블을 읽고 변환할 수 있다. SQL은 원하는 집계를 문장으로 표현하기 좋고, PySpark는 변환을 변수·함수로 나누어 재사용하거나 Python의 조건문·반복문과 연결하기 편하다. Spark SQL과 DataFrame API는 같은 실행 엔진을 사용하므로, Python으로 바꾼다는 이유만으로 더 빨라지는 것은 아니다. [Spark SQL과 DataFrame](https://spark.apache.org/docs/latest/sql-programming-guide.html)

여기부터는 새 셀 첫 줄에 `%python`을 넣는다. 앞에서 SQL로 만든 Silver 테이블을 그대로 읽으면 된다. Databricks Notebook에서 제공하는 `spark`를 사용하므로 별도의 SparkSession 생성 코드는 필요하지 않다.

```python
%python
from pyspark.sql import functions as F

silver_df = spark.table("workspace.bakehouse_lab.silver_sales_transactions")

gold_df = silver_df.groupBy("sales_date", "franchise_id", "product").agg(
    F.sum("quantity").alias("total_quantity"),
    F.sum("sales_amount").alias("total_sales_amount"),
    F.count("*").alias("source_row_count"),
)

(
    gold_df.write
    .format("delta")
    .mode("overwrite")
    .saveAsTable("workspace.bakehouse_lab.gold_daily_product_sales")
)
```

`silver_df`는 Silver를 읽는 DataFrame이고, `groupBy().agg()`는 SQL의 `GROUP BY`와 집계 함수에 해당한다. `alias()`로 결과 컬럼의 이름을 정한다. `total_quantity`는 판매 수량 합계, `total_sales_amount`는 금액 합계이며, `source_row_count`는 집계에 포함된 Silver 행 수다.

`gold_df`에 변환을 작성한 것만으로 테이블이 저장되지는 않는다. 마지막의 `saveAsTable()`을 실행해야 집계 결과가 Delta 테이블에 기록된다. `overwrite`는 기존 Gold 데이터를 교체하는 방식이므로 앞서 정한 실습용 테이블 이름으로 실행한다. [saveAsTable](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrameWriter.saveAsTable.html)

저장이 끝나면 다음 Python 셀에서 테이블을 다시 읽어 확인한다. 메모리상의 변수만 보는 대신 실제 저장된 결과를 조회하는 단계다.

```python
%python
display(
    spark.table("workspace.bakehouse_lab.gold_daily_product_sales")
    .orderBy("sales_date", "franchise_id", "product")
    .limit(20)
)
```

이 Gold 테이블이 상품 판매 분석용 마트다. 분석할 때마다 원본의 날짜를 변환하고 판매 내역을 다시 합칠 필요 없이, 목적에 맞게 준비된 결과를 조회할 수 있다. 다른 분석 목적이라면 같은 Silver에서 매장별 또는 월별 Gold를 추가로 만들 수도 있다.

[![gold 테이블 생성](/images/databricks-basics-2/create-gold.png)](/images/databricks-basics-2/create-gold.png)

## 7. 세 계층이 연결됐는지 확인하기

Catalog를 새로고침하고 `workspace → bakehouse_lab`을 연다. Bronze·Silver·Gold 테이블 세 개가 생겼는지 확인하고, 각 테이블의 컬럼과 Delta 형식 표시를 살펴본다. Notebook은 생성 코드를 담고, compute가 그 코드를 실행하며, 결과는 각 테이블에 저장된다.

[![메달리온 테이블 확인](/images/databricks-basics-2/medallion-tables.png)](/images/databricks-basics-2/medallion-tables.png)

### 행 수와 집계 값 대조하기

다음 코드도 Notebook의 새 Python 셀에서 실행한다. Bronze에서 Silver로 옮기는 동안 행 수가 유지됐는지, Silver에서 Gold로 집계하면서 수량과 금액이 보존됐는지 함께 확인한다.

```python
%python
from pyspark.sql import functions as F

bronze_totals = spark.table(
    "workspace.bakehouse_lab.bronze_sales_transactions"
).agg(F.count("*").alias("bronze_rows"))

silver_totals = spark.table(
    "workspace.bakehouse_lab.silver_sales_transactions"
).agg(
    F.count("*").alias("silver_rows"),
    F.sum("quantity").alias("silver_quantity"),
    F.sum("sales_amount").alias("silver_amount"),
)

gold_totals = spark.table(
    "workspace.bakehouse_lab.gold_daily_product_sales"
).agg(
    F.count("*").alias("gold_groups"),
    F.sum("source_row_count").alias("gold_source_rows"),
    F.sum("total_quantity").alias("gold_quantity"),
    F.sum("total_sales_amount").alias("gold_amount"),
)

validation_df = (
    bronze_totals.crossJoin(silver_totals).crossJoin(gold_totals)
    .select(
        "bronze_rows", "silver_rows", "gold_groups",
        (F.col("bronze_rows") - F.col("silver_rows"))
            .alias("bronze_silver_row_difference"),
        (F.col("silver_rows") - F.col("gold_source_rows"))
            .alias("silver_gold_row_difference"),
        (F.col("silver_quantity") - F.col("gold_quantity"))
            .alias("quantity_difference"),
        (F.col("silver_amount") - F.col("gold_amount"))
            .alias("amount_difference"),
    )
)
display(validation_df)
```

각 `agg()`는 전체 테이블의 요약 한 행을 만든다. `crossJoin()`으로 이 세 행을 한 행으로 연결해 차이를 계산한다.

데이터가 비어 있지 않고 Silver의 품질 확인을 통과했다면 네 차이 값은 모두 0이어야 한다. Gold는 여러 상세 행을 묶으므로 `gold_groups`가 Silver 행 수보다 작거나 같을 수 있다. 비교할 대상은 Gold 자체의 행 수가 아니라 `source_row_count`를 합한 값이다.

전체 금액 합계는 변환 전후 값이 보존됐는지 확인하는 검산용 숫자다. 매장별 통화를 확인하지 않았으므로 회사 전체 매출 지표로 해석하지 않는다. 차이가 0이어도 날짜 구분이나 상품 분류까지 올바르다는 뜻은 아니므로 몇 개 그룹은 상세 내역과 대조한다.

[![메달리온 검증ㅂ](/images/databricks-basics-2/medallion-validation.png)](/images/databricks-basics-2/medallion-validation.png)

## 마무리하며

이번 실습에서는 Bakehouse 판매 데이터를 `Bronze`에 보관하고, `Silver`에서 날짜·금액 자료형과 컬럼을 정리한 뒤, `Gold`에서 날짜·매장·상품별로 집계했다. SQL로 만든 Silver를 PySpark에서 읽어 Gold로 저장하면서, 같은 Notebook 안에서 두 언어로 테이블을 다루는 흐름도 살펴봤다.

핵심은 **각 계층에 어떤 상태의 데이터를 남길지 정하는 것**이다. `Bronze`는 가공 전 데이터를 다시 읽을 기준점이고, `Silver`는 여러 분석에서 재사용할 상세 데이터이며, `Gold`는 분석 질문에 맞춰 준비한 결과다. 테이블 생성 뒤에는 누락·중복 후보를 확인하고 행 수·수량·금액을 대조해, 정제와 집계 과정에서 데이터가 의도대로 이어졌는지 점검했다.

여기까지는 셀을 직접 실행하고 검사 결과를 확인하는 실습이다. 운영에 적용하려면 계층별 갱신 순서를 작업으로 연결하고, 품질 검사에 실패했을 때 후속 실행을 멈추는 흐름까지 구성해야 한다.
