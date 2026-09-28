---
title: "{{ replace .File.ContentBaseName "-" " " | title }}"
date: {{ .Date }}
draft: true
description: ""
slug: "{{ .File.ContentBaseName }}"
categories: []
tags: []
---

<!-- 문제와 핵심 답변을 먼저 쓰고 개념·해결 방법·예제·결과·주의사항을 연결합니다. -->
<!-- 공개 전에 description을 작성합니다. 실질적인 수정 때만 lastmod를 시간대와 함께 추가합니다. -->
