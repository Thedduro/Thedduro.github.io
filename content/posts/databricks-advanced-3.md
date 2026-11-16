---
title: "[Databricks] 행 필터와 컬럼 마스킹: 조회 범위와 민감 정보 제어하기 - 심화 3편"
date: 2026-10-21T16:22:32+09:00
draft: true
description: "Unity Catalog의 행 필터와 컬럼 마스킹을 테이블에 적용한다. 이메일 숨기기, 서울 거래만 조회하기, 집계 결과 비교와 정책 해제를 실습하며 조회 시점의 보안 규칙을 이해한다."
slug: "databricks-advanced-3"
categories: ["Data Engineering"]
tags: ["Data Engineering", "Databricks", "Unity Catalog", "SQL"]
series: "Databricks 심화"
seriesOrder: 3
---

매출 분석에는 거래 금액이 필요하지만 고객 이메일까지 공개할 필요는 없을 수 있다. 담당 지역의 거래만 보여줘야 하는 경우도 있다. 테이블의 `SELECT` 권한만으로는 이 두 조건을 표현하기 어렵다.

**컬럼 마스킹은 조회되는 값을 가리고, 행 필터는 조회되는 행을 제한한다.** 둘 다 Unity Catalog 테이블에 연결하는 규칙이다. 분석가가 작성하는 쿼리마다 이메일을 가리는 식이나 지역 조건을 넣을 필요가 없다.

[심화 1편](/posts/databricks-advanced-1/)에서는 테이블을 읽을 권한을, [심화 2편](/posts/databricks-advanced-2/)에서는 데이터의 출처와 사용처를 다뤘다. 이번에는 **읽을 수 있는 테이블 안에서 어디까지 보여줄지**를 다룬다.

공식 문서는 2026년 10월 21일 기준이다. 실습 대상은 Unity Catalog와 Serverless Notebook이며, 아래 표는 코드에 따른 **예상 결과**다. 직접 실행한 화면은 캡처 위치에 추가한다.

## 1. SELECT 권한과 조회 결과의 제한은 다르다

고객 거래 테이블을 예로 들어보자.

| 제어할 내용 | 사용하는 기능 | 예 |
| --- | --- | --- |
| 테이블을 조회할 수 있는가 | `SELECT` 권한 | 분석가 그룹에 거래 테이블 조회 허용 |
| 어느 행을 볼 수 있는가 | 행 필터, Row filter | 서울 거래만 반환 |
| 특정 컬럼이 어떤 값으로 보이는가 | 컬럼 마스크, Column mask | 이메일을 `[MASKED]`로 반환 |

