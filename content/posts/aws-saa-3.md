---
title: "AWS SAA 공부 3편: 복원력 영역 핵심 서비스와 개념 정리"
date: 2026-11-17T15:47:56+09:00
draft: false
description: "SAA-C03 복원력 영역의 서비스와 개념 70개를 정의·특징 목록으로 정리한다. 느슨한 결합, 자동 확장, 메시징, 데이터 복구, 고가용성과 재해 복구 전략의 차이를 살펴본다."
slug: "aws-saa-3"
categories: ["Cloud"]
tags: ["Cloud", "AWS", "Resilience", "Certification"]
series: "AWS SAA 공부"
seriesOrder: 3
---

- **영역:** 복원력 있는 아키텍처 설계 — 출제 비중 **26%**
- **구성:** 10개 묶음 · 70개 서비스·개념 · 항목별 **정의 + 특징**
- **표기:** 약어의 풀네임·영문 명칭은 항목명 아래 괄호로 표시. AWS는 Amazon Web Services.
- **기준:** 2026년 11월 17일. [공식 복원력 영역](https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03-domain2.html)의 느슨한 결합·확장성·고가용성·장애 복구와 관련 개념을 정리한 학습 목록.
- **이전 글:** [보안 영역 핵심 서비스와 개념](/posts/aws-saa-2/)

## 1. 복원력의 기본 개념

### [고가용성 · HA](https://docs.aws.amazon.com/whitepapers/latest/availability-and-beyond-improving-resilience/fault-tolerance-and-fault-isolation.html)

(High Availability)

- **정의:** 장애가 발생하더라도 서비스 중단 시간을 줄이도록 설계하는 특성.
- **특징:** 여러 자원에 부하를 분산하고 장애 감지·전환을 준비한다. **자원을 여러 개 만드는 것만으로 완성되지는 않는다.**

### [내결함성](https://docs.aws.amazon.com/whitepapers/latest/availability-and-beyond-improving-resilience/fault-tolerance-and-fault-isolation.html)

(Fault Tolerance)

- **정의:** 일부 구성 요소가 실패해도 요구된 서비스를 계속 제공하는 능력.
- **특징:** 중복 자원과 충분한 여유 용량이 필요하다. 어떤 장애를 견디도록 설계했는지 범위를 정한다.

### [단일 장애 지점 · SPOF](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel-dp.html)

(Single Point of Failure)

- **정의:** 하나의 구성 요소가 실패하면 전체 서비스에 영향을 주는 지점.
- **특징:** 서버뿐 아니라 데이터베이스·네트워크 경로·외부 의존성도 확인한다. 중복 구성과 전환 경로로 영향을 줄인다.

### [Multi-AZ](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html)

(Multiple Availability Zones)

- **정의:** 한 리전 안의 여러 가용 영역에 자원을 분산하는 구성.
- **특징:** 가용 영역 단위 장애에 대비한다. **리전 전체 장애에 대한 복구와는 범위가 다르다.**

### [Multi-Region](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html)

- **정의:** 여러 AWS 리전에 애플리케이션이나 데이터를 배치하는 구성.
- **특징:** 리전 장애와 지리적 요구에 대응한다. 데이터 복제·트래픽 전환·일관성·비용을 함께 설계한다.

### [가용성 / 내구성](https://docs.aws.amazon.com/efs/latest/ug/features.html)

(Availability / Durability)

- **정의:** 가용성은 필요할 때 사용할 수 있는 정도, 내구성은 데이터를 잃지 않고 보존하는 정도.
- **특징:** 데이터가 보존되어도 일시적으로 접근하지 못할 수 있다. **데이터 보존과 서비스 접근 목표를 따로 확인**한다.

## 2. 느슨한 결합과 확장 방식

### [느슨한 결합](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_prevent_interaction_failure_loosely_coupled_system.html)

(Loose Coupling)

- **정의:** 구성 요소가 서로의 구현·실행 상태에 과도하게 의존하지 않도록 분리하는 설계.
- **특징:** 큐·이벤트·명확한 인터페이스를 활용한다. 한 구성 요소의 지연이나 변경이 전체로 번지는 영향을 줄인다.

### [마이크로서비스](https://docs.aws.amazon.com/whitepapers/latest/microservices-on-aws/microservices-on-aws.html)

(Microservices)

