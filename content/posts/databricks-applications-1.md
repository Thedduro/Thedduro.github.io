---
title: "[Databricks] Gold 테이블로 BI 판매 대시보드 만들기 - 활용 1편"
date: 2026-10-13T11:11:35+09:00
draft: false
description: "Databricks AI/BI 대시보드에 Gold 테이블을 연결해 판매 금액·수량과 상품별 차트를 만든다. 상품 필터의 결과를 검산하고 게시 버전을 확인한다."
slug: "databricks-applications-1"
categories: ["Data Engineering"]
tags: ["Data Engineering", "Databricks", "SQL", "Databricks SQL", "BI"]
series: "Databricks 활용"
seriesOrder: 1
---

[기초 5편](/posts/databricks-basics-5/)에서 만든 Gold 테이블을 **판매 대시보드에 연결한다.** 판매 금액과 수량을 숫자로 보여주고, 상품별 금액을 차트로 비교한다. 상품을 선택하면 같은 화면의 지표도 함께 바뀌게 만든다.

BI(Business Intelligence)는 데이터를 조회·집계해 업무 판단에 쓰는 분석이다. 대시보드는 그 결과를 한 화면에 모은다. 매번 SQL을 고치는 대신, 준비된 지표와 필터로 판매 현황을 살펴보는 용도다.

