---
title: "AWS SAA 공부 4편: 고성능 영역 핵심 서비스와 개념 정리"
date: 2026-11-23T11:30:52+09:00
draft: false
description: "SAA-C03 고성능 영역의 서비스와 개념 70개를 정의·특징 목록으로 정리한다. 컴퓨팅, 스토리지, 데이터베이스, 네트워크, 데이터 수집·변환의 성능 요구와 선택 기준을 비교한다."
slug: "aws-saa-4"
categories: ["Cloud"]
tags: ["Cloud", "AWS", "Performance", "Certification"]
series: "AWS SAA 공부"
seriesOrder: 4
---

- **영역:** 고성능 아키텍처 설계 — 출제 비중 **24%**
- **구성:** 10개 묶음 · 70개 서비스·개념 · 항목별 **정의 + 특징**
- **표기:** 약어의 풀네임·영문 명칭은 항목명 아래 괄호로 표시. AWS는 Amazon Web Services.
- **기준:** 2026년 11월 23일. [공식 고성능 영역](https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03-domain3.html)의 스토리지·컴퓨팅·데이터베이스·네트워크·데이터 수집 및 변환을 정리한 학습 목록. 공식 범위의 모든 서비스를 나열한 목록은 아니다.
- **영역 구분:** 2편은 접근·보호, 3편은 장애 대응·복구, 4편은 처리량·지연·확장과 자원 선택에 초점을 둔다. 같은 서비스도 설계 목적에 따라 여러 영역에 등장한다.
- **이전 글:** [복원력 영역 핵심 서비스와 개념](/posts/aws-saa-3/)

## 1. 성능을 읽는 기준

### [지연 시간](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Statistics-definitions.html)

(Latency)

- **정의:** 요청을 보낸 뒤 응답을 받기까지 걸리는 시간.
- **특징:** 평균뿐 아니라 **p95·p99처럼 느린 요청 구간**도 살핀다. 컴퓨팅·스토리지·네트워크 중 어디에서 시간이 소비되는지 구분한다.

### [처리량](https://docs.aws.amazon.com/ebs/latest/userguide/ebs-performance.html)

(Throughput)

- **정의:** 단위 시간에 처리하는 데이터나 작업의 양.
- **특징:** 스토리지는 MiB/s, 서비스는 요청/초 등으로 측정한다. **처리량 증가와 개별 요청의 지연 감소는 같은 의미가 아니다.**

### [IOPS](https://docs.aws.amazon.com/ebs/latest/userguide/ebs-volume-types.html)

(Input/Output Operations Per Second)

- **정의:** 스토리지가 초당 처리하는 입출력 작업 수.
- **특징:** 작은 데이터의 랜덤 접근은 IOPS, 큰 데이터의 순차 접근은 처리량을 함께 본다. 같은 IOPS라도 I/O 크기에 따라 필요한 처리량이 달라진다.

### [수평 확장](https://docs.aws.amazon.com/autoscaling/ec2/userguide/what-is-amazon-ec2-auto-scaling.html)

(Horizontal Scaling · Scale Out / In)

- **정의:** 서버나 작업 실행 단위의 개수를 늘리거나 줄이는 방식.
- **특징:** 요청을 나눌 수 있어야 효과가 있다. 애플리케이션을 확장해도 **DB·외부 API의 병목**은 별도로 해결해야 한다.

### [수직 확장](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-types.html)

(Vertical Scaling · Scale Up / Down)

- **정의:** 개별 자원의 CPU·메모리 등 처리 능력을 조정하는 방식.
- **특징:** 더 큰 인스턴스나 DB 클래스를 선택한다. 변경 중단 여부와 자원 크기의 상한을 확인한다.

## 2. 컴퓨팅과 자동 확장

### [Amazon EC2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-types.html)

(Elastic Compute Cloud)

- **정의:** 필요한 사양의 가상 서버를 실행하는 서비스.
- **특징:** 범용·컴퓨팅 최적화·메모리 최적화·스토리지 최적화·가속 컴퓨팅 등에서 병목에 맞는 계열을 고른다. **vCPU 수만으로 성능을 판단하지 않는다.**

