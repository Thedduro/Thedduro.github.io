---
title: "소개"
layout: "about"
description: "데이터가 지속적으로 비즈니스 가치를 만들 수 있는 시스템을 고민하는 데이터 엔지니어 임선우(Sunwoo Lim)입니다."
name_en: "Sunwoo Lim"
headline: "분석에서 시작해,\n시스템으로 이어갑니다."
experience:
  - organization: "PTKOREA"
    role: "Data Engineer · Data Backend"
    period: "2026.07 — 현재"
    current: true
    details:
      - "S사 BI Dashboard 프로젝트"
  - organization: "삼성 청년 SW·AI 아카데미(SSAFY)"
    role: "SSAFY 14기 DATA 트랙"
    period: "2025.07 — 2026.07"
  - organization: "한국능률협회컨설팅 KMAC"
    role: "Data Analyst Intern"
    period: "2024.07 — 2025.01"
    details:
      - "9개 중소기업의 비즈니스 데이터 분석 및 컨설팅"
      - "구매 원가 예측과 GIS 기반 입찰 전략 분석"
      - "반복적인 분석 업무를 줄이는 자동화 도구 개발"
      - "현업 및 여러 직군과 협업하며 분석 결과를 비즈니스 과제로 연결"
  - organization: "수원대학교"
    role: "Data Science"
    details:
      - "학점: 3.92 / 4.5"
    period: "2019.02 — 2024.08"
projects:
  - name: "One Bite Article"
    category: "Data Pipeline"
    summary: "AI 기반 IT 뉴스 학습 플랫폼"
    highlights:
      - "Airflow 기반 기사 수집·선별·본문 저장·AI 처리 API 연계 자동화"
      - "MySQL 메타데이터와 MongoDB 기사 본문 분리 저장"
      - "누적 순위 점수·등장 빈도·갱신 시점 기반 상위 5개 기사 선별"
      - "Docker 기반 Airflow 실행 환경 및 DAG 재시도 정책 구성"
    github: "https://github.com/OneBiteArticle"
    architecture: "images/projects/oba-architecture.png"
    stack: ["Airflow", "Python", "Docker", "MySQL", "MongoDB"]
  - name: "ROMO"
    category: "Infrastructure · CI/CD"
    summary: "여행·약속의 공동 경비 기록 및 정산 서비스"
    highlights:
      - "Jenkins·Docker Compose 기반 개발·운영 CI/CD 구성"
      - "헬스체크 기반 백엔드 블루그린 배포 및 Nginx 전환 실패 시 복구 로직 구현"
      - "Prometheus·Grafana 모니터링 및 Alertmanager 알림 구성"
      - "n8n 기반 MR 리뷰 자동화"
    github: "https://github.com/zero-memo/ROMO-code/tree/dev/infra"
    architecture: "images/projects/romo-architecture.png"
    stack: ["Docker Compose", "Jenkins", "Nginx", "Prometheus", "Grafana", "Alertmanager", "n8n"]
  - name: "Akkubank"
    category: "AI · Data Pipeline"
    summary: "어린이 금융 학습을 위한 게이밍 핀테크 플랫폼"
    highlights:
      - "FastAPI 금융 학습 챗봇의 의도별 응답 라우팅과 출력 검수·재작성 구현"
      - "PostgreSQL·pgvector 검색을 활용한 RAG 답변 생성"
      - "Airflow 기반 뉴스 수집·중복 제거·임베딩·벡터 DB 적재 자동화"
      - "LangGraph 기반 난이도별 경제 퀴즈 생성·검증·재생성·저장 흐름 구성"
    github: "https://github.com/akku-bank"
    architecture: "images/projects/akbk-architecture.png"
    stack: ["FastAPI", "LangChain", "LangGraph", "Kafka", "Spark", "Airflow", "PostgreSQL", "pgvector"]
  - name: "Barmi"
    category: "AI Gateway · Infrastructure"
    summary: "청각장애인을 위한 AI 영어 발음 학습 플랫폼"
    highlights:
      - "Nginx HTTPS 리버스 프록시 및 OpenVidu WebSocket 라우팅 구성"
      - "RabbitMQ 기반 음성 분석 작업·결과 큐와 메시지 라우팅 설계"
      - "FastAPI AI 게이트웨이의 음성 파일 전달·분석 결과·오류 처리 구현"
      - "Docker 기반 AI 게이트웨이 컨테이너화 및 프로젝트 PM 수행"
    github: "https://github.com/BarmiSpeechLab"
    architecture: "images/projects/barmi-architecture.png"
    stack: ["FastAPI", "RabbitMQ", "Docker", "Nginx", "OpenVidu"]
