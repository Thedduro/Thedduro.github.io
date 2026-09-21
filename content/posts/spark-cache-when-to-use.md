---
title: "Spark cache(), 어디에 붙여야 효과가 있을까?"
date: 2026-09-21T14:22:11+09:00
draft: true
description: "같은 DataFrame을 다시 사용해도 계산이 반복되는 이유부터, cache()를 붙일 위치와 비용까지 PySpark 예제로 이해해 본다."
categories: ["Data Engineering"]
tags: ["Data Engineering", "Spark", "PySpark"]
slug: "spark-cache-when-to-use"
---

API 요청 로그에서 잘못된 데이터를 걸러냈다. 이제 유효한 요청이 몇 건인지 세고, 경로별 평균 응답 시간도 구하려고 한다. 전처리한 DataFrame 하나를 두 작업에서 사용하면 되니, 전처리도 한 번만 실행될 것처럼 보인다.

그런데 Spark에서는 **같은 변수를 다시 쓰는 것과 계산 결과를 다시 쓰는 것이 다르다.** 이 차이를 알아야 `cache()`를 어디에 붙일지도 결정할 수 있다.

이 글의 기준은 Spark 3.5.6의 배치 PySpark DataFrame이다.

## 변수에 담았는데 왜 다시 계산할까

`filter()`와 `select()`로 DataFrame을 만들었다고 해서 그 결과가 모두 메모리에 들어간 것은 아니다. 이 단계에서 Spark는 어떤 데이터를 읽고 어떻게 변환할지 계산 계획을 구성한다. 실제 계산은 `count()`나 `show()` 같은 액션이 결과를 요구할 때 진행된다.

따라서 같은 전처리 결과를 건수 계산과 평균 계산에서 사용해도, 두 액션이 원본 읽기와 전처리를 각각 수행할 수 있다. Python 변수에 할당했다는 이유만으로 그 중간 결과가 보관되지는 않는다.