### [Amazon EC2 Auto Scaling](https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-scaling-target-tracking.html)

(Elastic Compute Cloud Auto Scaling)

- **정의:** 부하나 정책에 따라 EC2 인스턴스 수를 조절하는 서비스.
- **특징:** 목표 추적 정책은 CPU 사용률·대상당 요청 수 등의 목표를 유지한다. 인스턴스 준비 시간도 고려한다.

### [Application Auto Scaling](https://docs.aws.amazon.com/autoscaling/application/userguide/what-is-application-auto-scaling.html)

- **정의:** EC2 이외의 지원 서비스에서 확장 가능한 자원의 용량을 조절하는 서비스.
- **특징:** ECS 서비스의 작업 수나 DynamoDB 프로비저닝 용량 등에 적용한다. **서비스마다 지원하는 자원과 정책이 다르다.**

### [AWS Lambda](https://docs.aws.amazon.com/lambda/latest/dg/configuration-memory.html)

- **정의:** 이벤트에 반응해 코드를 실행하는 서버리스 컴퓨팅 서비스.
- **특징:** 메모리 설정에 비례해 CPU 자원도 달라진다. 메모리만 줄이기보다 실행 시간과 비용을 함께 측정한다.

### [Lambda Provisioned Concurrency](https://docs.aws.amazon.com/lambda/latest/dg/provisioned-concurrency.html)

(프로비저닝된 동시성)

- **정의:** Lambda 실행 환경을 미리 초기화해 준비하는 기능.
- **특징:** 초기화로 인한 지연을 줄인다. **Reserved Concurrency는 동시성을 예약·제한하며 실행 환경을 미리 데우는 기능이 아니다.**

### [Amazon ECS](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/Welcome.html)

(Elastic Container Service)

- **정의:** 컨테이너 배포와 실행을 관리하는 오케스트레이션 서비스.
- **특징:** 작업의 CPU·메모리와 서비스 작업 수를 구분해 조정한다. EC2 또는 Fargate 등의 실행 환경을 선택한다.

### [Amazon EKS](https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html)

(Elastic Kubernetes Service)

- **정의:** AWS의 관리형 Kubernetes 서비스.
- **특징:** Pod와 노드의 확장은 서로 다른 층위다. Kubernetes 사용 요구와 운영 역량을 기준으로 선택한다.

### [AWS Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html)

- **정의:** ECS·EKS에서 서버 인프라를 직접 관리하지 않고 컨테이너를 실행하는 컴퓨팅 환경.
- **특징:** 작업·Pod에 필요한 자원을 지정한다. 서버 관리가 줄어도 애플리케이션 병목과 자원 설정은 관리해야 한다.

### [AWS Batch](https://docs.aws.amazon.com/batch/latest/userguide/what-is-batch.html)

- **정의:** 배치 작업을 큐에 넣고 필요한 컴퓨팅 자원에 배치하는 서비스.
- **특징:** 대량 계산·파일 변환처럼 즉각적인 사용자 응답이 필요하지 않은 작업에 사용한다. 작업 큐·우선순위·컴퓨팅 환경을 함께 구성한다.

## 3. 블록·파일 스토리지

### [Amazon EBS](https://docs.aws.amazon.com/ebs/latest/userguide/ebs-performance.html)

(Elastic Block Store)

- **정의:** EC2에 연결하는 블록 스토리지.
- **특징:** 볼륨의 IOPS·처리량뿐 아니라 **EC2의 EBS 대역폭 한도**도 확인한다. 볼륨 성능만 높여서는 병목이 남을 수 있다.

### [EBS gp3](https://docs.aws.amazon.com/ebs/latest/userguide/ebs-volume-types.html)

(General Purpose SSD · Solid State Drive)

- **정의:** 범용 SSD 기반 EBS 볼륨 유형.
- **특징:** 용량과 별도로 IOPS·처리량을 조정할 수 있다. 일반적인 애플리케이션과 데이터베이스에서 먼저 검토한다.

### [EBS io2](https://docs.aws.amazon.com/ebs/latest/userguide/ebs-volume-types.html)

