---
title: "AWS SAA 공부 2편: 보안 영역 핵심 서비스와 개념 정리"
date: 2026-11-17T15:19:51+09:00
draft: false
description: "SAA-C03 보안 영역의 서비스와 개념 54개를 정의·특징 목록으로 정리한다. 약어의 풀네임과 함께 접근 제어, 네트워크, 위협 탐지, 암호화, 데이터 보존·복구를 살펴본다."
slug: "aws-saa-2"
categories: ["Cloud"]
tags: ["Cloud", "AWS", "Security", "Certification"]
series: "AWS SAA 공부"
seriesOrder: 2
---

- **영역:** 보안 아키텍처 설계 — 출제 비중 **30%**
- **구성:** 9개 묶음 · 54개 서비스·개념 · 항목별 **정의 + 특징**
- **표기:** 약어의 풀네임·영문 명칭은 항목명 아래 괄호로 표시. AWS는 Amazon Web Services.
- **기준:** 2026년 11월 17일. [공식 보안 영역](https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03-domain1.html)의 접근 제어·워크로드 보호·데이터 보안과 관련 개념을 정리한 학습 목록.
- **이전 글:** [SAA 자격증 개요와 공부 방향](/posts/aws-saa-1/)

## 1. 보안 원칙과 인프라 경계

### [공동 책임 모델](https://aws.amazon.com/compliance/shared-responsibility-model/)

(Shared Responsibility Model)

- **정의:** AWS와 고객이 클라우드 보안 책임을 나누는 모델.
- **특징:** AWS는 물리 인프라 등을, 고객은 데이터와 접근 설정 등을 담당한다. 고객의 관리 범위는 사용하는 서비스에 따라 달라진다.

### [최소 권한 원칙](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)

(Principle of Least Privilege)

- **정의:** 업무에 필요한 대상과 작업에만 권한을 부여하는 원칙.
- **특징:** 대상 리소스·작업·조건을 좁혀 허용한다. 사용하지 않는 권한은 제거한다.

### [MFA](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)

(Multi-factor Authentication)

- **정의:** 서로 다른 인증 요소를 조합해 신원을 확인하는 다중 요소 인증.
- **특징:** 암호 외의 추가 요소로 계정을 보호한다. MFA 인증 자체가 리소스 접근 권한을 부여하지는 않는다.

### [리전](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html)

(Region)

- **정의:** AWS가 인프라를 운영하는 독립된 지리적 영역.
- **특징:** 사용자와의 거리, 서비스 지원 여부, 데이터 위치 요구사항을 고려해 선택한다. 리전 간 리소스는 자동 복제되지 않는다.

### [가용 영역 · AZ](https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html)

(Availability Zone)

- **정의:** 리전 안에서 장애를 격리하도록 분리된 인프라 영역.
- **특징:** 여러 가용 영역에 자원을 분산해 단일 영역 장애에 대비한다. 하나의 서브넷은 하나의 가용 영역에 속한다.

## 2. 사용자·역할·접근 정책

### [AWS IAM](https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html)

(Identity and Access Management)

- **정의:** AWS 리소스에 누가 접근하고 무엇을 할 수 있는지 관리하는 서비스.
- **특징:** 사용자·그룹·역할과 정책으로 접근을 제어한다. 루트 사용자는 일상적인 작업에 사용하지 않는다.

### [루트 사용자](https://docs.aws.amazon.com/IAM/latest/UserGuide/id.html)

(Root User)

- **정의:** AWS 계정 생성 시 만들어지는 계정의 최상위 사용자.
- **특징:** 일상 작업에는 사용하지 않고 보호한다. IAM 사용자에게 관리자 권한을 줬다고 루트 사용자가 되는 것은 아니다.

### [IAM User](https://docs.aws.amazon.com/IAM/latest/UserGuide/id.html)

(Identity and Access Management User)

- **정의:** AWS 계정 안에 생성하는 개별 사용자 자격 증명.
- **특징:** 암호·장기 액세스 키를 가질 수 있다. 사람의 접근에는 연동 로그인과 임시 자격 증명을 우선 검토한다.

### [IAM User Group](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_groups.html)

(Identity and Access Management User Group)

- **정의:** 여러 IAM 사용자에게 공통 권한을 부여하기 위한 그룹.
- **특징:** 정책을 그룹에 연결하면 소속 사용자에게 적용된다. **역할은 그룹의 구성원이 될 수 없다.**

### [IAM Role](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html)

(Identity and Access Management Role)