행 필터와 컬럼 마스크는 조회 권한을 대신하지 않는다. 테이블을 읽을 권한이 있는 상태에서, 반환할 행과 값을 추가로 제어한다. 여기서는 테이블에 직접 함수를 연결하는 방식을 사용한다. [행 필터와 컬럼 마스크](https://docs.databricks.com/aws/en/data-governance/unity-catalog/filters-and-masks)

일반 쿼리의 `WHERE city = 'Seoul'`은 작성자가 지우면 사라진다. 테이블에 연결한 행 필터는 조회 SQL에서 그 조건을 생략해도 적용된다. 컬럼 마스크도 마찬가지다. `SELECT email`이라고 원래 컬럼을 직접 읽어도 마스크를 거친 값이 반환된다.

이번 실습에서는 다음 순서로 차이를 확인한다.

| 단계 | 반환할 거래 | 이메일 표시 |
| --- | --- | --- |
| 적용 전 | 전체 4건 | 원래 값 |
| 마스크 적용 | 전체 4건 | `[MASKED]` |
| 행 필터 추가 | 서울 2건 | `[MASKED]` |
| 행 필터 해제 | 전체 4건 | `[MASKED]` |
| 마스크 해제 | 전체 4건 | 원래 값 |

**한 계정으로 규칙을 적용하고 조회 결과가 달라지는지 확인한다.** 규칙에는 사용자별 예외를 넣지 않으므로, 테이블을 만든 본인이 조회해도 필터와 마스크가 적용된다. 사용자별 접근 차이는 마지막 절에서 설계 방식으로 설명한다.

## 2. 거래 4건으로 비교 기준 만들기

왼쪽 **Workspace**에서 작업할 폴더를 열고 **Create → Notebook**을 선택한다. 이름은 `01_security`, 기본 언어는 **Python**, 상단 compute는 **Serverless**로 지정한다.

아래 코드 블록 하나를 새 셀 하나에 붙여 넣는다. 각 셀의 첫 줄인 `%sql`도 함께 복사한다. **셀을 하나씩 실행하고 결과를 확인한 뒤 다음 셀로 이동한다.** 마지막에는 규칙을 해제하므로 `Run all`로 한꺼번에 실행하면 적용 중인 상태를 놓치기 쉽다.

앞선 실습과 같은 `workspace` catalog에서 별도 schema인 `uc_security_lab`을 만든다. 해당 catalog에 schema를 만들 권한이 필요하다. 새 schema 안의 테이블과 SQL 함수는 직접 생성해 소유한다. 함수 연결에는 함수 실행 권한과 상위 catalog·schema 사용 권한도 필요하다. [설정 권한](https://docs.databricks.com/aws/en/data-governance/unity-catalog/filters-and-masks/manually-apply#requirements)

**첫 셀은 `uc_security_lab.customer_sales`를 삭제한 뒤 예제 데이터로 다시 만든다.** 이 이름은 실습 전용으로 사용한다. 처음부터 반복할 때만 이 셀로 돌아오고, 중간 결과를 비교할 때는 다시 실행하지 않는다.

```sql
%sql
-- 01_prepare
CREATE SCHEMA IF NOT EXISTS workspace.uc_security_lab;

DROP TABLE IF EXISTS workspace.uc_security_lab.customer_sales;

CREATE TABLE workspace.uc_security_lab.customer_sales
USING DELTA AS
SELECT
  sale_id,
  city,
  email,
  CAST(amount AS DECIMAL(12, 2)) AS amount
FROM VALUES
  (1, 'Seoul', 'min@example.com',  100.00),
  (2, 'Busan', 'jun@example.com',  200.00),
  (3, 'Seoul', 'hana@example.com', 300.00),
  (4, 'Daegu', 'sol@example.com',  400.00)
AS source(sale_id, city, email, amount);

SELECT *
FROM workspace.uc_security_lab.customer_sales
ORDER BY sale_id;
```

가상의 거래이며 이메일도 예제 값이다. 결과는 아래 4행이다.

| sale_id | city | email | amount |
| ---: | --- | --- | ---: |
| 1 | Seoul | min@example.com | 100.00 |
| 2 | Busan | jun@example.com | 200.00 |
| 3 | Seoul | hana@example.com | 300.00 |
| 4 | Daegu | sol@example.com | 400.00 |

비교 기준은 **전체 4건·금액 합계 1,000.00·서로 다른 이메일 4개**다. 서울 거래는 1번과 3번이며 합계는 400.00이다.

## 3. 규칙을 SQL 함수로 만들기

Databricks는 테이블에 연결할 필터와 마스크를 **SQL 사용자 정의 함수(UDF, User-defined function)** 로 받는다. 계산식에 이름을 붙여 저장하고, 입력값을 전달하면 결과를 반환하는 방식이다. [SQL 함수 만들기](https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-ddl-create-sql-function)

이번에 만들 함수는 두 개다.

| 함수 | 입력 | 반환값 | 사용할 곳 |
| --- | --- | --- | --- |
| `mask_email` | 이메일 문자열 | `[MASKED]`, 입력이 NULL이면 NULL | `email` 컬럼 |
| `allow_seoul` | 도시 문자열 | Seoul이면 true, 그 외에는 false | 거래 행 전체 |

먼저 함수만 만들고 예제 값을 넣어 동작을 확인한다. **이 단계에서는 아직 테이블에 규칙을 연결하지 않는다.**

```sql
%sql
-- 02_functions
CREATE OR REPLACE FUNCTION workspace.uc_security_lab.mask_email(value STRING)
RETURNS STRING
LANGUAGE SQL
RETURN CASE WHEN value IS NULL THEN NULL ELSE '[MASKED]' END;

CREATE OR REPLACE FUNCTION workspace.uc_security_lab.allow_seoul(value STRING)
RETURNS BOOLEAN
LANGUAGE SQL
RETURN COALESCE(value = 'Seoul', FALSE);

SELECT
  test_id,
  city,
  email,
  workspace.uc_security_lab.allow_seoul(city) AS allowed,
  workspace.uc_security_lab.mask_email(email) AS masked_email
FROM VALUES
  (1, 'Seoul', 'min@example.com'),
  (2, 'Busan', 'jun@example.com'),
  (3, CAST(NULL AS STRING), CAST(NULL AS STRING))
AS tests(test_id, city, email)
ORDER BY test_id;
```

| test_id | city | email | allowed | masked_email |
| ---: | --- | --- | --- | --- |
| 1 | Seoul | min@example.com | true | [MASKED] |
| 2 | Busan | jun@example.com | false | [MASKED] |
| 3 | NULL | NULL | false | NULL |

`RETURNS`는 함수 결과의 자료형이다. 마스크는 이메일과 같은 `STRING`을, 행 필터는 통과 여부인 `BOOLEAN`을 반환한다. `RETURN` 뒤에는 그 값을 계산할 식을 적는다.

`COALESCE(값, FALSE)`는 도시가 NULL이라 비교 결과도 NULL일 때 false로 바꾼다. 담당 지역을 알 수 없는 행은 허용하지 않겠다는 규칙이다. 행 필터 자체도 **true인 행만 통과**시키며, false와 NULL은 제외한다. [ROW FILTER의 반환 조건](https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-ddl-row-filter)

여기서 `allowed`가 false인 테스트 행도 화면에 나오는 것은 정상이다. 지금 SQL은 함수의 반환값을 보여주는 테스트다. 실제 거래를 제외하려면 5절처럼 테이블에 연결해야 한다.

**캡처 2:** `02_functions`의 테스트 3행. Seoul·Busan·NULL의 허용 여부와 마스크 결과를 담는다.

## 4. 이메일 마스크를 연결하고 집계해 보기

### ① 테이블에 마스크 적용

새 셀에서 실행한다.

```sql
%sql
-- 03_apply_mask
ALTER TABLE workspace.uc_security_lab.customer_sales
ALTER COLUMN email SET MASK workspace.uc_security_lab.mask_email;

SELECT *
FROM workspace.uc_security_lab.customer_sales
ORDER BY sale_id;
```

`ALTER COLUMN email`은 대상 컬럼, `SET MASK` 뒤는 적용할 함수다. 각 행의 이메일이 함수의 첫 번째 입력값으로 전달된다. [MASK의 입력 연결](https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-ddl-column-mask)

| sale_id | city | email | amount |
| ---: | --- | --- | ---: |
| 1 | Seoul | [MASKED] | 100.00 |
| 2 | Busan | [MASKED] | 200.00 |
| 3 | Seoul | [MASKED] | 300.00 |
| 4 | Daegu | [MASKED] | 400.00 |

조회 SQL에는 이메일을 가리는 식이 없다. **테이블에 마스크를 연결했기 때문에 `SELECT *`에도 적용된 것이다.** 행 수·도시·금액은 그대로이고 이메일만 달라진다.

### ② 이메일로 고객 수를 세면 어떻게 될까

마스크가 단순한 화면 표시인지 확인하기 위해, 같은 테이블에서 서로 다른 이메일 수를 센다.

```sql
%sql
-- 04_masked_summary
SELECT
  COUNT(*) AS visible_rows,
  SUM(amount) AS total_amount,
  COUNT(DISTINCT email) AS distinct_emails
FROM workspace.uc_security_lab.customer_sales;
```

| visible_rows | total_amount | distinct_emails |
| ---: | ---: | ---: |
| 4 | 1000.00 | 1 |

거래 4건과 금액 합계는 유지된다. 하지만 서로 다른 이메일 수는 **4가 아니라 1**이다. 서로 달랐던 이메일이 모두 `[MASKED]`로 반환되기 때문이다.

컬럼 마스크는 값을 읽는 단계에 적용되고, 이후 식·조건·정렬은 마스크된 값을 사용한다. 따라서 가린 이메일을 조인 키나 중복 제거 기준으로 쓰면 분석 결과도 달라질 수 있다. 이메일을 숨긴 채 고객을 구분해야 한다면, 분석에 사용할 별도 고객 식별자와 그 공개 범위를 설계해야 한다. [마스킹과 쿼리 연산](https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-ddl-column-mask)

**캡처 3:** `03_apply_mask`의 이메일이 가려진 4행과 `04_masked_summary`의 `4 / 1000.00 / 1` 결과.

## 5. 서울 거래만 반환하도록 행 필터 연결하기

이메일 마스크를 유지한 상태에서 다음 셀을 실행한다.

```sql
%sql
-- 05_apply_filter
ALTER TABLE workspace.uc_security_lab.customer_sales
SET ROW FILTER workspace.uc_security_lab.allow_seoul ON (city);

SELECT *
FROM workspace.uc_security_lab.customer_sales
ORDER BY sale_id;
```

`ON (city)`는 테이블의 `city` 값을 필터 함수에 전달한다는 뜻이다. 함수가 true를 반환한 서울 거래만 조회된다.

| sale_id | city | email | amount |
| ---: | --- | --- | ---: |
| 1 | Seoul | [MASKED] | 100.00 |
| 3 | Seoul | [MASKED] | 300.00 |

이번에도 조회 SQL에는 `WHERE`가 없다. **필터가 테이블에 연결되어 있으므로 1번과 3번만 반환된다.** 앞서 적용한 이메일 마스크도 함께 작동한다.

부산을 조회하겠다고 조건을 추가하면 어떻게 될까? 다음 셀에서 확인한다.

```sql
%sql
-- 06_query_busan
SELECT COUNT(*) AS busan_rows
FROM workspace.uc_security_lab.customer_sales
WHERE city = 'Busan';
```

예상 결과는 **`busan_rows = 0`인 한 행**이다. 원본에 부산 거래가 없어서가 아니다. 테이블의 행 필터가 서울만 허용하므로, 그 안에서 부산 조건을 만족하는 행이 없는 것이다. 조회자가 붙인 `WHERE`는 허용 범위를 더 좁힐 수 있지만 이 필터를 해제하지는 못한다. [행을 읽을 때 적용되는 필터](https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-ddl-row-filter)

**캡처 4:** `05_apply_filter`의 서울 2행과 `06_query_busan`의 `busan_rows = 0` 결과.

## 6. 필터가 적용된 합계를 전체 매출로 읽으면 안 된다

마스크만 적용했을 때 실행한 집계와 같은 SQL을 새 셀에서 실행한다.

```sql
%sql
-- 07_filtered_summary
SELECT
  COUNT(*) AS visible_rows,
  SUM(amount) AS total_amount,
  COUNT(DISTINCT email) AS distinct_emails
FROM workspace.uc_security_lab.customer_sales;
```

| visible_rows | total_amount | distinct_emails |
| ---: | ---: | ---: |
| 2 | 400.00 | 1 |

합계가 1,000.00에서 400.00으로 바뀌었다. 금액 컬럼에 마스크를 붙인 것은 아니다. **합산할 행이 서울 거래 2건으로 줄었기 때문**이다. 같은 `SUM(amount)`라도 읽을 수 있는 범위가 달라지면 값이 달라진다.

대시보드에 이 쿼리를 연결했다면 400.00을 전체 매출로 표시하면 안 된다. 지표 이름과 설명도 조회 범위에 맞춰야 한다. 사용자나 실행 주체에 따라 결과가 다른 경우에는 계산식뿐 아니라 적용되는 행 필터도 확인해야 한다.

| 단계 | 거래 수 | 금액 합계 | 서로 다른 이메일 수 |
| --- | ---: | ---: | ---: |
| 원본 | 4 | 1000.00 | 4 |
| 이메일 마스크 적용 후 | 4 | 1000.00 | 1 |
| 서울 행 필터까지 적용 후 | 2 | 400.00 | 1 |

이 비교에서 행 필터는 **집계할 대상**을 바꿨고, 이메일 마스크는 **집계에 사용되는 이메일 값**을 바꿨다.

**캡처 5:** `07_filtered_summary`의 `2 / 400.00 / 1` 결과.

## 7. 규칙을 하나씩 해제해 원본이 남아 있는지 확인하기

### ① 행 필터만 해제

다음 셀은 서울 제한만 해제한다.

```sql
%sql
-- 08_remove_filter
ALTER TABLE workspace.uc_security_lab.customer_sales
DROP ROW FILTER;

SELECT *
FROM workspace.uc_security_lab.customer_sales
ORDER BY sale_id;
```

1~4번 거래가 모두 돌아오고, 이메일은 여전히 `[MASKED]`다. 삭제됐던 행을 다시 넣는 SQL은 실행하지 않았다. 행 필터가 조회에서 제외했을 뿐, 거래를 삭제하지 않았기 때문이다.

### ② 이메일 마스크도 해제

이어서 다음 셀을 실행한다.

```sql
%sql
-- 09_remove_mask
ALTER TABLE workspace.uc_security_lab.customer_sales
ALTER COLUMN email DROP MASK;

SELECT *
FROM workspace.uc_security_lab.customer_sales
ORDER BY sale_id;
```

이제 2절과 같은 원본 4행이 나온다. `min@example.com`을 비롯한 이메일도 돌아온다. 마스크는 원본 이메일을 `[MASKED]`로 덮어쓰지 않았다. **규칙이 연결되어 있는 동안 조회 결과에 적용한 것**이다. [필터·마스크 해제](https://docs.databricks.com/aws/en/data-governance/unity-catalog/filters-and-masks/manually-apply)

**캡처 6:** `08_remove_filter`의 이메일이 가려진 4행과 `09_remove_mask`의 원래 이메일이 보이는 4행. 두 규칙이 각각 해제되는 차이를 담는다.

실습은 여기서 끝난다. 테이블과 함수는 남고, 테이블에 연결한 필터와 마스크는 모두 해제된 상태다. 처음부터 반복하려면 `01_prepare`부터 순서대로 실행한다.

함수 자체를 지울 때는 테이블과의 연결을 먼저 해제해야 한다. 연결된 함수를 먼저 삭제하면 해당 테이블 조회가 실패할 수 있다. `DROP ROW FILTER`·`DROP MASK`는 연결을 제거하는 명령이고, `DROP FUNCTION`은 함수 객체를 삭제하는 명령이다.

## 8. 사용자별 보안 규칙으로 확장할 때

지금 만든 규칙은 모든 조회자에게 같은 결과를 준다. 실제 업무에서는 **누가 조회하는가**를 함수의 조건에 더한다.

예를 들어 이메일 열람 권한을 가진 계정 그룹이 있다면, `is_account_group_member('고객정보_담당그룹')`으로 현재 조회자가 그 그룹의 구성원인지 판단할 수 있다. 이 함수는 계정 그룹의 직접·간접 멤버십을 확인한다. [계정 그룹 멤버십 함수](https://docs.databricks.com/aws/en/sql/language-manual/functions/is_account_group_member)

아래는 **운영 설계 예시**다. 이번 실습에서 이 그룹을 만들거나 계정을 전환하지 않는다.

| 판단할 내용 | 조건을 만족할 때 | 만족하지 않을 때 |
| --- | --- | --- |
| 이메일 열람 그룹의 구성원인가 | 원래 이메일 반환 | `[MASKED]` 반환 |
| 전체 지역 조회 그룹의 구성원인가 | 모든 지역 허용 | 담당 지역만 허용 |

담당 지역이 사용자마다 다르면 사용자·그룹과 지역을 연결하는 매핑도 필요하다. 이번 `allow_seoul`의 고정된 도시 조건을 그대로 두면 모든 사용자에게 서울만 보이므로, 사용자별 지역 제한을 구현한 것이 아니다.

여기서 **규칙을 관리하는 권한과 데이터를 조회하는 권한**을 나눠야 한다. 이 글에서는 직접 만든 테이블의 소유자로서 규칙을 붙이고 떼었다. 실제 분석 담당자에게도 같은 관리 권한을 주면 제한을 제거할 수 있다. 보안 검증은 관리자가 아닌 실제 조회 주체의 권한으로 별도 수행해야 한다.

테이블이 많아지면 각 테이블에 마스크를 하나씩 연결하는 방식도 관리하기 어렵다. 예를 들어 이메일 컬럼이 100개라면, 새 테이블을 만들 때 한 곳을 빠뜨릴 수 있다. Unity Catalog의 **속성 기반 접근 제어(ABAC, Attribute-based access control)** 는 governed tag 같은 관리되는 속성을 조건으로 여러 테이블에 규칙을 적용하는 방식이다. 이번처럼 특정 테이블에 직접 연결할지, 공통 태그에 맞춰 적용할지 관리 범위를 기준으로 선택한다. [Unity Catalog ABAC](https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac)

마지막으로 이메일이 가려졌다는 사실만으로 데이터 전체가 익명화됐다고 판단해서는 안 된다. 거래 번호·지역 등 다른 컬럼도 남아 있다. **보여줄 행, 가릴 값, 분석에 남길 식별자, 규칙을 바꿀 수 있는 주체**를 함께 정해야 조회 결과와 보안 의도가 맞아진다.