(Provisioned IOPS SSD)

- **정의:** 높고 일관된 입출력 성능이 필요한 EBS 볼륨 유형.
- **특징:** 입출력이 많은 핵심 데이터베이스에 적합하다. 요구 IOPS·지연 시간·내구성과 인스턴스 지원 조건을 함께 본다.

### [EBS st1 · sc1](https://docs.aws.amazon.com/ebs/latest/userguide/ebs-volume-types.html)

(Throughput Optimized HDD · Cold HDD / Hard Disk Drive)

- **정의:** 순차 접근과 처리량 중심 워크로드를 위한 HDD 기반 EBS 유형.
- **특징:** st1은 자주 접근하는 대용량 데이터, sc1은 접근 빈도가 낮은 데이터에 고려한다. **부팅 볼륨으로 사용할 수 없다.**

### [Amazon EFS](https://docs.aws.amazon.com/efs/latest/ug/performance.html)

(Elastic File System)

- **정의:** 여러 클라이언트가 공유하는 관리형 파일 스토리지.
- **특징:** Linux 계열의 공유 파일 접근에 사용한다. 성능 모드와 처리량 모드는 별도 설정이며, 일반적으로 General Purpose 성능 모드를 권장한다.

### [EFS 처리량 모드](https://docs.aws.amazon.com/efs/latest/ug/performance.html)

(Elastic · Provisioned · Bursting Throughput)

- **정의:** EFS 파일 시스템에 처리량을 제공하는 방식을 결정하는 설정.
- **특징:** Elastic은 사용량에 맞춰 조정하고, Provisioned는 처리량을 지정한다. Bursting은 저장량과 버스트 크레딧의 영향을 받는다.

### [Amazon FSx for Lustre](https://docs.aws.amazon.com/fsx/latest/LustreGuide/what-is.html)

- **정의:** 병렬 파일 시스템인 Lustre를 제공하는 관리형 서비스.
- **특징:** **HPC·머신러닝·대규모 데이터 처리**에 사용한다. S3와 연계해 데이터 처리용 파일 시스템을 구성할 수 있다. HPC는 High Performance Computing.

### [Amazon FSx for Windows File Server](https://docs.aws.amazon.com/fsx/latest/WindowsGuide/what-is.html)

- **정의:** Windows 파일 서버를 제공하는 관리형 서비스.
- **특징:** SMB(Server Message Block) 프로토콜과 Windows 기반 파일 공유가 필요할 때 사용한다. Active Directory 연동 요구도 함께 확인한다.

## 4. 객체 스토리지와 데이터 이동

### [Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance.html)

(Simple Storage Service)

- **정의:** 버킷 안에 데이터를 객체로 저장하는 서비스.
- **특징:** 정적 파일·로그·데이터 레이크 등에 사용한다. 병렬 요청으로 처리량을 높일 수 있으며, 급격한 요청 증가 시 일시적인 제한에 대비한다.

### [S3 Multipart Upload](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html)

(멀티파트 업로드)

- **정의:** 하나의 객체를 여러 부분으로 나눠 업로드한 뒤 결합하는 기능.
- **특징:** 부분을 병렬 전송하고 실패한 부분만 재전송할 수 있다. 완료하지 않은 업로드의 정리도 필요하다.

### [S3 Transfer Acceleration](https://docs.aws.amazon.com/AmazonS3/latest/userguide/transfer-acceleration.html)

(전송 가속)

- **정의:** 엣지 위치와 최적화된 네트워크 경로를 통해 S3와의 장거리 전송을 가속하는 기능.
- **특징:** 먼 지역에서 중앙 버킷으로 업로드할 때 검토한다. **CloudFront의 콘텐츠 캐싱과 목적이 다르며**, 실제 경로에서 효과를 측정한다.

### [AWS DataSync](https://docs.aws.amazon.com/datasync/latest/userguide/what-is-datasync.html)

- **정의:** 온프레미스와 AWS 스토리지 등 사이의 파일·객체 데이터 이동을 자동화하는 서비스.
- **특징:** NFS·SMB 파일 서버와 S3·EFS·FSx 등 지원 위치를 연결한다. 대량 이전이나 반복적인 데이터 복사에 사용한다.

