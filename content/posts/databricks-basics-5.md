---
title: "[Databricks] CSV 수집 실습: Volume에서 Bronze로 적재하기 - 5편"
date: 2026-10-12T16:51:18+09:00
draft: false
description: "CSV 파일을 Unity Catalog Volume에 업로드하고 COPY INTO로 Bronze에 적재한다. 신규 파일의 정정·추가 내역을 MERGE로 반영하고 재실행 결과를 확인한다."
slug: "databricks-basics-5"
categories: ["Data Engineering"]
tags: ["Data Engineering", "Databricks", "Delta Lake", "SQL", "PySpark", "Lakeflow Jobs"]
series: "Databricks 기초"
seriesOrder: 5
---

[4편](/posts/databricks-basics-4/)에서는 변경 데이터를 SQL로 만들었다. 이번에는 **CSV 파일을 업로드해 Bronze에 적재한 뒤 Silver와 Gold를 갱신한다.**

처리 순서는 **파일 업로드 → COPY INTO → MERGE → Gold 집계**다. 첫 파일로 판매 내역을 등록하고, 두 번째 파일로 금액 정정과 신규 내역을 반영한다.

실습 화면은 2026년 10월 12일 Databricks Free Edition의 Serverless Notebook에서 촬영했다. COPY INTO와 Volume 동작은 같은 날짜의 공식 문서를 기준으로 설명한다.

## 1. 실습 환경 준비하기

Workspace에 `bakehouse_file_lab` 폴더를 만들고 Notebook 네 개를 추가한다. 기본 언어는 Python, Compute는 Serverless로 선택한다.

| Notebook | 실행 시점 | 역할 |
| --- | --- | --- |
| `00_prepare` | 처음 한 번 | Volume·빈 테이블 생성 |
| `01_ingest` | 파일 업로드 후 | CSV를 Bronze에 적재 |
| `02_merge` | 적재 후 | 검사·최신 내역 선택·Silver 갱신 |
| `03_gold` | Silver 갱신 후 | Gold 집계·검산 |

결과는 `workspace.bakehouse_file_lab`에 저장한다. 앞 편의 테이블은 사용하지 않는다. 다른 catalog를 쓰면 코드의 `workspace`를 모두 바꾼다.

### Volume과 빈 테이블 만들기

**`00_prepare`에서 아래 SQL 셀을 한 번 실행한다.**

```sql
%sql
CREATE SCHEMA IF NOT EXISTS workspace.bakehouse_file_lab;
CREATE VOLUME IF NOT EXISTS workspace.bakehouse_file_lab.incoming;

CREATE TABLE IF NOT EXISTS workspace.bakehouse_file_lab.bronze_sales (
    batch_no STRING,
    transaction_id STRING,
    franchise_id STRING,
    sales_date STRING,
    product STRING,
    quantity STRING,
    unit_price STRING,
    sales_amount STRING,
    source_file STRING
) USING DELTA;

CREATE TABLE IF NOT EXISTS workspace.bakehouse_file_lab.silver_sales (
    batch_no BIGINT,
    transaction_id BIGINT,
    franchise_id BIGINT,
    sales_date DATE,
    product STRING,
    quantity BIGINT,
    unit_price DECIMAL(18, 2),
    sales_amount DECIMAL(18, 2)
) USING DELTA;
```