Databricks의 **AI/BI 대시보드**는 SQL로 정의한 데이터셋에 차트와 필터를 연결한다. 이번에는 직접 설정하며, 자연어로 데이터를 질문하는 Genie 실습은 다음 활용편에서 다룬다. [대시보드 구성](https://docs.databricks.com/aws/en/dashboards/manage)

실습 화면은 2026년 10월 13일 Databricks Free Edition에서 촬영했다. 메뉴와 기능 설명은 같은 날짜의 공식 문서를 기준으로 작성했다.

## 1. 사용할 Gold 데이터 확인하기

**기초 5편에서 두 번째 CSV 처리와 Gold 집계까지 마친 상태**로 시작한다. 사용할 테이블은 다음 하나다.

```text
workspace.bakehouse_file_lab.gold_daily_product_sales
```

6편의 `bakehouse_history_lab.sales_demo`는 금액을 바꾼 실습용 테이블이다. 이번에는 **5편의 `bakehouse_file_lab`** 을 사용한다.

Workspace에 `bakehouse_bi_lab` 폴더를 만들고, Python Notebook `00_check`를 추가한다. Compute는 Serverless로 선택한다.

**`00_check`에 아래 SQL 셀을 넣고 실행한다.**

```sql
%sql
SELECT
    sales_date,
    franchise_id,
    product,
    total_quantity,
    total_sales_amount,
    source_row_count
FROM workspace.bakehouse_file_lab.gold_daily_product_sales
ORDER BY sales_date, franchise_id, product;
```

5편의 입력을 그대로 사용했다면 예상 결과는 2행이다.

| sales_date | franchise_id | product | total_quantity | total_sales_amount | source_row_count |
| --- | --- | --- | ---: | ---: | ---: |
| 2024-05-01 | 3000010 | Orchard Oasis | 9 | 27.00 | 1 |
| 2024-05-12 | 3000010 | Outback Oatmeal | 7 | 40.00 | 2 |

Gold 한 행은 **날짜·매장·상품별 집계**다. Silver의 판매 내역 3행을 묶었으므로 Gold는 2행이다. 전체 판매 수량은 16, 금액은 67.00이다.

`source_row_count`는 집계에 포함한 Silver 행 수다. Gold에 `COUNT(*)`를 적용하면 판매 내역 수 3이 아니라 **집계 행 수 2**가 나온다. 대시보드에서는 수량과 금액만 지표로 사용한다.

결과가 다르면 5편의 두 번째 CSV 처리 상태부터 확인한다. 파일을 업로드한 뒤 `01_ingest → 02_merge → 03_gold`를 모두 실행해야 Gold에 반영된다.

[![00_check에서 날짜·상품별 Gold 집계 2행과 수량 9·7, 금액 27.00·40.00을 조회한 결과](/images/databricks-applications-1/check-gold-data.png)](/images/databricks-applications-1/check-gold-data.png)

## 2. 대시보드에 데이터셋 연결하기

대시보드의 SQL은 **SQL warehouse**에서 실행한다. Notebook의 Serverless Compute와 실행 위치가 다르다. SQL warehouse는 SQL 조회에 필요한 연산 자원이며, Free Edition에서는 `2X-Small` 크기의 warehouse 하나를 사용할 수 있다. [Free Edition 제한](https://docs.databricks.com/aws/en/getting-started/free-edition-limitations)

1. 왼쪽 **Dashboards → Create**를 누른다.
2. 대시보드 이름을 `Bakehouse 판매 현황`으로 바꾼다.
3. **Data → Add SQL dataset**을 누른다.
4. 아래 SQL 문을 넣고 **Run**을 누른다.
5. Data 탭 왼쪽 Datasets 목록에서 방금 만든 데이터셋 이름을 더블클릭하고 `daily_product_sales`를 입력한다. 원본 Gold 테이블 이름은 그대로 둔다.

**아래 코드는 대시보드의 SQL 편집기에 넣는다. `%sql`은 붙이지 않는다.**

```sql
SELECT
    sales_date,
    franchise_id,
    product,
    total_quantity,
    total_sales_amount,
    source_row_count
FROM workspace.bakehouse_file_lab.gold_daily_product_sales
```

결과는 1절과 같은 2행이어야 한다. 여기서 데이터셋은 **대시보드가 사용할 조회 결과를 정의한 것**이다. 이 `SELECT`는 원본 테이블을 변경하지 않는다. [데이터셋 정의](https://docs.databricks.com/aws/en/dashboards/manage/data-modeling/datasets)

상품별 필터를 붙일 것이므로 `product`를 남겨 둔다. SQL에서 전체 합계 한 행으로 줄이면 어떤 상품의 값인지 구분할 수 없다.

[![Data 탭에서 daily_product_sales 데이터셋의 SQL과 Gold 조회 결과 2행을 확인한 화면](/images/databricks-applications-1/define-dashboard-dataset.png)](/images/databricks-applications-1/define-dashboard-dataset.png)

## 3. 판매 금액·수량 카드 만들기

**Untitled page**를 선택해 Canvas를 연다. 하단 도구 모음의 차트 아이콘(**Add a visualization**)을 누르고 위젯을 배치한다. 오른쪽 설정에서 아래 값을 지정한다.

| 설정 | 판매 금액 카드 | 판매 수량 카드 |
| --- | --- | --- |
| Dataset | `daily_product_sales` | `daily_product_sales` |
| Visualization | `Counter` | `Counter` |
| Value 필드 | `total_sales_amount` | `total_quantity` |
| Value 집계 | `SUM` | `SUM` |
| 위젯 제목 | 판매 금액 | 판매 수량 |

먼저 판매 금액 카드를 만든 뒤, 새 시각화 위젯을 추가해 판매 수량 카드를 만든다. **Value의 필드를 눌러 집계가 `SUM`인지 확인한다.** 날짜 필드와 Comparison은 설정하지 않는다. 이번 카드는 전체 합계를 보여준다. [Counter 설정](https://docs.databricks.com/aws/en/dashboards/manage/visualizations/types#counter-visualization)

판매 금액은 필요하면 소수점 두 자리로 표시한다. 이번 화면의 `67`은 `67.00`과 같은 값이다. 예제에는 통화 정보가 없으므로 원화나 달러 기호는 붙이지 않는다.

필터를 추가하기 전 예상 값은 **판매 금액 67.00, 판매 수량 16**이다. `COUNT`나 `AVG`로 설정하면 다른 값이 나오므로 집계를 먼저 확인한다.

[![판매 금액 67·판매 수량 16 카드와 판매 수량의 SUM(total_quantity) 설정](/images/databricks-applications-1/configure-sales-counters.png)](/images/databricks-applications-1/configure-sales-counters.png)

## 4. 상품별 판매 금액 차트 만들기

새 시각화 위젯을 추가하고 아래처럼 설정한다.

| 설정 | 값 |
| --- | --- |
| Dataset | `daily_product_sales` |
| Visualization | `Bar` |
| X axis | `product` |
| Y axis | `total_sales_amount` |
| Y axis 집계 | `SUM` |
| 위젯 제목 | 상품별 판매 금액 |

X축은 상품명, Y축은 판매 금액이다. Y축 필드를 눌러 집계를 `SUM`으로 선택한다. 카드와 같은 데이터셋을 사용해야 다음 절의 상품 필터가 함께 적용된다. [시각화 설정](https://docs.databricks.com/aws/en/dashboards/manage/visualizations/)

예상 막대 값은 **Orchard Oasis 27.00, Outback Oatmeal 40.00**이다. 위쪽에는 카드 두 개, 아래쪽에는 차트를 배치한다.

예제는 상품 두 개·판매일 두 개뿐이다. 판매 추세를 해석하기보다 **집계와 필터가 맞는지 확인하는 실습**에 사용한다.

[![상품별 판매 금액 27·40 막대와 product X축 및 SUM(total_sales_amount) Y축 설정](/images/databricks-applications-1/configure-product-chart.png)](/images/databricks-applications-1/configure-product-chart.png)

## 5. 상품 필터로 지표 바꿔 보기

Canvas 하단 도구 모음의 깔때기 아이콘(**Add a filter (field/parameter)**)을 누르고 차트 위에 배치한다.

| 설정 | 값 |
| --- | --- |
| Filter | `Single value` |
| Fields | `daily_product_sales.product` |
| Settings | `Allow All` 활성화 |
| 위젯 제목 | 상품 |

`Allow All`은 전체 상품을 선택하는 **All** 항목을 추가한다. 기본값도 All로 지정한다. 필터는 연결한 데이터셋에 적용되므로 카드 두 개와 차트가 함께 바뀐다. [필터 종류](https://docs.databricks.com/aws/en/dashboards/manage/filter-types), [필터 적용 범위](https://docs.databricks.com/aws/en/dashboards/manage/filters)

[![상품 필터의 Single value, product 필드, Allow All 및 기본값 All 설정](/images/databricks-applications-1/configure-product-filter.png)](/images/databricks-applications-1/configure-product-filter.png)

**All → Orchard Oasis → Outback Oatmeal 순서로 선택하며 확인한다.** 화면에 **Apply** 버튼이 있으면 선택 후 누른다.

| 상품 선택 | 판매 금액 | 판매 수량 | 차트 |
| --- | ---: | ---: | --- |
| All | 67.00 | 16 | 상품 두 개 |
| Orchard Oasis | 27.00 | 9 | Orchard Oasis 한 개 |
| Outback Oatmeal | 40.00 | 7 | Outback Oatmeal 한 개 |

이 확인은 **선택한 상품의 데이터가 모든 지표에 동일하게 적용되는지** 보는 과정이다. 차트만 바뀌고 카드가 그대로면 카드의 Dataset과 필터의 Fields를 확인한다.

[![Outback Oatmeal 선택 시 판매 금액 40·수량 7과 해당 상품 막대 하나가 표시된 결과](/images/databricks-applications-1/verify-product-filter.png)](/images/databricks-applications-1/verify-product-filter.png)

확인을 마치면 상품을 **All**로 돌린다.

## 6. 게시 버전 확인하기

대시보드 편집 내용은 초안으로 자동 저장된다. **Publish**는 보는 사람이 사용할 대시보드 구성을 게시하는 단계다. 게시 후 초안을 수정해도 게시 버전에 반영하려면 다시 Publish해야 한다. [초안과 게시 버전](https://docs.databricks.com/aws/en/dashboards/manage#draft-and-collaborate-on-a-dashboard)

1. 상품 필터가 **All**인지 확인한다.
2. 오른쪽 위 **Publish**를 누른다.
3. 데이터 권한 옵션에서 **Individual data permission**을 선택한다.
4. **Publish**를 눌러 게시한다.
5. **Share → Copy link**로 주소를 복사하고, 같은 계정으로 새 탭에서 게시 버전을 연다.

캡처에서는 Publish 창의 **Individual data permission** 옵션과 게시 버튼을 표시했다.

이번에는 본인 계정으로 조회한다. `Individual data permission`은 조회자의 데이터 권한을 적용한다. 기본 옵션인 `Share data permission`은 게시자의 데이터 권한으로 보여주므로 다른 사람에게 공유할 때 의미가 다르다. 대시보드 게시가 인터넷 전체 공개를 뜻하는 것은 아니다. [게시와 데이터 권한](https://docs.databricks.com/aws/en/dashboards/share/share)

게시 화면에서도 **All일 때 67.00·16, Outback Oatmeal일 때 40.00·7**인지 확인한다. 촬영 후에는 All로 돌려 둔다.

[![대시보드 Publish 창에서 Individual data permission과 Publish 버튼을 표시한 화면](/images/databricks-applications-1/publish-data-permission.png)](/images/databricks-applications-1/publish-data-permission.png)

### 데이터가 갱신될 때

**Gold 갱신과 대시보드 갱신은 별개**다. 대시보드는 조회 결과를 캐시하므로, Gold가 바뀌어도 이전 값이 표시될 수 있다. 정기적으로 사용하는 화면이라면 Gold 처리 이후에 대시보드 갱신 일정도 맞춰야 한다. [캐시와 데이터 최신성](https://docs.databricks.com/aws/en/dashboards/caching)

대시보드의 **Schedule**은 데이터셋 조회를 갱신하는 일정이다. CSV 수집이나 Silver·Gold 처리를 대신 실행하지 않는다. 이번 실습은 5편의 확정된 데이터를 사용하므로 예약은 추가하지 않는다. [대시보드 갱신 일정](https://docs.databricks.com/aws/en/dashboards/share/schedule-subscribe)