### [AWS Storage Gateway](https://docs.aws.amazon.com/storagegateway/)

- **정의:** 온프레미스 애플리케이션과 AWS 스토리지를 연결하는 하이브리드 스토리지 서비스.
- **특징:** 파일·볼륨·테이프 게이트웨이 등 용도에 맞는 유형을 선택한다. 단발성 복사보다 **기존 스토리지 접근 방식의 연장**에 초점을 둔다.

## 5. 관계형 데이터베이스와 캐시

### [Amazon RDS · DB 엔진 선택](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Welcome.html)

(Relational Database Service · Database Engine)

- **정의:** MySQL·PostgreSQL 등 관계형 데이터베이스의 운영을 관리하는 서비스와 그 실행 엔진 선택.
- **특징:** 기존 SQL·확장 기능·트랜잭션 요구와 호환되는 엔진을 고른다. **읽기·쓰기 비중, 메모리, 스토리지 I/O**를 함께 보고 인스턴스와 저장소를 구성한다.

### [RDS Read Replica](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ReadRepl.html)

(Relational Database Service Read Replica)

- **정의:** 원본 데이터베이스의 데이터를 복제해 읽기 요청을 처리하는 인스턴스.
- **특징:** 조회 부하를 분산한다. 비동기 복제로 지연이 생길 수 있으며 **쓰기 처리량을 직접 확장하지 않는다.**

### [Amazon RDS Proxy](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html)

(Relational Database Service Proxy)

- **정의:** 애플리케이션과 DB 사이에서 연결을 풀링하고 재사용하는 관리형 프록시.
- **특징:** Lambda처럼 연결이 급증하는 환경에 유용하다. **연결 관리 기능이며 쿼리 결과 캐시가 아니다.**

### [Aurora Serverless v2](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html)

- **정의:** 워크로드에 맞춰 Aurora 데이터베이스의 컴퓨팅 용량을 자동 조정하는 구성.
- **특징:** 최소·최대 용량 범위와 엔진·버전 지원을 확인한다. 용량 확장이 잘못된 쿼리나 잠금 경합까지 해결하지는 않는다.

### [Amazon ElastiCache](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html)

- **정의:** 인메모리 데이터 저장소를 제공하는 관리형 서비스.
- **특징:** 반복 조회·세션·캐시 등에 사용한다. 캐시 적중 시 DB 접근을 줄일 수 있지만 만료·무효화·장애 시 동작을 설계해야 한다.

### [Cache Aside](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html)

(Lazy Loading)

- **정의:** 애플리케이션이 캐시를 먼저 조회하고, 없으면 원본에서 읽어 캐시에 저장하는 패턴.
- **특징:** 실제로 읽힌 데이터 위주로 채워진다. **캐시 미스에서는 원본 조회가 필요**하며 오래된 데이터의 갱신 정책이 중요하다.

### [Write Through](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html)

(쓰기 연동 캐시 갱신)

- **정의:** 애플리케이션이 원본 데이터 변경과 함께 캐시도 갱신하는 패턴.
- **특징:** 후속 조회의 캐시 적중에 도움이 되지만 쓰기 지연이 늘 수 있다. 두 저장소의 부분 실패도 처리해야 한다.

### [캐시 TTL](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html)

(Time To Live)

- **정의:** 캐시 항목을 유효하게 유지하는 시간.
- **특징:** 길면 적중률에 유리하지만 오래된 데이터가 남을 수 있다. 짧으면 최신성에 유리하지만 원본 조회가 늘 수 있다.

### [AWS DMS](https://docs.aws.amazon.com/dms/latest/userguide/Welcome.html)

(Database Migration Service)

- **정의:** 데이터베이스 이전과 지속적인 데이터 복제를 지원하는 서비스.
- **특징:** 동종·이기종 이전을 검토할 수 있다. 이기종 이전은 스키마 변환과 애플리케이션 호환성을 별도로 확인한다.

## 6. DynamoDB의 처리 용량과 접근 패턴