**Volume은 CSV 파일을 보관하는 공간, 테이블은 조회·갱신할 행을 관리하는 대상**이다. 파일 경로는 `/Volumes/catalog/schema/volume/` 형식을 쓴다. [Unity Catalog Volume](https://docs.databricks.com/aws/en/volumes/)

여기서는 Databricks가 저장 위치를 관리하는 Volume을 만든다. 생성에는 부모 catalog·schema의 사용 권한과 `CREATE VOLUME`이 필요하다. 파일 업로드에는 `WRITE VOLUME`, 읽기에는 `READ VOLUME`이 필요하며 테이블 생성·조회·갱신 권한도 있어야 한다. [Volume 생성](https://docs.databricks.com/aws/en/volumes/utility-commands)

Catalog에서 `workspace → bakehouse_file_lab → incoming`을 열어 Volume이 만들어졌는지 확인한다.

Volume 경로는 `/Volumes/workspace/bakehouse_file_lab/incoming`으로 표시됐다.

[![Catalog에서 incoming Volume과 CSV를 저장할 경로를 확인한 화면](/images/databricks-basics-5/create-incoming-volume.png)](/images/databricks-basics-5/create-incoming-volume.png)

## 2. 첫 CSV 업로드하기

아래 두 파일을 내려받는다. 4편의 판매 예시를 작은 CSV로 구성한 **가상 입력**이다.

- [sales-01.csv](/downloads/databricks-basics-5/sales-01.csv): 첫 판매 내역 2행
- [sales-02.csv](/downloads/databricks-basics-5/sales-02.csv): 금액 정정 1행·신규 내역 1행

**지금은 `sales-01.csv`만 업로드한다.**

1. `incoming` Volume 오른쪽 상단의 **Upload to this volume**을 누른다.
2. 열린 업로드 창에서 `sales-01.csv`를 선택한다.
3. Destination volume이 아래 경로인지 확인한다. 하위 폴더는 만들지 않는다.
4. **Upload**를 누른다.

```text
/Volumes/workspace/bakehouse_file_lab/incoming/
```

파일 업로드 화면은 Notebook의 **File → Upload files to volume**에서도 열 수 있다. [Volume 파일 업로드](https://docs.databricks.com/aws/en/volumes/volume-files#upload-files-to-a-volume)

첫 파일의 내용은 다음과 같다.

```csv
batch_no,transaction_id,franchise_id,sales_date,product,quantity,unit_price,sales_amount
1,1000000,3000010,2024-05-12,Outback Oatmeal,5,3.00,15.00
1,1000001,3000010,2024-05-01,Orchard Oasis,9,3.00,27.00
```

`batch_no`는 이 예제의 변경 순번이다. 같은 거래에서는 큰 번호의 값이 최신이다. 파일명이나 업로드 시각으로 최신 여부를 판단하지 않는다.

[![Upload to this volume으로 sales-01.csv를 선택하고 incoming 경로에 업로드하는 창](/images/databricks-basics-5/upload-first-csv.png)](/images/databricks-basics-5/upload-first-csv.png)

## 3. 파일을 테이블로 처리하기

아래 코드를 각 Notebook에 넣는다. **`01_ingest → 02_merge → 03_gold` 순서로 실행한다.** `02_merge`의 셀 세 개는 위에서 아래로 모두 실행한다.

### 01_ingest: COPY INTO로 적재

```sql
%sql
COPY INTO workspace.bakehouse_file_lab.bronze_sales
FROM (
    SELECT batch_no, transaction_id, franchise_id, sales_date,
           product, quantity, unit_price, sales_amount,
           _metadata.file_name AS source_file
    FROM '/Volumes/workspace/bakehouse_file_lab/incoming/'
)
FILEFORMAT = CSV
PATTERN = 'sales-*.csv'
FORMAT_OPTIONS ('header' = 'true', 'inferSchema' = 'false', 'mode' = 'FAILFAST')
COPY_OPTIONS ('force' = 'false');

SELECT source_file, COUNT(*) AS rows
FROM workspace.bakehouse_file_lab.bronze_sales
GROUP BY source_file
ORDER BY source_file;
```

`COPY INTO`는 파일을 Delta 테이블에 적재하고, 같은 대상에 이미 적재한 파일은 다시 읽지 않는다. `force = false`가 기본값이며 여기서는 명시했다. [COPY INTO](https://docs.databricks.com/aws/en/sql/language-manual/delta-copy-into)

Bronze에는 CSV 값을 문자열로 저장한다. 자료형 변환은 다음 단계에서 한다. `source_file`에는 입력 파일명을 기록한다. [CSV 적재 옵션](https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/copy-into/examples#load-csv-files-using-copy-into), [파일 메타데이터](https://docs.databricks.com/aws/en/ingestion/file-metadata-column)

첫 실행에서는 `sales-01.csv`의 행 수가 2여야 한다.

첫 파일을 적재한 뒤 `sales-01.csv`의 Bronze 행 수는 2로 출력됐다.

[![COPY INTO로 sales-01.csv를 적재한 뒤 Bronze의 파일별 행 수가 2인 화면](/images/databricks-basics-5/ingest-first-file.png)](/images/databricks-basics-5/ingest-first-file.png)

### 02_merge: 검사 후 최신 내역 반영

**첫 번째 셀 — 자료형을 바꾸고 입력을 검사한다.**

```python
%python
from pyspark.sql import functions as F
from pyspark.sql.window import Window

raw = spark.table("workspace.bakehouse_file_lab.bronze_sales")
types = {
    "batch_no": "BIGINT", "transaction_id": "BIGINT", "franchise_id": "BIGINT",
    "sales_date": "DATE", "quantity": "BIGINT",
    "unit_price": "DECIMAL(18, 2)", "sales_amount": "DECIMAL(18, 2)",
}
columns = [
    "batch_no", "transaction_id", "franchise_id", "sales_date",
    "product", "quantity", "unit_price", "sales_amount",
]
parsed = raw.select(*[
    F.expr(f"try_cast({name} AS {types[name]})").alias(name)
    if name in types else F.col(name)
    for name in columns
])

missing = F.lit(False)
for name in columns:
    missing = missing | F.col(name).isNull()
missing = missing | (F.trim(F.col("product")) == "")
if parsed.count() == 0 or parsed.filter(missing).limit(1).count() > 0:
    raise ValueError("입력이 비었거나 필수 값·자료형이 잘못됐다.")
if parsed.groupBy("transaction_id", "batch_no").count().filter("count > 1").limit(1).count():
    raise ValueError("같은 거래·변경 순번이 중복됐다.")

order = Window.partitionBy("transaction_id").orderBy(F.col("batch_no").desc())
latest = (
    parsed.withColumn("rn", F.row_number().over(order))
    .filter("rn = 1").drop("rn")
)
latest.createOrReplaceTempView("sales_latest")
print("입력 검사 통과")
```

`try_cast`는 변환할 수 없는 문자열을 NULL로 돌려준다. 그 행은 검사에서 멈춘다. 같은 거래·순번의 중복도 자동 삭제하지 않는다. [try_cast](https://docs.databricks.com/aws/en/sql/language-manual/functions/try_cast)

거래별 `batch_no` 내림차순으로 첫 행을 선택한다. 오래된 파일이 나중에 도착해도 최신 순번이 유지된다. `batch_no`는 원천이 부여한 순번이라는 전제다. [row_number](https://docs.databricks.com/aws/en/sql/language-manual/functions/row_number)

**두 번째 셀 — Silver에 MERGE한다.**

```sql
%sql
MERGE INTO workspace.bakehouse_file_lab.silver_sales AS t
USING sales_latest AS s
ON t.transaction_id = s.transaction_id
WHEN MATCHED AND s.batch_no > t.batch_no THEN UPDATE SET
    batch_no = s.batch_no,
    franchise_id = s.franchise_id,
    sales_date = s.sales_date,
    product = s.product,
    quantity = s.quantity,
    unit_price = s.unit_price,
    sales_amount = s.sales_amount
WHEN NOT MATCHED THEN INSERT (
    batch_no, transaction_id, franchise_id, sales_date,
    product, quantity, unit_price, sales_amount
) VALUES (
    s.batch_no, s.transaction_id, s.franchise_id, s.sales_date,
    s.product, s.quantity, s.unit_price, s.sales_amount
);
```

4편과 같은 upsert에 **더 큰 변경 순번일 때만 수정**하는 조건을 붙였다. 같은 순번으로 금액을 바꾸는 입력은 허용하지 않는다. [조건부 MERGE](https://docs.databricks.com/aws/en/sql/language-manual/delta-merge-into)

**세 번째 셀 — 최신 입력과 Silver가 같은지 검사한다.**

```python
%python
actual = spark.table("workspace.bakehouse_file_lab.silver_sales").select(*columns)
expected = latest.select(*columns)
missing_rows = expected.exceptAll(actual).count()
unexpected_rows = actual.exceptAll(expected).count()
print({"missing_rows": missing_rows, "unexpected_rows": unexpected_rows})
if missing_rows or unexpected_rows:
    raise ValueError("Silver가 최신 입력과 다르다.")
print("Silver 검사 통과")
```

두 차이가 모두 0이어야 한다. `sales_latest`, `latest`, `columns`는 **이 Notebook 안에서만 사용하는 값**이다. 셀 세 개를 같은 `02_merge`에 넣어야 한다.

### 03_gold: 집계하고 결과 확인

```python
%python
from pyspark.sql import functions as F

silver = spark.table("workspace.bakehouse_file_lab.silver_sales")
gold = silver.groupBy("sales_date", "franchise_id", "product").agg(
    F.sum("quantity").alias("total_quantity"),
    F.sum("sales_amount").alias("total_sales_amount"),
    F.count("*").alias("source_row_count"),
)
gold.write.format("delta").mode("overwrite").saveAsTable(
    "workspace.bakehouse_file_lab.gold_daily_product_sales"
)
stored = spark.table("workspace.bakehouse_file_lab.gold_daily_product_sales")
s = silver.agg(
    F.count("*").alias("rows"), F.sum("quantity").alias("quantity"),
    F.sum("sales_amount").alias("amount"),
).first()
g = stored.agg(
    F.sum("source_row_count").alias("rows"),
    F.sum("total_quantity").alias("quantity"),
    F.sum("total_sales_amount").alias("amount"),
).first()
print({
    "bronze_rows": spark.table("workspace.bakehouse_file_lab.bronze_sales").count(),
    "silver_rows": s["rows"], "quantity": s["quantity"], "amount": s["amount"],
})
differences = {name: s[name] - g[name] for name in ["rows", "quantity", "amount"]}
print("Silver·Gold 차이", differences)
if any(value != 0 for value in differences.values()):
    raise ValueError("Silver와 Gold의 합계가 다르다.")
display(silver.orderBy("transaction_id"))
```

첫 파일의 결과는 **Bronze 2행·Silver 2행·수량 14·금액 42.00**이다. Silver·Gold 차이는 모두 0이어야 한다.

첫 처리에서 Bronze·Silver는 각각 2행, 수량 합계는 14, 금액 합계는 42.00이었다. Silver·Gold의 행 수·수량·금액 차이는 모두 0이었다.

[![첫 파일 처리 후 Bronze 2행·Silver 2행·수량 14·금액 42.00과 집계 차이 0인 출력](/images/databricks-basics-5/first-file-totals.png)](/images/databricks-basics-5/first-file-totals.png)

## 4. 두 번째 CSV로 정정·신규 내역 반영하기

**`sales-02.csv`를 같은 Volume 경로에 추가 업로드한다.** 첫 파일은 그대로 둔다.

```csv
batch_no,transaction_id,franchise_id,sales_date,product,quantity,unit_price,sales_amount
2,1000000,3000010,2024-05-12,Outback Oatmeal,5,3.00,20.00
2,1001000,3000010,2024-05-12,Outback Oatmeal,2,10.00,20.00
```

거래 `1000000`은 금액을 15.00에서 20.00으로 정정한다. `1001000`은 새 내역이다. 두 행 모두 변경 순번은 2다.

파일 업로드는 Volume에 보관하는 단계다. **테이블과 집계에 반영하려면 `01_ingest → 02_merge → 03_gold`를 다시 실행한다.** `00_prepare`는 실행하지 않는다.

`01_ingest`는 새 파일을 Bronze에 추가하고, `02_merge`는 기존 거래를 수정하며 신규 거래를 추가한다. `03_gold`는 바뀐 Silver로 집계를 다시 계산한다.

| 확인 값 | 첫 파일 처리 후 | 두 번째 파일 처리 후 |
| --- | --- | --- |
| Bronze 행 수 | 2 | 4 |
| Silver 행 수 | 2 | 3 |
| Silver 수량 합계 | 14 | 16 |
| Silver 금액 합계 | 42.00 | 67.00 |
| 입력·Silver 차이 | 모두 0 | 모두 0 |
| Silver·Gold 차이 | 모두 0 | 모두 0 |

Bronze에는 처음 받은 값과 정정 값을 모두 남긴다. Silver에는 거래별 최신 값만 남으므로 3행이다. 금액 합계는 **42.00 + 정정분 5.00 + 신규분 20.00 = 67.00**이다.

두 번째 파일 반영 시 MERGE는 기존 행 1개를 수정하고 새 행 1개를 추가했다. 처리 후 Bronze 4행·Silver 3행·수량 16·금액 67.00이 출력됐다.

[![두 번째 파일의 정정·신규 내역을 MERGE로 반영해 수정 1행·추가 1행이 출력된 화면](/images/databricks-basics-5/merge-second-file.png)](/images/databricks-basics-5/merge-second-file.png)

[![두 번째 파일 처리 후 Bronze 4행·Silver 3행·수량 16·금액 67.00과 Silver 세 행](/images/databricks-basics-5/second-file-totals.png)](/images/databricks-basics-5/second-file-totals.png)

## 5. 같은 파일 재처리와 Jobs 실행 확인하기

**새 파일을 올리지 않고 세 Notebook을 한 번 더 실행한다.**

1. `01_ingest`: 파일별 Bronze 행 수가 각각 2인지 확인한다. 전체는 4행이다.
2. `02_merge`: `missing_rows`, `unexpected_rows`가 모두 0인지 확인한다.
3. `03_gold`: Silver 3행·수량 16·금액 67.00이 유지되고 Gold와의 차이가 모두 0인지 확인한다.

`COPY INTO`는 이미 적재한 파일을 건너뛰고, MERGE는 같은 순번을 다시 수정하지 않는다. **파일 적재 중복과 거래 갱신 중복을 각각 확인하는 단계**다.

재실행 결과 MERGE의 수정·추가·삭제 행 수는 모두 0이었다. 입력·Silver 차이도 모두 0이고, 행 수·수량·금액 합계는 그대로 유지됐다.

[![재실행한 MERGE의 변경 행 수가 0이고 최신 입력과 Silver의 차이도 모두 0인 화면](/images/databricks-basics-5/rerun-merge-validation.png)](/images/databricks-basics-5/rerun-merge-validation.png)

[![재실행 후 Bronze 4행·Silver 3행·수량 16·금액 67.00이 유지된 출력](/images/databricks-basics-5/rerun-totals.png)](/images/databricks-basics-5/rerun-totals.png)

수동 확인을 마치면 새 job `bakehouse-file-ingest`를 만든다. Notebook task 세 개를 다음 순서로 연결한다.

| Task | Notebook | Depends on | Run if |
| --- | --- | --- | --- |
| `ingest` | `01_ingest` | 없음 | 기본값 |
| `merge` | `02_merge` | `ingest` | `All succeeded` |
| `gold` | `03_gold` | `merge` | `All succeeded` |

Source는 `Workspace`, Compute는 `Serverless`로 선택한다. `Maximum concurrent runs`는 1로 둔다. **`00_prepare`는 job에 넣지 않는다.** 실행 주체의 Volume 읽기와 테이블 조회·갱신 권한도 확인한다.

`Run now`로 실행하고 세 task가 모두 성공하는지 확인한다. `gold` 출력에서 **Bronze 4행·Silver 3행·수량 16·금액 67.00**이 유지되는지 확인한다. 설정 방법은 [3편의 Jobs 실습](/posts/databricks-basics-3/)과 같다.

Jobs의 `ingest`, `merge`, `gold`는 모두 성공했다. `gold` 출력에서도 같은 행 수와 합계, Silver·Gold 차이 0을 확인했다.

[![bakehouse-file-ingest job의 ingest·merge·gold task가 모두 성공한 실행 화면](/images/databricks-basics-5/job-success.png)](/images/databricks-basics-5/job-success.png)

[![Jobs의 gold task에서 Bronze 4행·Silver 3행·수량 16·금액 67.00과 검산 차이 0을 확인한 화면](/images/databricks-basics-5/job-gold-output.png)](/images/databricks-basics-5/job-gold-output.png)

## 새 파일을 받는 규칙

**이미 적재한 파일은 덮어쓰지 않는다.** COPY INTO는 적재 후 내용이 바뀐 파일도 건너뛴다. 정정은 새 파일명과 더 큰 변경 순번으로 전달한다. `force = true`로 강제 재적재하면 이 실습의 Bronze에 중복이 생긴다. [파일 재적재 동작](https://docs.databricks.com/aws/en/sql/language-manual/delta-copy-into)

이번 예제는 작은 Bronze 전체에서 최신 행을 다시 고른다. 파일은 새것만 적재하지만 Silver 변환까지 모두 증분 처리하는 구성은 아니다. 처리량이 커지면 변경 범위를 좁히는 설계가 필요하다.

여기까지는 파일을 직접 올려 수집과 갱신을 확인했다. 다음 편에서는 중간 작업이 실패했을 때 복구할 지점과 재실행 결과를 살펴본다.