원본을 읽는 데 시간이 오래 걸리거나 전처리에 복잡한 파싱과 조인이 들어간다면 이 반복이 부담이 된다. 이때 `cache()`로 재사용할 중간 결과를 지정한다. 처음 계산한 결과를 저장해 두고, 다음 작업에서는 그 지점부터 이어가는 방식이다. [Spark persistence](https://spark.apache.org/docs/3.5.6/rdd-programming-guide.html#rdd-persistence)

## cache()를 호출한 순간에는 아직 비어 있다

`cache()`는 “이 DataFrame의 결과를 보관해 두자”는 지정이다. 호출하자마자 전체 데이터를 읽는 액션은 아니다.

캐시가 비어 있는 상태에서 첫 액션이 실행되면, 필요한 파티션을 계산하면서 결과를 저장한다. 이후 작업은 저장된 파티션을 재사용한다. 아직 계산하지 않았거나 저장된 블록이 사라진 부분은 다시 계산해야 한다.

![캐시가 없으면 두 액션에서 원본 읽기와 전처리가 반복될 수 있다. 캐시를 사용하면 첫 액션에서 전처리 결과를 저장하고, 이후 평균 집계는 유지된 캐시를 읽는다.](/images/spark-cache-when-to-use/spark-cache-reuse-flow.svg)

이 도식은 두 액션이 같은 전처리 결과를 사용하는 경우를 단순화한 것이다. 첫 실행에는 캐시를 만드는 비용도 포함된다. 원본 읽기와 전처리를 건너뛸 수 있는 것은 필요한 캐시 블록이 남아 있는 이후 실행이다.

여기서 기억할 점이 하나 더 있다. **캐시한 이후의 계산까지 자동으로 저장되는 것은 아니다.** 정제된 로그를 캐시했다면 경로별 평균을 구하는 집계와 필요한 shuffle은 여전히 실행된다. 평균 결과까지 재사용하려면 그것은 별도의 캐시 대상이다.

Spark SQL은 논리 계획에서 캐시 대상과 일치하는 부분을 찾아 재사용한다. 변수 이름이 같아서 재사용하는 것은 아니다. [캐시 계획 대체 구현](https://github.com/apache/spark/blob/v3.5.6/sql/core/src/main/scala/org/apache/spark/sql/execution/CacheManager.scala#L266-L294)

## 메모리에 다 들어가지 않으면?

PySpark DataFrame의 `cache()`는 기본적으로 `MEMORY_AND_DISK_DESER` 저장 수준을 사용한다. 메모리에 보관하되, 담지 못하는 파티션은 executor의 디스크에 저장할 수 있다. “cache니까 무조건 메모리에만 있다”고 생각하면 실제 저장 상태를 잘못 해석하게 된다. [DataFrame.cache()](https://spark.apache.org/docs/3.5.6/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.cache.html)

클러스터에서는 데이터가 executor들에 나뉘어 저장된다. Python 드라이버에 모든 행을 가져오는 방식이 아니다. Spark SQL의 캐시는 컬럼 기반 형식이며, 기본 설정에서 압축을 적용하고 읽을 때 필요한 컬럼을 선택한다. `DESER`라는 이름도 Python 객체를 그대로 저장한다는 뜻으로 받아들이면 안 된다. [Spark SQL 캐시 형식](https://spark.apache.org/docs/3.5.6/sql-performance-tuning.html#caching-data-in-memory)

저장 수준을 직접 선택하고 싶다면 `persist(storageLevel)`을 쓴다. 인자를 생략한 DataFrame의 `persist()`와 `cache()`는 기본 저장 수준이 같다. 이미 저장 수준이 지정된 대상은 먼저 `unpersist()`로 해제한 뒤 다시 지정해야 한다. 반면 RDD의 `cache()` 기본값은 `MEMORY_ONLY`다. 같은 메서드 이름이라도 어떤 API인지 구분해야 한다. [DataFrame.persist()](https://spark.apache.org/docs/3.5.6/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.persist.html), [RDD.cache()](https://spark.apache.org/docs/3.5.6/api/python/reference/api/pyspark.RDD.cache.html)

## 어디까지 계산한 결과를 남길 것인가

캐시 위치를 고를 때는 뒤에 이어지는 작업들이 공유하는 부분부터 찾는 편이 좋다.

여러 보고서가 같은 기간의 로그를 읽고, 같은 파싱과 조인을 거친다면 그 공통 전처리 결과가 후보가 된다. 모두 필요로 하는 행과 컬럼만 남겨 크기를 줄일 수 있다면 저장 비용도 낮아진다. 같은 분석용 데이터를 반복 탐색하거나, 변하지 않는 입력을 여러 번 사용하는 알고리즘에서도 이런 재사용을 기대할 수 있다.

반대로 보고서마다 필요한 날짜가 전혀 다르다면 어떨까. 각 작업은 일부만 읽으면 되는데, 모든 날짜를 캐시하느라 더 많은 데이터를 처리할 수 있다. 원본 전체를 보관하는 것이 언제나 이득은 아니다.

결국 캐시 후보는 **다시 계산하기에는 비싸고, 여러 작업이 실제로 재사용하는 결과**다. 단순히 코드에 두 번 등장하는 DataFrame을 모두 캐시할 이유는 없다.

## PySpark로 재사용 흐름 살펴보기

처음의 로그 예시를 작은 데이터로 만들어 보자. 유효한 요청 건수를 세는 첫 액션이 캐시를 채우고, 경로별 평균을 계산하는 다음 액션이 같은 데이터를 사용한다.

실행 환경은 `pyspark==3.5.6`, Python 3.11, Java 17을 가정한다. 외부 파일 없이 실행할 수 있는 예제이며, 이 다섯 행으로 성능 향상을 측정하려는 것은 아니다.

```python
from pyspark.sql import SparkSession, functions as F

spark = SparkSession.builder.master("local[2]").appName("cache-demo").getOrCreate()

logs = spark.createDataFrame(
    [
        ("/home", 80),
        ("/home", 120),
        ("/search", 300),
        ("/search", 500),
        ("/search", -1),
    ],
    "route string, elapsed_ms long",
)

valid_logs = logs.filter(F.col("elapsed_ms") >= 0).cache()

try:
    # 첫 액션: 유효한 로그를 계산하고 캐시에 저장한다.
    print("유효한 요청 수:", valid_logs.count())

    # 다음 액션은 같은 로그를 읽어 경로별 평균을 계산한다.
    averages = valid_logs.groupBy("route").agg(
        F.avg("elapsed_ms").alias("avg_ms")
    )
    averages.orderBy("route").show()
finally:
    valid_logs.unpersist(blocking=True)
    spark.stop()
```

입력값으로부터 예상되는 결과는 유효한 요청 4건, `/home`의 평균 100.0ms, `/search`의 평균 400.0ms다. 캐시되는 것은 이 평균값이 아니라 음수 응답 시간을 제거한 네 행이다.

여기서는 요청 건수 자체가 필요한 결과라서 `count()`를 먼저 실행했다. 캐시를 쓴다고 항상 준비용 `count()`를 붙여야 하는 것은 아니다. 평균만 필요하다면 그 집계가 첫 액션이 되어도 된다.

또한 `valid_logs.show()`로 몇 행을 봤다는 사실만으로 전체 캐시가 채워졌다고 판단해서는 안 된다. 일부 행만 요구하는 액션은 모든 파티션을 계산하지 않을 수 있다. 캐시 지정과 실제 데이터 저장은 구분해서 봐야 한다.

`finally`의 `unpersist()`는 더 이상 사용하지 않는 캐시를 해제한다. 기본값은 `blocking=False`이며, 예제에서는 블록 삭제가 끝날 때까지 기다리도록 `True`를 사용했다. `spark.stop()`은 독립 실행 예제를 마무리하기 위한 코드이므로 공용 세션에서는 세션의 사용 범위에 맞게 처리한다. [DataFrame.unpersist()](https://spark.apache.org/docs/3.5.6/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.unpersist.html)

## 두 번째 실행만 빨라지면 충분할까

가령 첫 실행에서 결과를 계산하고 저장하는 데 10초를 더 썼는데 이후 작업에서 1초만 줄었다면, 전체 작업은 손해다. 캐시 효과는 **처음 채우는 비용까지 포함한 전체 작업 시간**으로 판단해야 한다.

한 번만 쓰고 버릴 결과에는 저장 비용을 만회할 다음 실행이 없다. 재계산이 아주 저렴한 경우에도 캐시를 만드는 비용이 더 클 수 있다.

메모리도 공짜가 아니다. Spark의 실행 메모리와 저장 메모리는 통합 영역을 공유한다. 큰 캐시를 여러 개 유지하면 집계나 조인에 필요한 메모리와 경쟁하고, 일부 캐시 블록이 메모리에서 밀려날 수 있다. 디스크 읽기·쓰기나 재계산이 늘어날 수 있으니, “디스크에도 저장되니까 크게 잡아도 괜찮다”는 판단은 피해야 한다. [Spark 메모리 관리](https://spark.apache.org/docs/3.5.6/tuning.html#memory-management-overview)

적용 여부를 판단할 때는 실행 시간과 함께 두 가지를 더 살펴본다.

- 캐시를 사용하는 후속 DataFrame에 `explain()`을 실행해 `InMemoryTableScan`이 나타나는지 본다. 이는 캐시를 읽는 계획이라는 뜻이며, 모든 블록이 이미 메모리에 있다는 증거는 아니다.
- 액션 실행 뒤 Spark UI의 Storage 탭에서 저장된 파티션 수와 메모리·디스크 사용량을 본다. `storageLevel`은 저장 정책을 보여줄 뿐 실제로 채워진 양을 알려주지는 않는다. [Storage 탭](https://spark.apache.org/docs/3.5.6/web-ui.html#storage-tab)

비교할 때는 입력 데이터와 클러스터 자원, 후속 작업의 횟수를 맞춘다. 원래 한 번만 실행할 작업을 벤치마크에서 열 번 반복하면 캐시의 이득을 실제보다 크게 평가하게 된다.