### [Amazon DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html)

- **정의:** 키-값·문서 모델을 지원하는 관리형 NoSQL 데이터베이스.
- **특징:** 예상 조회 패턴을 바탕으로 키를 설계한다. 관계형 DB의 조인을 그대로 옮기기보다 필요한 접근을 효율적으로 지원하도록 모델링한다.

### [DynamoDB 용량 모드](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/capacity-mode.html)

(On-demand · Provisioned)

- **정의:** DynamoDB 읽기·쓰기 처리 용량을 제공하고 과금하는 방식.
- **특징:** On-demand는 요청 기반, Provisioned는 용량 설정 기반이다. **On-demand도 무제한 처리 보장은 아니며** 키 분산과 할당량을 고려한다.

### [DynamoDB RCU · WCU](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/provisioned-capacity-mode.html)

(Read Capacity Unit · Write Capacity Unit)

- **정의:** 프로비저닝 모드에서 읽기·쓰기 처리 용량을 나타내는 단위.
- **특징:** 항목 크기·읽기 일관성·트랜잭션 여부에 따라 필요한 용량이 달라진다. API 호출 한 번을 항상 한 단위로 계산하지 않는다.

### [DynamoDB Partition Key](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html)

(파티션 키)

- **정의:** DynamoDB에서 데이터 배치와 기본 접근 경로를 결정하는 키.
- **특징:** 소수 키에 요청이 몰리는 **핫 파티션**을 피한다. 키 종류가 많아도 실제 요청이 한 키에 집중되면 병목이 생긴다.

### [DynamoDB GSI · LSI](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/SecondaryIndexes.html)

(Global Secondary Index · Local Secondary Index)

- **정의:** 기본 테이블의 키와 다른 조회 경로를 제공하는 보조 인덱스.
- **특징:** GSI는 다른 파티션 키를, LSI는 같은 파티션 키와 다른 정렬 키를 사용할 수 있다. 조회 패턴에 맞춰 저장·쓰기 비용도 고려한다.

### [DynamoDB 읽기 일관성](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadConsistency.html)

(Eventually Consistent Read · Strongly Consistent Read)

- **정의:** 최근 완료된 쓰기를 읽기에 반영하는 보장 수준.
- **특징:** 기본값은 최종적 일관성이다. 테이블과 LSI는 강한 일관성 읽기를 지원하지만 **GSI 읽기는 최종적 일관성만 지원한다.**

### [DAX](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DAX.html)

(DynamoDB Accelerator)

- **정의:** DynamoDB 읽기를 가속하는 관리형 인메모리 캐시.
- **특징:** 반복되는 **최종적 일관성 읽기**에 적합하다. 강한 일관성 읽기는 DynamoDB로 전달되며 캐시 결과로 처리하지 않는다.

## 7. 콘텐츠 전달과 네트워크 경로

### [VPC 서브넷·IP 주소 설계](https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html)

(Virtual Private Cloud · Internet Protocol)

- **정의:** 주소 범위와 서브넷·라우팅을 정해 애플리케이션 계층별 자원을 배치하는 네트워크 설계.
- **특징:** 웹·애플리케이션·DB의 통신 경로를 구분하고 확장에 필요한 주소 공간을 확보한다. **서브넷 하나는 AZ 하나에 속하며**, 계층을 나눴다는 사실만으로 성능이 높아지지는 않는다.

### [Amazon CloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html)

(Content Delivery Network · CDN)

- **정의:** 엣지 위치를 통해 콘텐츠를 전달하는 서비스.
- **특징:** 캐시 가능한 응답을 사용자 가까이에서 제공해 원본 부하를 줄인다. 캐시 키·TTL·캐시 가능 여부가 적중률에 영향을 준다.

### [AWS Global Accelerator](https://docs.aws.amazon.com/global-accelerator/latest/dg/what-is-global-accelerator.html)

- **정의:** AWS 글로벌 네트워크를 사용해 애플리케이션 엔드포인트로의 경로를 최적화하는 서비스.
- **특징:** 고정 Anycast IP와 TCP·UDP 기반 애플리케이션 가속이 주요 단서다. **콘텐츠 캐시를 제공하는 서비스는 아니다.**