- **정의:** 허용된 주체가 맡아 사용할 수 있도록 권한을 정의한 IAM 역할.
- **특징:** 역할을 맡으면 **임시 보안 자격 증명**을 사용한다. 역할 자체에는 장기 암호나 액세스 키가 없다.

### [IAM Policy](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html)

(Identity and Access Management Policy)

- **정의:** AWS 요청의 허용·거부 조건을 정의하는 정책.
- **특징:** 사용자·역할 등에 연결하는 정책과 리소스에 연결하는 정책이 있다. **명시적 Deny는 Allow보다 우선**한다.

### [신뢰 정책](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html)

(Trust Policy)

- **정의:** 누가 IAM 역할을 맡을 수 있는지 정의하는 정책.
- **특징:** **누가 역할을 맡는가**를 결정한다. 역할을 맡은 뒤 할 수 있는 작업은 권한 정책으로 정한다.

### [리소스 기반 정책](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html)

(Resource-based Policy)

- **정의:** 버킷 등 리소스 자체에 연결하는 접근 정책.
- **특징:** Principal로 허용·거부 대상 주체를 지정한다. S3 버킷 정책과 KMS 키 정책이 대표적이다.

### [권한 경계](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_boundaries.html)

(Permissions Boundary)

- **정의:** 자격 증명 기반 정책이 IAM 사용자·역할에 부여할 수 있는 최대 권한을 제한하는 장치.
- **특징:** **경계 자체는 권한을 부여하지 않는다.** 리소스 기반 정책까지 포함한 최종 권한은 정책 종류와 주체에 따라 평가한다.

## 3. 임시 자격 증명과 로그인 연동

### [AWS STS](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp.html)

(Security Token Service)

- **정의:** 유효기간이 있는 임시 보안 자격 증명을 발급하는 서비스.
- **특징:** 역할 수임과 연동 접근에 사용한다. 만료 후에는 유효한 새 자격 증명이 필요하다.

### [교차 계정 접근](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html)

(Cross-account Access)

- **정의:** 한 AWS 계정의 주체가 다른 계정의 리소스에 접근하는 방식.
- **특징:** 대표 방식은 대상 계정 역할을 맡는 것이다. **호출 측의 권한과 대상 역할의 신뢰 정책**을 함께 구성한다.

### [자격 증명 연동](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers.html)

(Identity Federation)

- **정의:** 기존 외부 인증 체계의 사용자·워크로드가 AWS에 접근하도록 연결하는 방식.
- **특징:** SAML(Security Assertion Markup Language)·OIDC(OpenID Connect) 등을 활용한다. 사용자마다 장기 AWS 키를 배포하는 부담을 줄인다.

### [AWS IAM Identity Center](https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html)

(Identity and Access Management Identity Center)

- **정의:** 직원의 AWS 계정과 애플리케이션 접근을 중앙에서 관리하는 서비스.
- **특징:** 기존 외부 자격 증명 공급자와 연결하거나 자체 사용자를 관리한다. 여러 계정의 직원 접근을 한곳에서 관리할 때 사용한다.

### [Amazon Cognito](https://docs.aws.amazon.com/cognito/latest/developerguide/what-is-amazon-cognito.html)

- **정의:** 웹·모바일 애플리케이션 사용자의 인증과 접근을 지원하는 서비스.
- **특징:** **User Pool:** 사용자 인증·토큰 발급. **Identity Pool:** AWS 리소스 접근용 임시 자격 증명 제공.

## 4. 여러 계정의 보안 관리

### [AWS Organizations](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_introduction.html)

- **정의:** 여러 AWS 계정을 묶어 중앙에서 관리하는 서비스.
- **특징:** 계정을 그룹화하고 조직 정책을 적용한다. 통합 결제도 지원한다.

### [OU](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_getting-started_concepts.html)

(Organizational Unit)

- **정의:** AWS Organizations에서 계정을 계층적으로 묶는 조직 단위.
- **특징:** 팀·환경별로 계정을 분류하고 정책을 적용한다. IAM 사용자를 묶는 그룹과 구분한다.

### [SCP](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html)

(Service Control Policy)

- **정의:** 조직 내 적용 대상 계정의 IAM 주체가 사용할 수 있는 권한의 상한을 제한하는 정책.
- **특징:** **SCP 자체는 권한을 부여하지 않는다.** 실제 허용에는 IAM 정책 등이 필요하며, 관리 계정에는 SCP가 적용되지 않는다.