- **정의:** 애플리케이션을 작은 서비스로 나누고 인터페이스로 연결하는 구조.
- **특징:** 서비스별 배포·확장이 가능하다. 통신 실패와 데이터 일관성을 다뤄야 하므로 무조건 단순해지는 것은 아니다.

### [다중 계층 아키텍처](https://docs.aws.amazon.com/whitepapers/latest/microservices-on-aws/microservices-on-aws.html)

(Multi-tier Architecture)

- **정의:** 웹·애플리케이션·데이터처럼 역할별 계층을 분리한 구조.
- **특징:** 계층별 확장과 접근 제어가 가능하다. 각 계층에 단일 장애 지점이 남아 있는지 확인한다.

### [무상태 워크로드](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_mitigate_interaction_failure_stateless.html)

(Stateless Workload)

- **정의:** 다음 요청을 처리하는 데 특정 서버의 로컬 상태가 필요하지 않은 워크로드.
- **특징:** 세션·사용자 데이터를 외부 저장소로 분리하면 서버 교체와 수평 확장이 쉬워진다. **시스템 전체에 데이터가 없다는 뜻은 아니다.**

### [상태 유지 워크로드](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_mitigate_interaction_failure_stateless.html)

(Stateful Workload)

- **정의:** 이전 요청에서 만들어진 상태를 유지하며 처리하는 워크로드.
- **특징:** 서버를 교체하거나 확장할 때 상태의 이동·복제·복구가 필요하다. 특정 서버에만 세션을 저장하면 장애 시 세션을 잃을 수 있다.

### [수평 확장](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel-dp.html)

(Horizontal Scaling / Scale Out)

- **정의:** 인스턴스나 작업의 개수를 늘려 처리 용량을 확장하는 방식.
- **특징:** 여러 자원에 부하를 나눈다. 공유 데이터·세션·하위 데이터베이스의 병목도 함께 고려한다.

### [수직 확장](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/WhatIs.corecomponents.html)

(Vertical Scaling / Scale Up)

- **정의:** 하나의 자원에 더 큰 처리 용량을 제공하는 방식.
- **특징:** 예를 들어 더 큰 인스턴스 유형으로 변경한다. 단일 자원의 용량 한계와 변경 중단 가능성을 확인한다.

## 3. 트래픽 분산과 자동 복구

### [ELB](https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/what-is-load-balancing.html)

(Elastic Load Balancing)

- **정의:** 여러 대상에 들어오는 트래픽을 분산하는 AWS 서비스.
- **특징:** 대상의 상태를 확인해 라우팅한다. **부하 분산 자체가 애플리케이션 서버 수를 늘려주지는 않는다.**

### [ALB](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html)

(Application Load Balancer)

- **정의:** HTTP·HTTPS 요청을 애플리케이션 계층에서 분산하는 로드 밸런서.
- **특징:** 호스트·경로 등 요청 내용에 따라 대상을 선택한다. 웹 서비스와 마이크로서비스의 진입점에 활용한다.

### [NLB](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/introduction.html)

(Network Load Balancer)

- **정의:** TCP·UDP 등 전송 계층 트래픽을 분산하는 로드 밸런서.
- **특징:** 연결 단위로 대상에 전달한다. 웹 요청의 경로를 읽어 분기하는 ALB와 선택 기준이 다르다.

### [헬스 체크](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html)

(Health Check)

- **정의:** 대상이 요청을 처리할 수 있는지 주기적으로 확인하는 검사.
- **특징:** 경로·응답 코드·임계값을 적절히 정한다. **ALB의 모든 대상이 비정상이면 fail-open으로 비정상 대상에도 전달**할 수 있다.

### [EC2 Auto Scaling · ASG](https://docs.aws.amazon.com/autoscaling/ec2/userguide/what-is-amazon-ec2-auto-scaling.html)

(Elastic Compute Cloud / Auto Scaling Group)