### [ALB](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html)

(Application Load Balancer)

- **정의:** HTTP·HTTPS 요청을 애플리케이션 계층에서 분산하는 로드 밸런서.
- **특징:** 호스트·경로 기반 라우팅이 필요할 때 사용한다. 웹 애플리케이션의 여러 대상 그룹으로 요청을 나눌 수 있다.

### [NLB](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/introduction.html)

(Network Load Balancer)

- **정의:** TCP·UDP·TLS 트래픽을 전송 계층에서 분산하는 로드 밸런서.
- **특징:** 연결 단위의 고성능 분산과 고정 IP 요구를 검토할 때 사용한다. HTTP 경로 기반 라우팅은 ALB의 기능이다.

### [AWS Site-to-Site VPN](https://docs.aws.amazon.com/vpn/latest/s2svpn/VPC_VPN.html)

(Virtual Private Network)

- **정의:** 온프레미스와 AWS 사이에 IPsec(Internet Protocol Security) 암호화 터널을 구성하는 서비스.
- **특징:** 인터넷 기반 하이브리드 연결 등에 사용한다. 필요한 처리량·지연 시간·경로의 변동성을 확인하고 **전용 연결인 Direct Connect와 비교**한다.

### [AWS Direct Connect](https://docs.aws.amazon.com/directconnect/latest/UserGuide/Welcome.html)

- **정의:** 온프레미스 네트워크와 AWS를 전용 연결로 연계하는 서비스.
- **특징:** 일관된 네트워크 성능이 필요한 하이브리드 환경에 고려한다. **전용 연결이 기본 암호화를 의미하지 않으며**, 암호화와 이중화는 별도로 설계한다.

### [AWS PrivateLink](https://docs.aws.amazon.com/vpc/latest/privatelink/what-is-privatelink.html)

- **정의:** 지원 서비스에 사설 네트워크 경로로 접근하게 하는 기술.
- **특징:** 서비스 소비자와 제공자 사이의 사설 접근을 구성한다. 인터넷을 사용하지 않는다는 이유만으로 모든 요청의 성능 향상이 보장되지는 않는다.

## 8. 노드 간 통신과 비동기 처리

### [EC2 Placement Group](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/placement-groups.html)

(배치 그룹)

- **정의:** EC2 인스턴스의 배치 전략을 지정하는 기능.
- **특징:** **Cluster는 단일 AZ에서 노드 간 통신 성능**, Spread·Partition은 하드웨어 장애의 영향 분리에 초점을 둔다. AZ는 Availability Zone.

### [ENA](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/enhanced-networking.html)

(Elastic Network Adapter)

- **정의:** 지원 EC2 인스턴스에서 향상된 네트워킹을 제공하는 인터페이스.
- **특징:** 더 높은 대역폭과 패킷 처리 성능, 낮은 지연에 도움이 된다. 인스턴스 유형과 드라이버 지원을 확인한다.

### [EFA](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/efa.html)

(Elastic Fabric Adapter)

- **정의:** EC2에서 분산 HPC·머신러닝 통신을 지원하는 네트워크 인터페이스.
- **특징:** 노드 간 통신이 많은 작업에 사용한다. 지원 인스턴스와 애플리케이션 통신 라이브러리 구성이 필요하다.

### [Amazon SQS](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html)

(Simple Queue Service)

- **정의:** 처리할 메시지를 큐에 보관하고 소비자가 가져가게 하는 서비스.
- **특징:** 갑작스러운 요청을 버퍼링하고 생산자와 소비자를 독립적으로 확장한다. **큐가 있다고 처리 지연이 자동으로 줄어드는 것은 아니다.**

### [발행·구독과 SNS Fanout](https://docs.aws.amazon.com/sns/latest/dg/sns-sqs-as-subscriber.html)

(Publish/Subscribe · Simple Notification Service Fanout)