### [AWS Control Tower](https://docs.aws.amazon.com/controltower/latest/userguide/what-is-control-tower.html)

- **정의:** 여러 AWS 계정의 표준 환경을 구성하고 거버넌스를 적용하는 서비스.
- **특징:** Organizations 등을 조합해 랜딩 존을 구성한다. 계정 생성과 공통 통제 적용을 표준화한다.

## 5. 네트워크 분리와 비공개 연결

### [Amazon VPC](https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html)

(Virtual Private Cloud)

- **정의:** AWS 안에서 정의하는 논리적으로 격리된 가상 네트워크.
- **특징:** 주소 범위·서브넷·라우팅 등을 구성한다. 네트워크 연결 가능 여부와 IAM 권한은 별도로 판단한다.

### [퍼블릭·프라이빗 서브넷](https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html)

(Public / Private Subnet)

- **정의:** VPC 주소 범위를 나누어 리소스를 배치하는 네트워크 구획.
- **특징:** 퍼블릭은 인터넷 게이트웨이로 직접 연결되는 경로가 있고 프라이빗은 없다. **퍼블릭 서브넷에 배치했다고 모든 리소스가 인터넷에 공개되지는 않는다.**

### [라우팅 테이블](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html)

(Route Table)

- **정의:** 목적지별로 트래픽을 어디에 보낼지 정하는 경로 목록.
- **특징:** 목적지 주소와 전달 대상을 연결한다. 경로가 있어도 보안 그룹·ACL에서 통신을 막을 수 있다.

### [보안 그룹 · SG](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html)

(Security Group)

- **정의:** 연결된 리소스의 인바운드·아웃바운드 트래픽을 제어하는 가상 방화벽.
- **특징:** **허용 규칙만 지원 · 상태 저장(Stateful).** 허용된 통신의 응답 트래픽은 반대 방향 규칙과 관계없이 허용한다.

### [네트워크 ACL · NACL](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-network-acls.html)

(Network Access Control List)

- **정의:** 서브넷 경계를 드나드는 트래픽을 허용하거나 거부하는 제어 목록.
- **특징:** **허용·거부 규칙 지원 · 상태 비저장(Stateless).** 응답 트래픽도 별도로 허용해야 하며, 낮은 번호의 규칙부터 평가한다.

### [NAT Gateway](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html)

(Network Address Translation Gateway)

- **정의:** 네트워크 주소 변환을 제공하는 관리형 게이트웨이.
- **특징:** 퍼블릭 NAT는 프라이빗 서브넷의 인터넷 발신 통신에 사용한다. **외부에서 먼저 시작하는 연결을 허용하는 장치가 아니다.**

### [VPC Endpoint](https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html)

(Virtual Private Cloud Endpoint)

- **정의:** 인터넷 게이트웨이나 NAT 없이 지원 서비스 등에 비공개로 연결하는 접점.
- **특징:** 게이트웨이 엔드포인트는 S3·DynamoDB 연결에 사용한다. 인터페이스 엔드포인트와 구현·지원 대상을 구분한다.

### [AWS PrivateLink](https://docs.aws.amazon.com/vpc/latest/privatelink/concepts.html)

- **정의:** 프라이빗 주소를 통해 다른 VPC의 서비스·리소스 등에 연결하는 기술.
- **특징:** 인터페이스 엔드포인트 등에 사용한다. **게이트웨이 엔드포인트는 PrivateLink를 사용하지 않는다.**

### [AWS Site-to-Site VPN](https://docs.aws.amazon.com/vpn/latest/s2svpn/VPC_VPN.html)

(Virtual Private Network)

- **정의:** AWS와 온프레미스 네트워크 사이에 암호화 터널을 구성하는 서비스.
- **특징:** IPsec(Internet Protocol Security)을 사용한다. 인터넷을 통한 연결에도 트래픽 암호화를 적용할 수 있다.

### [AWS Direct Connect](https://docs.aws.amazon.com/directconnect/latest/UserGuide/encryption-in-transit.html)

- **정의:** 온프레미스와 AWS 사이에 전용 네트워크 연결을 제공하는 서비스.
- **특징:** **전용 연결 자체가 기본 암호화를 의미하지 않는다.** VPN 결합이나 지원 연결의 MACsec(Media Access Control Security) 등을 검토한다.

## 6. 웹 공격 방어와 위협 탐지

### [AWS WAF](https://docs.aws.amazon.com/waf/latest/developerguide/what-is-aws-waf.html)

(Web Application Firewall)