tools:
  - area: "Data Engineering"
    items: ["Kafka", "RabbitMQ", "Flink", "Spark", "Airflow", "Elasticsearch"]
  - area: "Backend"
    items: ["FastAPI", "Django", "REST API"]
  - area: "Data Store"
    items: ["MySQL", "PostgreSQL", "MongoDB", "Redis", "Vertica"]
  - area: "Cloud & DevOps"
    items: ["AWS", "Docker", "Kubernetes", "Linux", "Nginx", "Jenkins", "Prometheus", "Grafana"]
  - area: "AI Systems"
    items: ["LangChain", "LangGraph", "RAG", "AI Agent", "MLflow"]
awards:
  - title: "월간 해커톤: 투자 데이터를 시각화하라 — Skills 기반 대시보드 설계"
    result: "2등"
    issuer: "DACON"
    date: "2026.05"
    url: "https://github.com/toja-dash/supgeuk-war"
  - title: "삼성 청년 SW AI 아카데미 프로젝트 우수상"
    result: "1등"
    issuer: "삼성전자주식회사"
    date: "2026.03"
    url: "https://github.com/akku-bank"
    detail: "아꾸뱅꾸 - 아이들을 위한 핀테크 플랫폼"
  - title: "삼성 청년 SW AI 아카데미 프로젝트 우수상"
    result: "3등"
    issuer: "삼성전자주식회사"
    date: "2026.02"
    url: "https://github.com/BarmiSpeechLab"
    detail: "바르미 — 청각장애인을 위한 영어 발음 학습 서비스"
  - title: "2022 한국소프트웨어종합학술대회"
    result: "장려상"
    issuer: "한국정보과학회"
    date: "2023.02"
    url: "https://www.dbpia.co.kr/journal/articleDetail?nodeId=NODE11224523"
    detail: "분류 모델링과 클러스터링 결합 방법을 통한 주가 시계열 데이터에서의 상승 추세 패턴 검출 기법"
certifications:
  - title: "SQLD (SQL Developer)"
    issuer: "한국데이터산업진흥원"
    date: "2021.06"
    credential_id: "SQLD-041000591"
  - title: "ADsP (데이터분석준전문가)"
    issuer: "한국데이터산업진흥원"
    date: "2022.03"
    credential_id: "ADsP-032000622"
  - title: "정보처리기사"
    issuer: "한국산업인력공단 (HRD Korea)"
    date: "2025.06"
    credential_id: "25201100769K"
---

데이터 사이언스 전공으로 시작해 B2B 컨설팅 기업에서 데이터 분석 업무를 수행했습니다. 분석 결과가 장기적인 비즈니스 자산으로 이어지기까지의 어려움을 경험하면서, 데이터를 분석하는 일에서 데이터를 계속 활용할 수 있는 시스템을 만드는 일로 관심을 넓혔습니다.

이후 백엔드 개발, 클라우드 인프라, 실시간 데이터 엔지니어링, LLM 애플리케이션을 경험했습니다. 데이터가 일회성 분석에 머무르지 않고 안정적인 시스템을 통해 흐를 때 지속적인 가치를 만든다고 믿습니다.