- **정의:** 발행한 메시지를 여러 구독자에게 전달하는 패턴.
- **특징:** SNS 토픽에 여러 SQS 큐를 연결하면 같은 이벤트를 서로 다른 처리 계통으로 전달할 수 있다. **소비자별 큐와 처리 용량을 분리**해 각 작업을 독립적으로 확장한다.

## 9. 데이터 수집과 변환

### [Amazon Kinesis Data Streams](https://docs.aws.amazon.com/streams/latest/dev/introduction.html)

- **정의:** 연속적으로 발생하는 데이터를 수집하고 소비자가 처리하도록 제공하는 스트리밍 서비스.
- **특징:** 실시간 처리와 여러 소비자의 독립적인 읽기에 사용한다. 데이터 보존 기간 안에서 재처리하는 구조를 만들 수 있다.

### [Kinesis Shard](https://docs.aws.amazon.com/streams/latest/dev/key-concepts.html)

(샤드)

- **정의:** Kinesis Data Streams의 스트림을 구성하는 처리 용량 단위.
- **특징:** 파티션 키가 데이터의 샤드 배치에 영향을 준다. 샤드 수뿐 아니라 특정 키로 몰리는 쓰기와 소비자의 읽기 방식도 확인한다.

### [Amazon Data Firehose](https://docs.aws.amazon.com/firehose/latest/dev/what-is-this-service.html)

- **정의:** 스트리밍 데이터를 지원 목적지로 전달하는 관리형 서비스.
- **특징:** S3·Redshift 등으로 적재할 때 사용한다. 목적지별 버퍼링·변환 조건을 확인하며 **즉시 전달을 일괄 보장하는 것으로 보지 않는다.**

### [Amazon MSK](https://docs.aws.amazon.com/msk/latest/developerguide/what-is-msk.html)

(Managed Streaming for Apache Kafka)

- **정의:** Apache Kafka 클러스터 운영을 관리하는 서비스.
- **특징:** Kafka API·도구·기존 생태계와의 호환이 필요할 때 고려한다. 파티션·소비자·데이터 보존 등 애플리케이션 설계는 여전히 필요하다.

### [AWS Glue](https://docs.aws.amazon.com/glue/latest/dg/what-is-glue.html)

- **정의:** 데이터 탐색·준비·변환을 지원하는 서버리스 데이터 통합 서비스.
- **특징:** ETL(Extract, Transform, Load) 작업으로 데이터를 추출·변환·적재한다. 분석용 포맷 변환과 정기 데이터 처리에 사용한다.

### [AWS Glue Data Catalog · Crawler](https://docs.aws.amazon.com/glue/latest/dg/catalog-and-crawler.html)

- **정의:** 데이터의 테이블·스키마 메타데이터를 관리하는 카탈로그와 이를 탐색하는 크롤러.
- **특징:** Athena 등에서 같은 메타데이터를 활용한다. **크롤러가 원본 파일을 자동으로 Parquet로 바꾸는 것은 아니다.**

### [Amazon EMR](https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-what-is-emr.html)

(Elastic MapReduce — 기존 명칭)

- **정의:** Spark·Hadoop 등으로 대규모 데이터를 처리하는 관리형 플랫폼.
- **특징:** 분산 처리 프레임워크와 실행 환경에 대한 제어가 필요할 때 고려한다. 실행 방식에 따라 클러스터 관리 범위가 달라진다.

## 10. 분석과 데이터 레이크

### [Amazon Athena](https://docs.aws.amazon.com/athena/latest/ug/what-is.html)

- **정의:** S3 데이터 등을 SQL로 조회할 수 있는 서버리스 분석 서비스.
- **특징:** 별도 DB에 적재하지 않는 대화형 조회에 적합하다. 분석하는 파일의 형식·파티션·스캔량이 성능에 영향을 준다.

### [Amazon Redshift](https://docs.aws.amazon.com/redshift/latest/mgmt/welcome.html)

- **정의:** 대규모 분석 쿼리를 위한 관리형 데이터 웨어하우스.
- **특징:** 집계·분석 중심 워크로드에 사용한다. Provisioned와 Serverless 옵션이 있으며 트랜잭션 처리용 DB와 요구가 다르다.

