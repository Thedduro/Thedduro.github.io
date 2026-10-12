---
title: "AWS 자격증 총정리: 종류와 난이도, 시험 방법부터 실제 후기까지"
date: 2026-10-12T09:00:00+09:00
draft: true
description: "AWS 자격증을 직무별로 비교하고 시험 코드·비용·난이도·응시 절차·준비 방법을 정리한다. 국내외 응시 후기와 2026년 시험 개정·종료 일정, 재응시와 갱신 정책도 함께 다룬다."
slug: "aws-certification-guide"
categories: ["Cloud"]
tags: ["Cloud", "AWS", "Certification"]
---

AWS 자격증을 찾아보면 CLF, SAA, DVA, SAP 같은 약어부터 마주친다. 무엇부터 따야 하는지 알아보려는데, 어떤 글은 2주면 된다고 하고 어떤 글은 몇 달이 걸렸다고 한다. 예전 글에서 추천하던 시험이 이미 종료된 경우도 있다.

**클라우드 자체가 처음이라면 Cloud Practitioner, AWS의 전체 구조를 공부하려는 개발자라면 Solutions Architect – Associate부터 검토하면 된다.** 이미 목표 직무가 뚜렷하다면 개발·운영·데이터·ML에 맞는 Associate를 바로 선택하는 편이 효율적일 수 있다. 모든 자격증을 낮은 등급부터 순서대로 취득할 필요는 없다.

이 글은 **2026년 10월 12일 확인한 시험 안내와 정책**을 기준으로 한다. 종류와 시험 방법은 공식 자료를, 준비 기간과 체감 난이도는 출처가 있는 개인 후기를 바탕으로 정리했다. 직접 응시한 경험담은 아니며, 아래의 선택 기준은 시험 범위와 후기에서 도출한 제안이다.

## AWS 자격증은 무엇을 증명할까

AWS Certification은 해당 시험이 평가하는 지식과 판단 능력을 검증하는 자격이다. 강의를 끝내고 받는 수료증과는 다르다. 예를 들어 SAA는 요구 사항에 맞는 AWS 아키텍처를 설계하는 판단을 평가한다. 시험에 합격했다고 곧바로 운영 장애를 해결하거나 대규모 시스템을 구축할 수 있다는 뜻까지 포함하지는 않는다. [SAA 시험 가이드](https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03.html)

자격증 공부의 실용적인 장점은 평소 쓰는 서비스 밖으로 학습 범위를 넓힐 수 있다는 점이다. EC2와 S3만 사용하던 개발자가 네트워크, 권한, 장애 복구, 비용까지 함께 생각해 보는 계기가 된다. 이력서에서는 지식의 범위를 설명하는 근거로 쓰고, 실제 설계·구현 경험은 프로젝트로 보여주는 구성이 좋다. 취업이나 연봉 상승을 자격증 하나의 효과로 단정하기는 어렵다.

## 종류를 먼저 한눈에 보기