- **정의:** 웹 애플리케이션으로 전달되는 HTTP·HTTPS 요청을 검사하는 방화벽.
- **특징:** CloudFront·ALB(Application Load Balancer) 등 지원 리소스에 적용한다. 웹 요청 조건에 따라 차단하며, [SQL 삽입 공격 탐지 규칙](https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-type-sqli-match.html)도 구성할 수 있다.

### [AWS Shield](https://docs.aws.amazon.com/waf/latest/developerguide/shield-chapter.html)

- **정의:** DDoS(Distributed Denial of Service, 분산 서비스 거부) 공격 대응을 위한 보호 서비스.
- **특징:** 공통 대량 트래픽 공격에 대한 기본 보호가 제공된다. Shield Advanced는 추가 탐지·완화·대응 기능을 제공한다.

### [Amazon GuardDuty](https://docs.aws.amazon.com/guardduty/latest/ug/what-is-guardduty.html)

- **정의:** AWS 로그와 데이터 소스를 분석해 의심스러운 활동을 탐지하는 서비스.
- **특징:** 자격 증명 악용·비정상 활동 등을 탐지 결과로 알린다. 탐지 결과에 대한 대응·차단은 별도로 설계한다.

### [Amazon Macie](https://docs.aws.amazon.com/macie/latest/user/what-is-macie.html)

- **정의:** Amazon S3의 민감 데이터를 발견하고 데이터 보안 위험을 파악하는 서비스.
- **특징:** 패턴 매칭·기계 학습으로 민감 정보를 탐색한다. 데이터를 자동으로 암호화하는 서비스와는 역할이 다르다.

## 7. 암호화·인증서·비밀 정보

### [저장 데이터 암호화](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingEncryption.html)

(Encryption at Rest)

- **정의:** 디스크·객체 저장소 등에 보관된 데이터를 암호화하는 방식.
- **특징:** S3 등의 저장 데이터 보호에 사용한다. 데이터 접근 권한과 암호화 키 접근 권한을 함께 설계한다.

### [TLS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingEncryption.html)

(Transport Layer Security)

- **정의:** 네트워크로 전달되는 데이터의 기밀성·무결성 등을 보호하는 프로토콜.
- **특징:** HTTPS(Hypertext Transfer Protocol Secure)는 TLS로 HTTP 통신을 보호한다. **저장 데이터 암호화와 별도로 적용**한다.

### [AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html)

(Key Management Service)

- **정의:** 데이터 암호화와 서명에 사용하는 키를 생성·관리하는 서비스.
- **특징:** 키 정책 등으로 키 접근을 제어한다. **암호화 키 관리**가 중심이다.

### [KMS 키 정책](https://docs.aws.amazon.com/kms/latest/developerguide/key-policies.html)

(Key Management Service Key Policy)

- **정의:** KMS 키의 사용·관리를 허용하는 주체와 조건을 정하는 리소스 정책.
- **특징:** 키 정책이 IAM 정책 사용을 허용하지 않으면 IAM의 Allow만으로 키 사용 권한을 부여할 수 없다.

### [KMS 키 교체](https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html)

(Key Rotation)

- **정의:** 암호화에 쓰는 키 재료를 새 것으로 교체하는 작업.
- **특징:** 지원되는 키의 자동 교체는 기존 키 식별자를 유지한다. **기존 데이터를 자동 재암호화하는 작업은 아니다.**

### [AWS ACM](https://docs.aws.amazon.com/acm/latest/userguide/acm-overview.html)

(AWS Certificate Manager)