### [데이터 레이크](https://docs.aws.amazon.com/lake-formation/latest/dg/what-is-lake-formation.html)

(Data Lake)

- **정의:** 다양한 형식의 데이터를 저장하고 여러 분석 도구가 활용하도록 구성한 저장 기반.
- **특징:** AWS에서는 S3를 저장 계층으로 많이 사용한다. 저장소 외에 카탈로그·권한·데이터 품질 관리가 필요하다.

### [AWS Lake Formation](https://docs.aws.amazon.com/lake-formation/latest/dg/what-is-lake-formation.html)

- **정의:** 데이터 레이크의 접근 권한과 거버넌스를 관리하는 서비스.
- **특징:** S3 데이터와 Glue Data Catalog를 연계해 세밀한 접근을 관리한다. **데이터를 직접 조회하는 쿼리 엔진은 아니다.**

### [AWS Quick Sight](https://docs.aws.amazon.com/quick/latest/userguide/what-is.html)

- **정의:** AWS Quick의 데이터 시각화·비즈니스 인텔리전스 기능.
- **특징:** 분석 결과를 대시보드로 제공하는 용도다. 과거 자료의 Amazon QuickSight와 명칭이 다를 수 있어 사용 중인 공식 문서를 함께 확인한다.

### [Apache Parquet](https://docs.aws.amazon.com/athena/latest/ug/columnar-storage.html)

- **정의:** 컬럼 단위로 데이터를 저장하는 파일 형식.
- **특징:** 분석에서 필요한 컬럼만 읽고 압축을 활용해 I/O를 줄일 수 있다. CSV를 단순히 확장자만 바꾸는 것으로 변환할 수는 없다.

### [Athena 데이터 파티셔닝](https://docs.aws.amazon.com/athena/latest/ug/partitions.html)

(Data Partitioning)

- **정의:** 날짜·지역 등의 기준으로 데이터를 나눠 조회 범위를 줄이는 구성.
- **특징:** 쿼리에서 파티션 조건을 사용하면 필요한 부분만 스캔할 수 있다. 자주 사용하는 필터에 맞춰 파티션 키를 정한다.

## 헷갈리기 쉬운 선택 기준

| 요구 사항 | 먼저 검토할 서비스·개념 | 구분할 점 |
| --- | --- | --- |
| 작은 랜덤 I/O가 많음 | EBS gp3·io2, IOPS | 볼륨과 EC2 양쪽 한도 확인 |
| 큰 파일을 순차 처리 | 처리량, EBS st1 | IOPS 수치만 비교하지 않음 |
| Linux 공유 파일 | EFS | 블록 스토리지 EBS와 접근 방식이 다름 |
| 병렬 HPC 파일 처리 | FSx for Lustre | Windows SMB 공유는 FSx for Windows |
| 멀리서 S3로 업로드 | S3 Transfer Acceleration | 콘텐츠 조회 캐시는 CloudFront |
| DB 조회 부하 분산 | Read Replica | 복제 지연과 읽기 경로 분리 필요 |
| 반복 조회 결과 재사용 | ElastiCache·DAX | DAX는 DynamoDB 전용 |
| DB 연결 폭증 | RDS Proxy | 쿼리 결과 캐시가 아님 |
| Lambda 초기화 지연 감소 | Provisioned Concurrency | Reserved Concurrency와 다름 |
| HTTP 경로별 분산 | ALB | TCP·UDP 연결 분산은 NLB |
| 엣지 콘텐츠 캐싱 | CloudFront | Global Accelerator는 네트워크 경로 최적화 |
| 실시간 데이터 소비·재처리 | Kinesis Data Streams | 목적지 적재 중심이면 Firehose |
| Kafka 호환 스트리밍 | MSK | Kafka 파티션·소비자 설계는 필요 |
| 데이터 변환 | Glue·EMR | Glue Crawler는 메타데이터 탐색 |
| S3 데이터 SQL 조회 | Athena | Parquet·파티션으로 스캔량 감소 |
| 데이터 레이크 권한 관리 | Lake Formation | 조회는 Athena 등 별도 엔진이 수행 |