기술 자격은 Foundational, Associate, Professional, Specialty로 나뉜다. 여기에 AI 투자와 조직 도입 판단을 평가하는 **Business** 분류가 추가됐다. Specialty를 Professional 다음에 반드시 밟아야 하는 최상위 단계로 해석하면 곤란하다. 기술 영역을 좁혀 깊게 평가하는 별도 분류에 가깝다. [시험 가이드 목록](https://docs.aws.amazon.com/aws-certification/latest/examguides/)

표의 이름에는 공통으로 `AWS Certified`가 붙는다. 비용은 USD 기준 기본 응시료이며, 세금·결제 통화·환율 적용에 따라 최종 결제액은 달라질 수 있다. 베타는 일반 시험과 구분했다.

### Foundational: 클라우드와 AI의 기초

| 자격증 / 시험 코드 | 주로 다루는 내용 | 문항 / 시간 | 기본 응시료 |
| --- | --- | --- | --- |
| [Cloud Practitioner](https://aws.amazon.com/certification/certified-cloud-practitioner/) / CLF-C02 | 클라우드 개념, 핵심 서비스, 보안 책임, 과금 | 65문항 / 90분 | $100 |
| [AI Practitioner](https://aws.amazon.com/certification/certified-ai-practitioner/) / AIF-C01 | AI·ML·생성형 AI 개념, 활용 사례, 책임 있는 AI | 65문항 / 90분 | $100 |

CLF는 AWS 전반의 용어와 서비스 역할을 익히는 입구다. AIF는 AI를 어디에 어떻게 활용하고 무엇을 주의해야 하는지에 초점이 있다. AIF가 CLF의 상위 시험이거나, 둘 다 통과해야 Associate로 갈 수 있는 구조는 아니다.

### Associate: 맡으려는 일을 기준으로 고르기

| 자격증 / 시험 코드 | 주로 다루는 내용 | 문항 / 시간 | 기본 응시료 |
| --- | --- | --- | --- |
| [Solutions Architect – Associate](https://aws.amazon.com/certification/certified-solutions-architect-associate/) / SAA-C03 | 보안·복원력·성능·비용을 고려한 설계 | 65문항 / 130분 | $150 |
| [Developer – Associate](https://aws.amazon.com/certification/certified-developer-associate/) / DVA-C02 | AWS 애플리케이션 개발·배포·디버깅 | 65문항 / 130분 | $150 |
| [CloudOps Engineer – Associate](https://aws.amazon.com/certification/certified-cloudops-engineer-associate/) / SOA-C03 | 모니터링, 운영, 복구, 네트워크와 비용 관리 | 65문항 / 130분 | $150 |
| [Data Engineer – Associate](https://aws.amazon.com/certification/certified-data-engineer-associate/) / DEA-C01 | 데이터 수집·변환·저장, 파이프라인 운영과 품질 | 65문항 / 130분 | $150 |
| [Machine Learning Engineer – Associate](https://aws.amazon.com/certification/certified-machine-learning-engineer-associate/) / MLA-C01 | ML 솔루션 구현·배포·운영 | 65문항 / 130분 | $150 |
| Machine Learning Engineer – Associate / MLA-C02 **베타** | 개정된 ML·생성형 AI 구현과 운영 범위 | 85문항 / 170분 | $75 |

마지막 두 행은 서로 다른 자격증이 아니라 **동일 자격증의 시험 버전**이다. 현재 MLA-C02 베타는 영어로 제공되고, MLA-C01은 베타 기간에 한국어·일본어·중국어 간체로 계속 제공된다. 영어 MLA-C01은 2026년 9월 28일이 마지막 응시일이었다. [MLA 개정 안내](https://aws.amazon.com/blogs/training-and-certification/september-2026-new-offerings/)

SAA와 DVA는 겹치는 서비스가 있어도 질문의 관점이 다르다. SAA를 공부할 때는 요구 사항을 만족하는 구성을 비교하고, DVA에서는 애플리케이션이 AWS 서비스를 호출하고 배포되는 과정에 더 집중한다. 데이터 엔지니어라면 DEA가 업무와 직접 맞닿지만, 네트워크와 권한이 낯설다면 그 기초를 먼저 보완하는 편이 좋다.

### Professional과 Specialty: 넓은 설계 또는 특정 분야의 깊이

| 분류 | 자격증 / 시험 코드 | 주로 다루는 내용 | 문항 / 시간 / 기본 응시료 |
| --- | --- | --- | --- |
| Professional | [Solutions Architect – Professional](https://aws.amazon.com/certification/certified-solutions-architect-professional/) / SAP-C02 | 복잡한 조직의 아키텍처, 마이그레이션과 개선 | 75문항 / 180분 / $300 |
| Professional | [DevOps Engineer – Professional](https://aws.amazon.com/certification/certified-devops-engineer-professional/) / DOP-C02 | 배포 자동화, 운영, 모니터링과 장애 대응 | 75문항 / 180분 / $300 |
| Professional | [Generative AI Developer – Professional](https://aws.amazon.com/certification/certified-generative-ai-developer-professional/) / AIP-C01 | 운영 환경에 사용할 생성형 AI 솔루션의 구현·배포 | 75문항 / 180분 / $300 |
| Specialty | [Security – Specialty](https://aws.amazon.com/certification/certified-security-specialty/) / SCS-C03 | AWS 보안, 접근 제어, 데이터 보호와 대응 | 65문항 / 170분 / $300 |
| Specialty | [Advanced Networking – Specialty](https://aws.amazon.com/certification/certified-advanced-networking-specialty/) / ANS-C01 | 복잡한 클라우드·하이브리드 네트워크 | 65문항 / 170분 / $300 |

ANS는 종료 일정 확인이 필요하다. 확인 시점의 **영문 안내는 마지막 응시일을 2026년 12월 31일로 명시**하지만, [일본어 안내](https://aws.amazon.com/jp/certification/certified-advanced-networking-specialty/)에는 8월 25일이 남아 있어 서로 다르다. 여기서는 영문 안내를 기준으로 소개하되, 준비를 시작하기 전 AWS 지원과 실제 예약 화면에서 응시 가능 여부를 확인하는 편이 안전하다. 시험 종료 전에 취득한 자격의 유효기간은 별도로 유지된다.

AIP는 AI 기초 시험인 AIF와 차이가 크다. 대상자는 일반적인 애플리케이션 개발 경험에 더해 생성형 AI 구현 경험을 갖춘 사람이다. 단순히 프롬프트를 잘 작성하는지만 평가하는 자격으로 생각하면 준비 범위를 놓치게 된다. [AIP 대상 응시자](https://aws.amazon.com/certification/certified-generative-ai-developer-professional/)

### Business: AI를 도입하는 의사결정

[AI Business Strategist](https://aws.amazon.com/certification/certified-ai-business-strategist/)의 시험 코드는 AIB-C01이다. 확인 시점에는 **85문항·170분·$50의 베타 시험**이며 영어와 일본어로 제공된다. 안내된 일반 시험 가격은 $100이다.

AI 투자 기회를 평가하고, 도입의 비용과 효과를 설명하고, 거버넌스와 조직 확산을 판단하는 역할에 맞는다. AWS 서비스 구현이나 코딩 경험을 요구하는 시험은 아니다. AI 용어와 AWS AI 서비스의 기초를 다루는 AIF와 목적이 다르므로, 기술 자격의 난이도 표에 억지로 끼워 넣기보다는 업무 역할로 선택하는 것이 낫다.

## 예전 글을 읽을 때 주의할 시험 변경

교재 제목에 AWS가 적혀 있다는 것만으로 현재 시험에 맞는 자료라고 볼 수 없다. **자격증 이름, 시험 코드, 응시 언어**를 함께 비교해야 한다.

| 변경 대상 | 확인해야 할 일정과 의미 |
| --- | --- |
| SysOps Administrator – Associate | SOA-C02의 마지막 응시일은 2025년 9월 29일. 다음 날 CloudOps Engineer – Associate, SOA-C03이 시작됐다. 기존 취득자의 자격 이름이 소급해서 바뀌지는 않는다. |
| Solutions Architect – Professional | SAP-C03 접수는 2026년 10월 27일, 응시는 11월 17일 시작 예정. SAP-C02 마지막 응시일은 11월 16일이다. |
| Developer – Associate | DVA-C03 접수는 2026년 10월 27일, 응시는 12월 1일 시작 예정. DVA-C02 마지막 응시일은 11월 30일이다. |
| Machine Learning Engineer – Associate | MLA-C02 영어 베타는 2026년 9월 29일 시작. 정식 제공 예정일은 2027년 1월 14일이다. |
| Machine Learning – Specialty | 2026년 3월 31일이 마지막 응시일이었다. 지금 새로 준비할 시험 목록에 넣지 않는다. |
| Data Analytics / Database / SAP on AWS – Specialty | 2024년 4월에 종료됐다. 오래된 자격증 구성도에 계속 등장할 수 있다. |

근거는 [CloudOps 전환 안내](https://aws.amazon.com/certification/coming-soon/), [2026년 개정 일정](https://aws.amazon.com/blogs/training-and-certification/september-2026-new-offerings/), [ML Specialty 종료 안내](https://aws.amazon.com/certification/certified-machine-learning-specialty/), [2024년 종료 안내](https://aws.amazon.com/blogs/training-and-certification/aws-certification-retirements-and-launches/)다. 앞으로의 일정은 발표된 계획이며 변경될 수 있다.

시험 전체의 종료와 특정 언어의 종료도 구분해야 한다. CloudOps 한국어 시험은 **2026년 11월 19일 이후**, DevOps Professional 한국어 시험은 **2026년 12월 31일 이후** 종료한다고 안내돼 있다. 영어로는 시험이 남아 있어도 한국어로 예약할 수 없게 되는 경우다. [CloudOps 언어 안내](https://aws.amazon.com/certification/certified-cloudops-engineer-associate/), [DevOps 언어 안내](https://aws.amazon.com/certification/certified-devops-engineer-professional/)

## 난이도는 무엇 때문에 올라갈까

아래는 공식 합격률이나 통계 순위가 아니라 **시험 범위를 바탕으로 한 상대적인 해석**이다. 경험이 없는 분야로 옮겨 가면 같은 등급에서도 체감이 크게 달라진다.

| 분류 | 주로 어려워지는 지점 | 준비 방향 |
| --- | --- | --- |
| Foundational | 처음 보는 서비스와 용어의 양 | 서비스가 해결하는 문제와 책임 범위를 구분한다. |
| Associate | 여러 선택지 중 요구 사항에 맞는 조합을 고르는 판단 | 작은 구성을 직접 만들고 비용·권한·운영 차이를 설명한다. |
| Professional | 복합적인 조건과 긴 시험을 함께 처리하는 부담 | 설계 대안을 비교하고 실제 제한 시간으로 연습한다. |
| Specialty | 특정 분야의 깊은 지식과 기존 경험 의존도 | 해당 분야의 기초와 AWS 구현을 연결한다. |

예를 들어 저장 공간이 필요하다는 조건만으로는 설계를 정하기 어렵다. 접근 방식, 지연 시간, 장애 복구 목표, 운영 부담 같은 조건이 붙으면 선택이 달라진다. 공부하면서 서비스 이름만 기억하면 이런 비교에서 막히기 쉽다.

특히 네트워크와 보안은 AWS 밖에서 배운 지식도 영향을 준다. 평소 라우팅을 다루던 사람과 애플리케이션 코드만 작성하던 사람에게 ANS의 난이도가 같을 수 없다. 반대로 개발자에게 익숙한 배포·디버깅 개념이 다른 직무의 응시자에게는 새로운 학습 범위가 된다.

AWS가 제시하는 권장 경력도 합격에 필요한 최소 근무연수와는 다르다. SAA는 약 1년의 AWS 설계 경험을 목표 응시자상으로 삼지만, 경력이 그보다 짧다는 이유로 응시 자체가 막히는 것은 아니다. 정해진 강의 수료도 필수가 아니다. [SAA 대상자](https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03.html), [응시 FAQ](https://aws.amazon.com/certification/faqs/)

## 어떤 순서로 준비하면 좋을까

아래 화살표는 **학습 경로 제안**이며 필수 취득 순서가 아니다. 이미 알고 있는 단계는 공부만 하고 시험은 건너뛰어도 된다.

| 현재 상황과 목표 | 검토할 경로 | 선택 이유 |
| --- | --- | --- |
| IT·클라우드 모두 처음 | CLF → 관심 직무의 Associate | 용어와 서비스 역할부터 익힌다. |
| 개발 경험은 있지만 AWS는 낯섦 | SAA → 필요할 때 DVA 또는 SOA | 전체 구성을 익힌 뒤 개발·운영으로 좁힌다. |
| AWS 애플리케이션 개발이 목표 | DVA → DOP | 개발·배포에서 자동화와 운영으로 확장한다. |
| 인프라 설계와 마이그레이션이 목표 | SAA → SAP | 단일 구성에서 복잡한 조직의 설계로 확장한다. |
| 데이터 엔지니어링이 목표 | AWS 기초 보완 → DEA | 수집·변환·저장·운영 범위가 업무와 직접 연결된다. |
| ML 모델의 배포·운영이 목표 | ML·AWS 기초 보완 → MLA | 모델을 서비스로 운영하는 과정에 집중한다. |
| 생성형 AI 애플리케이션이 목표 | AI·AWS 기초와 구현 경험 → AIP | AI 개념 이해를 넘어 운영 환경의 구현 역량을 준비한다. |
| AI 도입을 주도하는 기획·관리 역할 | AIB, 필요하면 AIF 병행 | 투자·조직 판단과 기술 기초를 목적별로 나눈다. |

데이터 엔지니어라면 무조건 SAA를 취득한 뒤 DEA로 넘어갈 필요는 없다. 이미 AWS 네트워크·권한·스토리지를 이해한다면 DEA를 바로 준비해도 된다. 반대로 데이터 처리에는 익숙해도 클라우드 기반이 약하다면 SAA의 관련 범위를 공부하는 데 의미가 있다. 데이터 저장 구조부터 정리가 필요하다면 [데이터플랫폼의 기본 구성](/posts/data-platform-basics/)도 함께 읽어 볼 만하다.

## 실제 응시 후기에서는 무엇을 말할까

후기는 준비 과정을 구체적으로 볼 수 있지만, 무작위로 뽑은 응시자 표본은 아니다. 합격자가 글을 더 많이 남길 수 있고, 자신의 경력이나 학습 시간을 자세히 밝히지 않는 경우도 있다. 아래 사례만으로 평균 준비 기간이나 합격률을 계산하지는 않았다.

### 같은 SAA도 4~5주, 8주, 재응시로 갈린다

| 공개 후기 | 작성자가 밝힌 준비 과정 | 읽어 볼 지점 |
| --- | --- | --- |
| [SAA 합격, 2026-05-08](https://www.reddit.com/r/AWSCertifications/comments/1t6yx31/passed_saac03/) | 기존 AWS 업무 경험이 있었고 4~5주 준비. 평일 하루 1~2시간, 주말에는 더 학습했다고 설명한다. | 짧은 준비 기간 앞에 기존 경험이 있었다. |
| [SAA 합격, 2026-06-12](https://www.reddit.com/r/AWSCertifications/comments/1u487st/passed_the_solutions_architect_associate_saac03/) | 약 8주 동안 하루 1.5~2시간씩 공부. 실습을 하지 않아 시험이 어렵게 느껴졌다고 돌아본다. | 강의와 문제풀이만으로 부족하게 느낀 부분을 보여준다. |
| [국내 SAA 재응시 후기, 2025-07-09](https://insam04-01.tistory.com/10) | 2주 준비 후 첫 시험에서 불합격하고, 약 한 달 더 준비해 합격했다고 설명한다. | 서비스 관계를 이해하지 못한 암기 방식의 한계를 짚는다. |
| [SAA 불합격 후기, 2026년 6월](https://www.reddit.com/r/AWSCertifications/comments/1ua6hlf/i_failed_aws_saa_c03_today/) | 연습시험에서 75% 이상을 받았지만 실제 시험의 선택지에서 혼란을 겪었다고 설명한다. | 모의고사 점수를 실제 합격 보장으로 볼 수 없다. |

이 사례들에서 가져갈 만한 것은 특정 주차가 아니라 **자신의 출발점과 준비 상태를 구분하는 방법**이다. 이미 AWS를 쓰던 사람의 한 달과, 네트워크 개념부터 배우는 사람의 한 달은 학습 내용이 다르다. 여러 번 푼 문제의 정답을 기억해 높아진 점수도 처음 보는 문제를 해결하는 능력과 구분해야 한다.

### Professional에서는 시험 시간을 버티는 연습도 나온다

[2026년 3월 SAP-C02 합격 후기](https://www.reddit.com/r/AWSCertifications/comments/1s27cet/passed_sapc02_sharing_my_experience/)의 작성자는 Associate 이후 약 3개월 반을 준비했다고 설명한다. 정답과 오답의 이유를 이해하는 공부, 그리고 3시간 동안 집중하는 연습을 강조했다.

이 역시 모든 사람에게 필요한 기간은 아니다. 다만 Professional을 준비할 때 서비스 지식만 점검하고 시간 배분을 놓치지 말아야 한다는 참고 사례다. 짧은 문제 묶음에서는 괜찮았던 집중력이 한 회분 전체에서는 달라질 수 있다.

### 온라인이 편한 사람도 있고 시험센터가 편한 사람도 있다

앞의 [국내 온라인·오프라인 비교 후기](https://insam04-01.tistory.com/10)에서는 센터까지 1시간 30분 이동해야 했고, 함께 시험을 보는 환경에서 피로와 집중력 부담을 느꼈다고 한다. 반면 집에서 본 시험은 공간과 장비를 직접 준비해야 했지만 개인적으로 더 편했다고 적었다. SAP 후기 작성자는 시험센터를 선호했다.

따라서 온라인에 문제가 생겼다는 이야기만으로 센터를 정답으로 삼거나, 집이 편하다는 이유만으로 온라인을 선택하기보다는 이동 거리·독립된 공간·컴퓨터 환경·감독관과의 의사소통을 비교하는 것이 좋다. 개인 후기의 장비 규칙이나 환불 경험을 현재 공식 정책으로 옮겨 읽지는 말자.

## 공부 방법: 강의 다음에 무엇을 할까

강의 하나를 끝내는 것과 시험을 준비한 상태는 다르다. 다음 순서로 확인하면 부족한 부분을 찾기 쉽다.

1. **현재 시험 코드의 가이드를 읽는다.** 출제 영역뿐 아니라 대상 응시자, 범위 밖의 항목, 문항 형식까지 본다. 구버전 교재를 쓴다면 변경된 범위를 따로 채운다.
2. **기초 강의와 작은 실습을 묶는다.** SAA라면 네트워크·권한·저장을 연결한 간단한 구성을, DEA라면 데이터를 넣고 변환·조회하는 흐름을 직접 만들어 본다. 실습 후에는 과금되는 리소스도 정리한다.
3. **오답을 서비스 이름 대신 판단 근거로 남긴다.** 요구 사항을 놓쳤는지, 기능을 몰랐는지, 비용과 운영 부담을 잘못 비교했는지 구분한다.
4. **처음 보는 문제를 제한 시간 안에 푼다.** 이미 외운 문제의 점수보다 선택 이유를 설명할 수 있는지가 중요하다. Professional은 한 회분 전체로 연습해 본다.
5. **약한 영역을 보완한 뒤 예약한다.** 누군가의 준비 기간에 맞추기보다는 자신의 이해와 일정으로 판단한다.

공식 자료는 각 자격증 페이지의 시험 가이드와 [AWS Skill Builder](https://skillbuilder.aws/) 학습 경로에서 시작하면 된다. 무료 자료와 유료 구독 자료가 섞여 있으므로 모의시험·실습이 어떤 상품에 포함되는지 구분해서 고른다.

위 후기에는 Stéphane Maarek 강의, Tutorials Dojo 연습시험, AWS 공식 연습시험 등이 등장한다. 이 글에서 해당 유료 강의를 직접 수강하고 비교 평가한 것은 아니다. 구입한다면 후기의 유명세보다 **현재 시험 버전 지원, 설명 언어, 실습 포함 여부, 오답 해설**을 먼저 보는 편이 낫다.

후기에서 말하는 ‘덤프’도 연습시험과 구별해야 한다. 자체 제작한 예상 문제와 실제 시험 문항을 무단 복원·유출한 자료는 다르다. AWS는 무단 시험 콘텐츠 사용을 금지한다. 학습 자료는 출처와 제작 방식을 확인하고, 답을 외우는 대신 근거를 설명할 수 있는 자료를 선택하자. [시험 콘텐츠 보안 정책 설명](https://aws.amazon.com/blogs/training-and-certification/protecting-aws-certification-value-through-security-measures/)

## 접수부터 시험 당일까지

### 1. 시험과 언어를 정하고 예약한다

AWS Certification 계정에 로그인해 새 시험 예약을 선택한 뒤 Pearson VUE 예약 절차로 이동한다. 시험 코드, 응시 언어, 시험센터 또는 온라인 방식, 날짜와 시간대를 선택하고 결제한다. 마지막에는 확인 메일의 이름·시험·시간을 다시 확인한다. [예약 안내](https://aws.amazon.com/certification/policies/before-testing/)

한국어 시험과 한국어 감독은 같은 조건이 아니다. 번역된 시험에서는 영어 원문을 보는 기능을 사용할 수 있지만, 온라인 감독관과의 소통 언어는 별도로 확인해야 한다. 영어 비원어민이 **영어 시험을 볼 때**는 `ESL +30` 시간 연장을 신청할 수 있으며, 예약 전에 처리해야 한다. 한국어로 응시하면 자동으로 30분을 더 받는 제도는 아니다. [언어·시간 연장 안내](https://aws.amazon.com/certification/policies/before-testing/)

### 2. 시험센터와 온라인 중 환경에 맞춰 고른다

| 항목 | 시험센터 | 온라인 감독 시험 |
| --- | --- | --- |
| 이동 | 센터까지 이동해야 한다. | 이동 없이 응시할 수 있다. |
| 장비 | 센터의 시험 장비를 사용한다. | 자신의 컴퓨터·웹캠·마이크·스피커 등을 준비한다. |
| 공간 | 센터의 시험 규칙을 따른다. | 혼자 응시할 수 있는 규정에 맞는 공간이 필요하다. |
| 사전 확인 | 위치, 도착 시간, 신분증 요구 사항 | 같은 장비와 네트워크로 시스템 테스트, 공간과 신분증 확인 |
| 선택할 때 볼 점 | 이동 피로와 예약 가능한 시간 | 네트워크 안정성, 방해 가능성, 감독관과의 소통 |

온라인이라면 예약 전에 OnVUE 시스템 테스트를 실제 사용할 장비와 네트워크로 통과해 두자. 현재 안내는 단일 화면과 작동하는 웹캠·마이크·스피커를 요구하며, 헤드폰·헤드셋 사용을 허용하지 않는다. 세부 운영체제·네트워크 요구 사항과 체크인 절차는 [Pearson VUE AWS 온라인 시험 안내](https://www.pearsonvue.com/us/en/aws/onvue.html)를 기준으로 준비한다.

계정의 이름과 신분증 표기가 맞는지도 미리 확인한다. 후기 작성자가 여권을 썼다는 사실만으로 모든 응시자의 신분증 요구 사항이 같다고 판단해서는 안 된다. 선택한 응시 방식의 안내와 예약 확인 메일에 맞춰 준비하는 것이 정확하다.

### 3. 문항 형식과 점수 해석을 알아둔다

SAA처럼 단일 정답·복수 정답 선택으로 구성된 시험이 있지만, 모든 시험이 그 두 형식만 사용하는 것은 아니다. 예를 들어 **SCS-C03 가이드에는 순서 배열과 짝 맞추기도 포함**돼 있다. 준비할 시험의 최신 가이드와 시험 데모로 조작 방법까지 확인하자. [SCS-C03 문항 형식](https://docs.aws.amazon.com/aws-certification/latest/security-specialty-03.html)

점수도 단순 정답률로 해석하면 안 된다. 대표적으로 CLF-C02의 합격 기준은 700점, SAA-C03은 720점, SCS-C03은 750점이며, 100~1,000점의 환산 점수를 사용한다. SAA의 720점이 ‘65문제 중 72%만 맞히면 된다’는 의미는 아니다. SAA에는 점수에 반영되지 않는 15문항도 포함되며 시험 중에는 구분되지 않는다. [CLF 채점](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02.html), [SAA 채점](https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03.html), [SCS 채점](https://docs.aws.amazon.com/aws-certification/latest/security-specialty-03.html)

## 비용, 결과 발표, 재응시와 갱신

### 응시료 외에 잡아야 할 비용

응시료에 강의·연습시험·실습 비용이 더해질 수 있다. 센터를 이용한다면 교통비도 들어간다. 달러 가격에 오늘의 환율만 곱한 금액이 실제 청구액과 같다고 가정하지 말고 결제 화면의 통화와 세금 포함 금액을 확인하자.

확인 시점의 공식 원화 기본 가격은 Business·Foundational **131,525원**, Associate **197,287원**, Professional·Specialty **394,575원**이다. 적용 세금은 별도일 수 있으며 베타 가격과도 구분해야 한다. [지역별 가격표](https://aws.amazon.com/certification/policies/before-testing/)

자격 취득 후에는 다음 AWS Certification 시험에 사용할 **50% 할인 혜택**이 제공된다. 자신의 Certification 계정에서 바우처와 적용 조건을 확인하면 된다. 한시적인 무료 재응시 행사는 이 혜택과 별개이며, 오래된 후기의 프로모션 코드를 현재도 쓸 수 있다고 가정해서는 안 된다. [자격 취득 후 할인 안내](https://aws.amazon.com/certification/certified-devops-engineer-professional/)

할인만을 위해 필요 없는 시험을 추가하는 것도 계산해 볼 문제다. 세금·재응시를 빼고 CLF $100을 먼저 낸 뒤 Associate $150에 50%를 적용하면 합계는 **$175**다. Associate만 바로 보는 $150보다 싸지는 않다. CLF를 먼저 볼 이유가 있다면 학습 가치가 함께 있어야 한다.

### 결과와 재응시

현재 FAQ는 시험 결과를 **응시 후 영업일 기준 5일 이내**에 계정에서 확인할 수 있다고 안내하며 베타도 포함한다. 후기에서 몇 시간 만에 결과를 받았다는 사례는 보장된 발표 시간이 아니다. 대부분의 시험은 종료 화면에서 즉시 합격 여부를 보여주지 않는다.

불합격 후에는 **14일을 기다려야** 재응시할 수 있고, 응시료는 다시 필요하다. 예약 변경·취소는 시험 시작 24시간 전까지 처리할 수 있지만, 그 안쪽으로 들어가면 일반적인 변경·취소가 불가능하다. 결시하면 응시료를 잃을 수 있으므로 준비 상태를 마지막 날에 판단하지 않는 편이 좋다. [결과·재응시·예약 변경 FAQ](https://aws.amazon.com/certification/faqs/)

**베타는 한 번만 응시할 수 있다.** 베타에서 불합격했다면 14일 뒤 같은 베타를 다시 보는 것이 아니라 정식 시험 제공까지 기다려야 한다. 할인된 가격만 보고 베타를 고르기 전에 이 차이도 고려하자. [베타 응시 정책](https://aws.amazon.com/certification/policies/before-testing/)

### 취득 이후에도 유효기간이 있다

AWS 자격은 기본적으로 취득 후 **3년간 유효**하다. 갱신은 만료 전에 챙겨야 하며, 같은 시험을 다시 보는 것 외에 연결된 상위 자격을 취득하는 방법도 있다. 예를 들어 SAA는 SAP로, DVA와 CloudOps는 DOP로 갱신할 수 있다.

현재 갱신 안내에는 해당 자격에 대해 AWS Skill Builder의 활동으로 1년 유지하는 선택지도 있다. 시험을 통한 3년 갱신과 조건이 다르고 유료 구독이 필요한 경우도 있으므로, 보유 자격의 행에서 가능한 방법을 확인해야 한다. 종료된 자격이나 아무 상위 시험에 이 규칙을 일괄 적용할 수는 없다. [자격별 갱신·유지 방법](https://aws.amazon.com/certification/recertification/)

## 첫 시험을 고를 때 남길 질문

첫 자격증을 고르기 전에 ‘이 배지를 따면 다음에 무엇을 직접 해 볼 것인가’를 정해 두면 선택이 쉬워진다. AWS 구성을 이해해 서비스를 배포하려는지, 데이터 파이프라인을 운영하려는지, AI 도입을 판단하려는지에 따라 필요한 공부가 달라진다.

목표가 아직 모호한 입문자는 CLF나 SAA의 공식 예제 문제부터 풀어 보자. 이미 직무가 정해져 있다면 그 Associate의 가이드를 읽고 부족한 기초를 채운다. 이후에는 자격증 개수를 늘리기 전에 작은 프로젝트 하나에서 **왜 그 서비스를 골랐고, 어떤 대안을 포기했는지** 설명해 보는 편이 공부를 실제 역량으로 연결하는 데 도움이 된다.