- **정의:** 웹사이트·애플리케이션의 인증서를 발급·관리하는 서비스.
- **특징:** 인증서로 TLS 연결을 구성한다. 관리형 갱신의 지원 조건을 확인하며, 가져온 인증서는 [ACM 관리형 갱신 대상이 아니다](https://docs.aws.amazon.com/acm/latest/userguide/managed-renewal.html).

### [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html)

- **정의:** DB 접속 정보·API 키 같은 비밀 정보를 저장·조회·교체하는 서비스.
- **특징:** 코드에 비밀값을 넣는 대신 실행 중 조회한다. **자동 교체(Rotation)를 구성**할 수 있다.

### [Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html)

(AWS Systems Manager Parameter Store)

- **정의:** 애플리케이션 설정값을 이름별로 저장·조회하는 Systems Manager 기능.
- **특징:** String·StringList·SecureString을 지원한다. 비밀 정보의 자동 교체가 필요하면 Secrets Manager를 검토한다.

## 8. 데이터 보존과 복구

### [데이터 분류](https://docs.aws.amazon.com/macie/latest/user/what-is-macie.html)

(Data Classification)

- **정의:** 민감도와 용도에 따라 데이터의 보호 수준을 나누는 작업.
- **특징:** 개인정보·공개 데이터 등을 구분해 접근·암호화·보존 정책을 정한다. Macie의 민감 데이터 탐색 결과를 분류에 활용할 수 있다.

### [S3 Block Public Access](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html)

(Simple Storage Service Block Public Access)

- **정의:** S3 리소스의 공개 접근을 제한하는 설정.
- **특징:** 계정·버킷 등의 설정으로 의도하지 않은 공개를 막는다. **공개 차단이 모든 접근을 막는다는 뜻은 아니다.**

### [S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html)

(Simple Storage Service Versioning)

- **정의:** 같은 객체의 여러 버전을 유지하는 기능.
- **특징:** 실수로 덮어쓰거나 삭제한 데이터를 복구하는 데 활용한다. 특정 버전의 영구 삭제까지 자동으로 막지는 않는다.

### [S3 Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html)

(Simple Storage Service Object Lock)

- **정의:** 객체 버전이 삭제·덮어쓰기되지 않도록 보존하는 기능.
- **특징:** WORM(Write Once, Read Many) 모델을 사용한다. 보존 기간·법적 보존과 모드에 따른 해제 조건을 구분한다.

### [S3 Lifecycle](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html)

(Simple Storage Service Lifecycle)

- **정의:** 규칙에 따라 객체의 저장 클래스를 전환하거나 만료된 객체를 삭제하는 기능.
- **특징:** 보관 기간·비용 정책에 활용한다. **삭제를 방지하는 Object Lock과 구분**한다.

### [S3 Replication](https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication.html)

(Simple Storage Service Replication)

- **정의:** S3 버킷 사이에 객체를 비동기로 복제하는 기능.
- **특징:** 같은 리전·다른 리전 복제를 지원한다. 기존 객체는 실시간 복제 설정만으로 소급 복제되지 않으므로 Batch Replication 등을 검토한다.

### [AWS Backup](https://docs.aws.amazon.com/aws-backup/latest/devguide/whatisbackup.html)

- **정의:** 지원 리소스의 백업 정책과 작업을 중앙에서 관리하는 서비스.
- **특징:** 백업 일정·보존을 자동화한다. AWS Backup 밖에서 생성한 모든 백업을 자동 통제하는 것은 아니다.

## 9. 감사와 구성 추적

### [AWS CloudTrail](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-user-guide.html)

- **정의:** 사용자·역할·AWS 서비스의 작업을 이벤트로 기록하는 서비스.
- **특징:** **누가 어떤 작업을 했는가**를 추적한다. 관리 이벤트와 데이터 이벤트의 수집 범위·설정을 구분한다.

### [AWS Config](https://docs.aws.amazon.com/config/latest/developerguide/WhatIsConfig.html)

- **정의:** AWS 리소스의 구성과 변경 이력을 기록·평가하는 서비스.
- **특징:** **리소스 설정이 어떻게 바뀌었는가**를 추적한다. 규칙으로 원하는 구성 준수 여부를 평가할 수 있다.

## 헷갈리는 항목 비교

| 비교 | 구분 기준 |
| --- | --- |
| 신뢰 정책 / 권한 정책 | **누가 역할을 맡는가** / **맡은 뒤 무엇을 하는가** |
| SCP / 권한 경계 | **조직·계정 단위 제한** / **개별 IAM 사용자·역할의 자격 증명 기반 권한 제한** |
| IAM Identity Center / Cognito | **직원의 AWS 계정·앱 접근** / **웹·모바일 앱 사용자의 인증·접근** |
| 보안 그룹 / 네트워크 ACL | **리소스에 연결·상태 저장** / **서브넷 경계·상태 비저장** |
| WAF / Shield | **웹 요청 조건 검사** / **DDoS 방어** |
| GuardDuty / Macie | **의심스러운 활동 탐지** / **S3 민감 데이터 탐색** |
| KMS / ACM / Secrets Manager | **암호화 키** / **인증서** / **비밀값** 관리 |
| Versioning / Object Lock / Lifecycle | **이전 버전 유지** / **객체 버전 보존** / **저장 클래스 전환·만료 삭제** |
| CloudTrail / Config | **작업 이력** / **리소스 구성·변경 이력** |