- **정의:** EC2 인스턴스 그룹의 용량을 유지·조절하는 서비스.
- **특징:** 최소·최대·원하는 용량과 확장 정책을 설정한다. 여러 가용 영역에 배치하고 비정상 인스턴스를 교체한다. **로드 밸런서의 헬스 체크를 사용하려면 별도로 활성화**한다. [상태 확인 설정](https://docs.aws.amazon.com/autoscaling/ec2/userguide/health-checks-overview.html)

### [Amazon Route 53](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-failover.html)

- **정의:** DNS(Domain Name System)를 이용해 서비스의 접속 대상을 안내하는 서비스.
- **특징:** 헬스 체크와 장애 조치 라우팅을 조합해 정상 대상으로 전환한다. **DNS 응답 전환이 기존 연결을 즉시 옮기는 것은 아니다.**

## 4. 메시징과 이벤트 기반 연결

### [Amazon SQS](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html)

(Simple Queue Service)

- **정의:** 생산자가 보낸 메시지를 소비자가 나중에 가져가 처리하도록 보관하는 큐 서비스.
- **특징:** 처리 속도 차이를 흡수하고 서비스 사이를 분리한다. 큐가 쌓이는 속도에 맞춰 소비자 용량도 관리한다.

### [SQS Standard](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues.html)

(Simple Queue Service Standard Queue)

- **정의:** 높은 처리량과 최소 한 번 전달을 제공하는 기본 큐 유형.
- **특징:** **중복 전달과 순서 변경이 가능**하다. 소비자는 중복 메시지를 받아도 결과가 안전하도록 설계한다.

### [SQS FIFO](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-fifo-queues.html)

(Simple Queue Service / First In, First Out)

- **정의:** 메시지 그룹별 순서와 중복 제거 기능을 제공하는 큐 유형.
- **특징:** 같은 메시지 그룹 안에서 순서를 유지한다. **외부 결제·DB 변경까지 자동으로 한 번만 실행해 주는 것은 아니다.**

### [가시성 제한 시간](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html)

(Visibility Timeout)

- **정의:** SQS에서 수신한 메시지를 다른 소비자에게 일시적으로 숨기는 기간.
- **특징:** 처리 성공 후 메시지를 삭제한다. 삭제 전에 시간이 끝나면 다시 전달될 수 있으므로 처리 시간과 연장 전략을 맞춘다.

### [DLQ](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html)

(Dead-letter Queue)

- **정의:** 반복해서 처리되지 못한 메시지를 분리해 두는 큐.
- **특징:** SQS에서는 최대 수신 횟수 등 재전달 정책으로 이동을 제어한다. 원인을 해결한 뒤 재처리하며, **DLQ만으로 실패가 해결되지는 않는다.**

### [Amazon SNS](https://docs.aws.amazon.com/sns/latest/dg/welcome.html)

(Simple Notification Service)

- **정의:** 발행자가 토픽에 보낸 메시지를 구독자에게 전달하는 서비스.
- **특징:** 여러 큐·함수·알림 대상으로 메시지를 전달한다. 한 작업을 소비자가 가져가는 큐와 전달 구조가 다르다.

### [발행·구독과 팬아웃](https://docs.aws.amazon.com/sns/latest/dg/welcome.html)

(Publish / Subscribe · Fan-out)

- **정의:** 하나의 메시지를 여러 독립된 구독자에게 전달하는 패턴.
- **특징:** SNS와 여러 SQS 큐를 연결하면 각 서비스가 자기 큐에서 독립적으로 처리할 수 있다.

### [Amazon EventBridge](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-what-is.html)

- **정의:** 이벤트를 수집·필터링·변환해 다른 구성 요소로 전달하는 서비스.
- **특징:** AWS 서비스·애플리케이션의 이벤트로 작업을 연결한다. 이벤트 조건에 맞춰 분기하는 구조에 활용한다.

### [AWS Step Functions](https://docs.aws.amazon.com/step-functions/latest/dg/welcome.html)

- **정의:** 여러 작업의 순서·분기·병렬 실행을 워크플로로 구성하는 서비스.
- **특징:** 상태 머신으로 실행 흐름을 관리한다. 개별 작업을 연결할 때 오류 처리와 재시도도 함께 설계한다.

### [Amazon MQ](https://docs.aws.amazon.com/amazon-mq/latest/developer-guide/welcome.html)

- **정의:** Apache ActiveMQ·RabbitMQ를 위한 관리형 메시지 브로커 서비스.
- **특징:** 기존 브로커의 프로토콜과 클라이언트를 활용하는 이전에 적합하다. 엔진별 고가용성 배포 구성을 확인한다.

## 5. 서버리스와 컨테이너

### [Amazon API Gateway](https://docs.aws.amazon.com/apigateway/latest/developerguide/welcome.html)

(Application Programming Interface Gateway)

- **정의:** 클라이언트가 호출할 API의 생성·배포·관리를 지원하는 서비스.
- **특징:** 인증·트래픽 제어와 백엔드 연결을 구성한다. 지원 기능은 REST·HTTP·WebSocket API 유형에 따라 다르다.

### [AWS Lambda](https://docs.aws.amazon.com/lambda/latest/dg/welcome.html)

- **정의:** 서버를 직접 관리하지 않고 코드를 실행하는 컴퓨팅 서비스.
- **특징:** 이벤트와 API 호출에 연결한다. 동시 실행 한도와 호출 방식별 재시도·오류 처리 동작을 확인한다.

### [Amazon ECS](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/Welcome.html)

(Elastic Container Service)

- **정의:** 컨테이너 작업의 배치·실행·관리를 지원하는 오케스트레이션 서비스.
- **특징:** 서비스로 원하는 작업 수를 유지하고 부하 분산과 연결한다. 컨테이너 이미지와 실행 자원의 역할을 구분한다.

### [Amazon EKS](https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html)

(Elastic Kubernetes Service)

- **정의:** Kubernetes 애플리케이션을 실행하도록 관리형 제어 영역 등을 제공하는 서비스.
- **특징:** Pod 배치·복제·확장 구성을 Kubernetes 방식으로 관리한다. EKS 사용만으로 애플리케이션이 자동 고가용성이 되는 것은 아니다.

### [AWS Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html)

- **정의:** 컨테이너를 실행할 서버를 직접 준비·관리하지 않도록 하는 컴퓨팅 기술.
- **특징:** ECS 등과 함께 사용하며 작업의 자원·네트워크를 지정한다. **작업 개수의 확장 정책은 별도로 구성**한다.

## 6. 저장소와 데이터 복구

### [Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html)

(Simple Storage Service)

- **정의:** 객체 단위로 데이터를 저장하는 서비스.
- **특징:** 백업·정적 콘텐츠 등에 사용한다. **저장 클래스별 가용 영역 구성과 복원 조건이 다르므로** One Zone과 다중 영역 저장을 구분한다.

### [Amazon EBS](https://docs.aws.amazon.com/ebs/latest/userguide/ebs-volumes.html)

(Elastic Block Store)

- **정의:** EC2 인스턴스에 연결해 사용하는 블록 스토리지.
- **특징:** 볼륨과 인스턴스는 같은 가용 영역에 있어야 한다. 다른 영역으로 복구하려면 스냅샷 등 복원 경로를 준비한다.

### [Amazon EFS](https://docs.aws.amazon.com/efs/latest/ug/features.html)

(Elastic File System)

- **정의:** 여러 컴퓨팅 자원에서 공유해 사용할 수 있는 관리형 파일 스토리지.
- **특징:** NFS(Network File System) 기반으로 접근한다. **Regional과 One Zone의 장애 범위가 다르다.**

### [EBS 스냅샷](https://docs.aws.amazon.com/ebs/latest/userguide/what-is-ebs.html)

(Elastic Block Store Snapshot)

- **정의:** EBS 볼륨의 특정 시점 데이터를 보존하는 백업.
- **특징:** 원본 볼륨과 독립적으로 유지되고 새 볼륨으로 복원할 수 있다. **백업 생성 성공과 복구 가능 여부는 따로 검증**한다.

### [S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html)

(Simple Storage Service Versioning)

- **정의:** 같은 객체의 여러 버전을 유지하는 기능.
- **특징:** 덮어쓰기·실수로 삭제한 객체를 복원하는 데 활용한다. 영구 버전 삭제를 막는 설정과는 별개다.

### [S3 Replication](https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication.html)

(Simple Storage Service Replication)

- **정의:** 버킷 사이에 객체를 비동기로 복제하는 기능.
- **특징:** 같은 리전 또는 다른 리전으로 복제한다. 기존 객체의 소급 복제와 삭제 반영 조건을 별도로 확인한다.

### [AWS Backup](https://docs.aws.amazon.com/aws-backup/latest/devguide/whatisbackup.html)

- **정의:** 지원 서비스의 백업 일정·보존·관리 작업을 중앙화하는 서비스.
- **특징:** 서비스별 백업을 정책으로 관리한다. 복구 대상·권한·절차까지 점검해야 실제 장애 때 사용할 수 있다.

## 7. 데이터베이스의 가용성과 부하 분산

### [RDS Multi-AZ DB 인스턴스](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZSingleStandby.html)

(Relational Database Service / Multiple Availability Zones)

- **정의:** 주 DB와 다른 가용 영역의 대기 DB를 구성하는 배포 방식.
- **특징:** 동기 복제와 자동 장애 조치를 제공한다. **이 방식의 대기 인스턴스는 읽기 요청을 처리하지 않는다.**

### [RDS Multi-AZ DB 클러스터](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/multi-az-db-clusters-concepts.html)

(Relational Database Service / Multiple Availability Zones)

- **정의:** 서로 다른 세 가용 영역에 Writer 1개와 Reader 2개를 두는 RDS 배포 방식.
- **특징:** 반동기 복제를 사용하며 Reader는 읽기 요청을 처리한다. **단일 대기 인스턴스 방식과 구분**한다.

### [RDS Read Replica](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ReadRepl.html)

(Relational Database Service Read Replica)

- **정의:** 주 DB의 데이터를 복제해 읽기 부하를 나누는 복제본.
- **특징:** 일반적인 RDS 읽기 복제본은 비동기 복제라 지연이 생길 수 있다. **읽기 확장과 자동 장애 조치를 같은 기능으로 외우지 않는다.**

### [Amazon Aurora](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Concepts.AuroraHighAvailability.html)

- **정의:** MySQL·PostgreSQL 호환 관리형 관계형 데이터베이스.
- **특징:** 스토리지를 여러 가용 영역에 복제한다. DB 인스턴스의 신속한 장애 전환에는 다른 영역의 Aurora Replica 등 컴퓨팅 구성도 중요하다.

### [Amazon RDS Proxy](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html)

(Relational Database Service Proxy)

- **정의:** 애플리케이션과 지원 RDS·Aurora DB 사이에서 연결을 관리하는 프록시.
- **특징:** 연결 풀링으로 접속 부담을 줄이고 장애 전환을 지원한다. **쿼리 결과를 저장하는 캐시와는 다르다.**

### [DynamoDB Global Tables](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GlobalTables.html)

- **정의:** 여러 리전에서 사용할 DynamoDB 테이블을 복제·관리하는 기능.
- **특징:** 다중 리전 읽기·쓰기에 활용한다. 일관성 모드에 따라 동작이 다르므로 모든 구성을 비동기 복제로 단정하지 않는다.

### [RDS PITR](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIT.html)

(Relational Database Service / Point-in-Time Recovery)

- **정의:** 보존된 백업과 로그를 이용해 지정 시점의 데이터베이스 상태를 복원하는 기능.
- **특징:** 복구 가능 시간 범위 안에서 **새 DB 인스턴스**로 복원한다. 장애 조치처럼 기존 DB 연결이 즉시 전환되는 것은 아니다.

### [Amazon ElastiCache](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/WhatIs.corecomponents.html)

- **정의:** 관리형 인메모리 데이터 저장소·캐시 서비스.
- **특징:** 자주 읽는 데이터를 캐시해 DB 부하를 줄인다. 엔진·배포 방식별 복제·장애 전환과 캐시 유실 시 동작을 확인한다.

### [Amazon CloudFront · CDN](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html)

(Content Delivery Network)

- **정의:** 엣지 위치에서 콘텐츠를 전달하는 서비스.
- **특징:** 캐시 가능한 요청을 엣지에서 처리해 원본 부하를 줄인다. 캐시 미스와 동적 요청은 원본 장애의 영향을 받을 수 있다.

## 8. 재해 복구 목표와 전략

### [재해 복구 · DR](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/disaster-recovery-dr-objectives.html)

(Disaster Recovery)

- **정의:** 대규모 장애 뒤 워크로드와 데이터를 복구하기 위한 계획과 절차.
- **특징:** 복구 시간·데이터 손실 목표를 먼저 정한다. **복구 자원뿐 아니라 전환·검증·원복 절차도 필요**하다.

### [RTO](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/disaster-recovery-dr-objectives.html)

(Recovery Time Objective)

- **정의:** 서비스 중단부터 복구까지 허용할 수 있는 최대 시간 목표.
- **특징:** 예를 들어 RTO 1시간은 1시간 안에 서비스 복구를 목표로 한다는 뜻이다. 실제 충족 여부는 복구 훈련으로 확인한다.

### [RPO](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/disaster-recovery-dr-objectives.html)

(Recovery Point Objective)

- **정의:** 데이터 손실을 시간 기준으로 얼마나 허용할지 정한 복구 시점 목표.
- **특징:** 예를 들어 RPO 5분이면 장애 직전 최대 5분에 해당하는 데이터 손실을 허용하는 목표다. **복구 소요 시간과 구분**한다.

### [백업 및 복원](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html)

(Backup and Restore)

- **정의:** 백업을 보관하고 장애 시 인프라와 데이터를 복원하는 전략.
- **특징:** 상시 실행 자원은 적게 유지할 수 있다. 환경 구성·데이터 복원에 필요한 시간이 RTO에 들어간다.

### [파일럿 라이트](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html)

(Pilot Light)

- **정의:** 복구에 필요한 핵심 데이터·최소 구성 요소를 대기 환경에 유지하는 전략.
- **특징:** 장애 시 나머지 애플리케이션 자원을 기동·확장한다. **전체 서비스가 즉시 요청을 처리할 준비가 된 상태는 아니다.**

### [웜 스탠바이](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html)

(Warm Standby)

- **정의:** 축소된 규모로 동작 가능한 전체 시스템을 대기 환경에 유지하는 전략.
- **특징:** 장애 시 용량을 늘리고 트래픽을 전환한다. 핵심 부분만 유지하는 Pilot Light보다 더 많은 자원을 실행한다.

### [액티브-액티브 / 액티브-패시브](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-failover-types.html)

(Active-Active / Active-Passive)

- **정의:** 평소 여러 환경이 요청을 처리하는 구성과, 주 환경만 처리하고 보조 환경은 대기하는 구성.
- **특징:** 전환 시 남은 용량·데이터 일관성을 고려한다. **액티브-액티브도 데이터 손실과 복구 시간이 무조건 0인 것은 아니다.**

## 9. 실패 처리와 운영 자동화

### [타임아웃과 재시도](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)

(Timeout / Retry)

- **정의:** 응답 대기 시간을 제한하고 일시적인 실패에 다시 요청하는 방식.
- **특징:** 타임아웃이 나도 상대 작업은 완료됐을 수 있다. 모든 오류를 무제한 재시도하면 장애를 키울 수 있다.

### [지수 백오프와 지터](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)

(Exponential Backoff / Jitter)

- **정의:** 재시도 간격을 점점 늘리고 무작위 지연을 더하는 방식.
- **특징:** 많은 클라이언트의 재시도가 한꺼번에 몰리는 현상을 줄인다. 최대 간격·횟수와 전체 시간 예산을 함께 정한다.

### [멱등성](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_prevent_interaction_failure_idempotent.html)

(Idempotence)

- **정의:** 동일한 요청을 여러 번 실행해도 한 번 실행한 것과 같은 효과를 내는 성질.
- **특징:** 주문·결제처럼 부작용이 있는 처리에 요청 식별자와 중복 방지 로직을 적용한다. 큐 중복 전달과 재시도에 대비한다.

### [Service Quotas](https://docs.aws.amazon.com/servicequotas/latest/userguide/intro.html)

- **정의:** AWS 서비스의 자원·요청 등 사용 한도를 확인·관리하는 서비스.
- **특징:** 확장 가능한 한도는 증가를 요청한다. **재해 복구 대상 리전의 한도도 미리 확인**해야 전환 시 필요한 용량을 만들 수 있다.

### [스로틀링](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-request-throttling.html)

(Throttling)

- **정의:** 과도한 요청으로 시스템이 압도되지 않도록 요청 처리를 제한하는 방식.
- **특징:** API Gateway는 초과 요청에 429 응답을 줄 수 있다. 클라이언트는 속도 제한과 백오프로 대응한다.

### [Amazon CloudWatch](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/WhatIsCloudWatch.html)

- **정의:** AWS 자원과 애플리케이션의 지표·로그 등을 관찰하는 서비스.
- **특징:** 경보로 이상을 감지하고 대응 작업에 연결한다. 자원 사용률뿐 아니라 지연·오류율·큐 적체 같은 서비스 지표도 본다.

### [AWS X-Ray](https://docs.aws.amazon.com/xray/latest/devguide/aws-xray.html)

- **정의:** 요청이 여러 서비스와 자원을 거치는 경로를 추적·분석하는 서비스.
- **특징:** 분산 추적으로 지연과 오류가 발생한 구간을 찾는다. 필요한 계측과 추적 데이터 수집을 구성해야 한다.

### [AWS CloudFormation · IaC](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/Welcome.html)

(Infrastructure as Code)

- **정의:** 템플릿으로 AWS 자원을 정의하고 생성·변경하는 서비스.
- **특징:** 같은 정의로 환경을 재현해 수작업 차이를 줄인다. **인프라 템플릿이 애플리케이션 데이터 백업을 대신하지는 않는다.**

### [불변 인프라](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_tracking_change_management_immutable_infrastructure.html)

(Immutable Infrastructure)

- **정의:** 실행 중인 자원을 직접 수정하기보다 새 구성의 자원으로 교체하는 배포 방식.
- **특징:** 같은 구성으로 재현하고 이전 버전으로 되돌리기 쉽다. 애플리케이션 상태와 데이터는 교체 자원 밖에 보존하도록 설계한다.

## 10. 목적에 맞는 관리형 서비스

### [AWS Transfer Family](https://docs.aws.amazon.com/transfer/latest/userguide/what-is-aws-transfer-family.html)

- **정의:** 파일 전송을 위한 관리형 엔드포인트와 연계 기능을 제공하는 서비스.
- **특징:** 기존 파일 전송 클라이언트를 AWS 저장소와 연결할 때 활용한다. 서버를 직접 구성할 때의 운영 부담을 줄인다.

### [Amazon Comprehend](https://docs.aws.amazon.com/comprehend/latest/dg/what-is.html)

- **정의:** 텍스트에서 개체·감정 등 정보를 분석하는 자연어 처리 서비스.
- **특징:** 텍스트 분석 기능을 직접 구축하는 대신 호출해 사용한다. 처리 모드와 언어·기능별 지원 범위를 확인한다.

### [Amazon Polly](https://docs.aws.amazon.com/polly/latest/dg/what-is.html)

- **정의:** 텍스트를 음성으로 변환하는 서비스.
- **특징:** 음성 합성을 관리형 기능으로 사용한다. 장애 복구 서비스가 아니라 **목적에 맞는 관리형 기능 선택**의 예다.

### [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html)

- **정의:** 애플리케이션의 비밀 정보를 저장·조회·교체하는 서비스.
- **특징:** 자격 증명을 코드와 분리한다. 교체·조회 실패가 서비스 전체 중단으로 이어지지 않도록 오류 처리와 의존성을 설계한다.

## 헷갈리는 항목 비교

| 비교 | 구분 기준 |
| --- | --- |
| 고가용성 / 재해 복구 | **서비스 중단 최소화** / **대규모 장애 후 복구 목표와 절차** |
| 가용성 / 내구성 | **지금 사용할 수 있는가** / **데이터가 보존되는가** |
| 수평 확장 / 수직 확장 | **자원 개수 증가** / **단일 자원의 용량 증가** |
| ELB / Auto Scaling | **요청 분산** / **인스턴스 용량 유지·조절** |
| SQS / SNS / EventBridge | **큐에서 가져가 처리** / **구독자에게 발행** / **이벤트 조건에 따라 연결·전달** |
| SQS Standard / FIFO | **중복·순서 변경 가능** / **그룹별 순서·중복 제거 기능** |
| ECS·EKS / Fargate | **컨테이너 실행 관리** / **서버 관리 없이 실행할 컴퓨팅 제공** |
| S3 / EBS / EFS | **객체** / **블록** / **공유 파일** 스토리지 |
| RDS Multi-AZ / Read Replica | **장애 대응 중심** / **읽기 부하 분산 중심**. Multi-AZ DB 클러스터는 읽기도 지원 |
| RDS Proxy / ElastiCache | **DB 연결 관리** / **캐시로 반복 읽기 감소** |
| 복제 / 백업 | **다른 곳에 데이터 반영** / **복구할 시점의 데이터 보존**. 복제만으로 과거 복구를 보장하지 않음 |
| RTO / RPO | **얼마나 빨리 복구할 것인가** / **얼마 전까지의 데이터를 복구할 것인가** |
| Pilot Light / Warm Standby | **핵심 부분만 실행** / **축소된 전체 시스템 실행** |
| CloudWatch / X-Ray | **지표·로그·경보** / **요청 경로의 분산 추적** |
