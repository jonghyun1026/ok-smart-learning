const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  BorderStyle, ShadingType, HeadingLevel, AlignmentType, PageBreak, ImageRun,
  Header, Footer, PageNumber, TableOfContents, LevelFormat,
} = require("docx");

const NAVY = "1F3864";
const DARK = "3F363F";
const LIGHT_SHADE = "F2F2F2";
const HEAD_SHADE = "3F363F";

const border = { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" };
const borders = { top: border, bottom: border, left: border, right: border };

function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
}
function p(text, opts = {}) {
  return new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text, size: 21, ...opts })] });
}
function note(text) {
  return new Paragraph({
    spacing: { after: 200 },
    children: [new TextRun({ text, size: 19, italics: true, color: "595959" })],
  });
}

/** 표지용 번호목록 (공문체: "1. 라벨" + 아래 줄 값) */
function infoList(rows) {
  const paras = [];
  rows.forEach(([label, value], i) => {
    paras.push(
      new Paragraph({
        spacing: { before: i === 0 ? 0 : 160, after: 40 },
        children: [
          new TextRun({ text: `${i + 1}. `, bold: true, size: 21, color: NAVY }),
          new TextRun({ text: label, bold: true, size: 21, color: DARK }),
        ],
      })
    );
    paras.push(
      new Paragraph({
        indent: { left: 340 },
        spacing: { after: 0 },
        children: [new TextRun({ text: value, size: 21, color: DARK })],
      })
    );
  });
  return paras;
}

/** 2열 정보표 (본문 산식·기준 등) */
function infoTable(rows, widths = [2600, 6760]) {
  return new Table({
    width: { size: widths[0] + widths[1], type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map(
      ([label, value]) =>
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              borders,
              width: { size: widths[0], type: WidthType.DXA },
              shading: { fill: LIGHT_SHADE, type: ShadingType.CLEAR },
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20, color: DARK })] })],
            }),
            new TableCell({
              borders,
              width: { size: widths[1], type: WidthType.DXA },
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [new Paragraph({ children: [new TextRun({ text: value, size: 20, color: DARK })] })],
            }),
          ],
        })
    ),
  });
}

/** 제출서류 목록 표 (No/서류명/주요 포함 내용/형식) */
function docListTable(items) {
  const widths = [600, 2400, 4800, 1560];
  const headerRow = new TableRow({
    cantSplit: true,
    children: ["No.", "서류명", "주요 포함 내용", "형식"].map(
      (t, i) =>
        new TableCell({
          borders,
          width: { size: widths[i], type: WidthType.DXA },
          shading: { fill: HEAD_SHADE, type: ShadingType.CLEAR },
          margins: { top: 90, bottom: 90, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 19, color: "FFFFFF" })] })],
        })
    ),
  });
  const rows = items.map(
    (item, i) =>
      new TableRow({
        cantSplit: true,
        children: [String(i + 1), item.name, item.content, item.format].map((t, ci) => {
          const w = widths[ci];
          return new TableCell({
            borders,
            width: { size: w, type: WidthType.DXA },
            shading: i % 2 === 1 ? { fill: "FAF8F5", type: ShadingType.CLEAR } : undefined,
            margins: { top: 90, bottom: 90, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: t, size: 19, color: DARK })] })],
          });
        }),
      })
  );
  return new Table({ width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: widths, rows: [headerRow, ...rows] });
}

/** 구분/세부기준 4행 표 (우수/보통/미흡/확인서류) — 필수자격은 우수/미흡 2행만 사용 */
function gradeTable(rows) {
  const widths = [1600, 7760];
  return new Table({
    width: { size: widths[0] + widths[1], type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map(
      ([label, value], i) =>
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              borders,
              width: { size: widths[0], type: WidthType.DXA },
              shading: { fill: label === "확인서류" ? HEAD_SHADE : LIGHT_SHADE, type: ShadingType.CLEAR },
              margins: { top: 90, bottom: 90, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: label, bold: true, size: 19, color: label === "확인서류" ? "FFFFFF" : DARK }),
                  ],
                }),
              ],
            }),
            new TableCell({
              borders,
              width: { size: widths[1], type: WidthType.DXA },
              margins: { top: 90, bottom: 90, left: 140, right: 140 },
              children: [new Paragraph({ children: [new TextRun({ text: value, size: 19, color: DARK })] })],
            }),
          ],
        })
    ),
  });
}

function criterionBlock(no, title, points, grades, docRef) {
  const rows = [
    ["우수", grades.high],
    ["보통", grades.mid],
    ["미흡", grades.low],
    ["확인서류", docRef],
  ];
  return [
    new Paragraph({
      keepNext: true,
      spacing: { before: 260, after: 100 },
      children: [
        new TextRun({ text: `${no}. `, bold: true, size: 22, color: NAVY }),
        new TextRun({ text: title, bold: true, size: 22, color: DARK }),
      ],
    }),
    gradeTable(rows),
  ];
}

function pfBlock(no, title, passRule, failRule, docRef) {
  return [
    new Paragraph({
      keepNext: true,
      spacing: { before: 260, after: 100 },
      children: [
        new TextRun({ text: `${no}. `, bold: true, size: 22, color: NAVY }),
        new TextRun({ text: title, bold: true, size: 22, color: DARK }),
        new TextRun({ text: "  (Pass/Fail)", bold: true, size: 20, color: "595959" }),
      ],
    }),
    gradeTable([
      ["Pass", passRule],
      ["Fail", failRule],
      ["확인서류", docRef],
    ]),
  ];
}

const logoPath = path.join(__dirname, "..", "..", "public", "logo-wide.png");
const logoBuffer = fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : null;
// 원본 1959x351(≈5.58:1) 비율을 그대로 유지 — 웹 로고와 동일한 원칙(찌그러짐 방지)
const LOGO_HEIGHT = 23;
const LOGO_WIDTH = Math.round(LOGO_HEIGHT * (1959 / 351));

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Malgun Gothic", size: 21, color: DARK } } },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, font: "Malgun Gothic", color: NAVY },
        paragraph: { spacing: { before: 420, after: 220 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Malgun Gothic", color: DARK },
        paragraph: { spacing: { before: 260, after: 140 }, outlineLevel: 1 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "notes-numbers",
        levels: [
          {
            level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 420, hanging: 340 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1350, right: 1350, bottom: 1350, left: 1350 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9", space: 4 } },
              tabStops: [{ type: "right", position: 9210 }],
              children: [
                new TextRun({ text: "OK학당 스마트러닝 위탁운영 세부 평가기준 안내", size: 16, color: "595959" }),
                new TextRun({ text: "\tOK금융그룹 인재개발팀", size: 16, color: "595959" }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "- ", size: 17, color: "595959" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 17, color: "595959" }),
                new TextRun({ text: " -", size: 17, color: "595959" }),
              ],
            }),
          ],
        }),
      },
      children: [
        ...(logoBuffer
          ? [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 700, after: 260 },
                children: [
                  new ImageRun({
                    type: "png",
                    data: logoBuffer,
                    transformation: { width: LOGO_WIDTH, height: LOGO_HEIGHT },
                    altText: { title: "OK금융그룹", description: "OK금융그룹 로고", name: "logo" },
                  }),
                ],
              }),
            ]
          : [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 900, after: 200 }, children: [
              new TextRun({ text: "OK금융그룹 인재개발팀", size: 21, color: "595959" }),
            ] })]),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [
          new TextRun({ text: "「2026~2027년 OK학당 스마트러닝 교육 위탁운영 용역」", bold: true, size: 40, color: DARK }),
        ] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 500 }, children: [
          new TextRun({ text: "세부 평가기준", bold: true, size: 32, color: NAVY }),
        ] }),

        ...infoList([
          ["사업명", "2026~2027년 OK학당 스마트러닝 교육 위탁운영 용역"],
          ["계약기간", "2026.9.1 ~ 2027.8.31"],
          ["교육대상인원", "연간 약 1,800명 (예상수강인원, 계약 후 추가인원 협의)"],
          ["위탁범위", "콘텐츠 제공 · 온라인 러닝플랫폼 제공 · 운영/수강관리 · 교육결과 제공 · 부가서비스"],
          ["선정방식", "공개경쟁입찰 (제안서 기술평가 80% + 입찰가격 평가 20%)"],
          ["입찰공고 게시", "2026.07.07"],
          ["입찰공고 마감(제안서 제출기한)", "2026.07.16"],
        ]),

        new Paragraph({ children: [new PageBreak()] }),

        new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: "목차", bold: true, size: 30, color: NAVY })] }),
        new TableOfContents("목차", { hyperlink: true, headingStyleRange: "1-1" }),
        new Paragraph({ children: [new PageBreak()] }),

        h1("1. 안내 개요 및 목적"),
        p(
          "OK금융그룹은 「2026~2027년 OK학당 스마트러닝 교육 위탁운영 용역」계약을 위해 공개경쟁입찰을 실시합니다. 본 문서는 참여 업체가 제안서 작성에 필요한 제출서류와 세부 평가기준을 명확히 이해할 수 있도록 안내하기 위해 작성되었습니다."
        ),
        h2("1-1. 제출서류 목록 (필수)"),
        docListTable([
          { name: "사업 제안서\n(스마트러닝 위탁운영 용역 제안서)", content: "사업수행계획, 콘텐츠 제공계획, 운영계획, 시스템 운영계획 등 세부 평가기준 각 항목에 대한 제안 내용", format: "PDF/DOCX" },
          { name: "사업자등록증", content: "사업자등록번호, 대표자, 업태/종목", format: "PDF" },
          { name: "법인등기부등본\n(말소포함, 최근 3개월 이내)", content: "발급일 기준 최근 3개월 이내, 말소사항 포함하여 발급", format: "PDF" },
          { name: "재무제표 또는\n부가가치과세증명원 (최근 2년)", content: "최근 2개년 재무상태표·손익계산서 또는 부가가치세과세표준증명원", format: "PDF/DOCX/XLSX" },
          { name: "사업수행실적증명서", content: "발주기관명, 계약기간, 사업규모(수강인원 등)를 명시한 위탁교육 운영실적", format: "PDF" },
          { name: "가격입찰서", content: "입찰금액(부가세 포함) 및 산출근거", format: "PDF/XLSX" },
          { name: "참여인력 구성도", content: "PM 및 담당자별 역할(R&R), 경력사항", format: "PDF" },
        ]),
        note("※ 위 7종은 모두 필수 제출 서류이며, 미제출 시 평가에서 제외될 수 있습니다."),

        h1("2. 필수 자격 관련 제출 요건 (Pass / Fail)"),
        p("아래 조건을 충족하지 못하는 업체는 전체 평가에서 즉시 제외됩니다."),
        ...pfBlock(
          "2-1", "계약결격사유 없음 (국가계약법 등)",
          "국가를 당사자로 하는 계약에 관한 법률 등에 따른 계약결격사유가 없음이 확인됨",
          "계약결격사유가 하나라도 확인될 경우 즉시 평가 대상에서 제외",
          "사업자등록증, 법인등기부등본"
        ),
        ...pfBlock(
          "2-2", "원격평생교육시설 신고 업체 여부",
          "관계 법령에 따른 원격평생교육시설 신고를 완료한 업체임이 확인됨",
          "신고 사실이 확인되지 않을 경우 즉시 평가 대상에서 제외",
          "관련 신고증빙 (관리자 별도 확인)"
        ),

        h1("3. 일반부문"),
        ...criterionBlock("3-1", "경영현황 및 재무안정성", 4, {
          high: "최근 2개년 재무제표(또는 부가가치과세증명원)상 부채비율·유동비율 등 재무지표가 안정적이며 매출·이익이 흑자 기조를 유지함",
          mid: "재무지표가 업계 평균 수준이며 특이사항은 확인되지 않음",
          low: "완전자본잠식, 연속 영업손실 등 재무 위험신호가 확인되거나 재무 관련 서류가 제출되지 않음",
        }, "재무제표 또는 부가가치과세증명원"),
        ...criterionBlock("3-2", "사업수행실적 (순수 위탁교육 실적)", 4, {
          high: "최근 5년 내 순수 위탁교육(콘텐츠 제공+플랫폼 운영+학습관리 통합형) 실적이 3건 이상이며 발주기관명·규모가 구체적으로 확인됨",
          mid: "위탁교육 실적은 있으나 통합형이 아니거나 확인 가능한 실적이 1~2건에 그침",
          low: "관련 실적이 확인되지 않거나 증빙이 불충분함",
        }, "사업수행실적증명서"),
        ...criterionBlock("3-3", "전담인력 배치계획 (PM/R&R)", 2, {
          high: "전담 PM이 지정되어 있고 팀원별 인원수·경력·역할(R&R)이 구체적으로 제시됨",
          mid: "인력 구성은 제시되었으나 역할 분담이 명확하지 않음",
          low: "투입 인력 정보가 부족하거나 겸직/파트타임 위주로 구성되어 책임소재가 불분명함",
        }, "참여인력 구성도"),

        h1("4. 콘텐츠부문"),
        ...criterionBlock("4-1", "보유 콘텐츠 양·다양성 (직무/리더십/어학 등)", 5, {
          high: "직무·리더십·어학·법정필수교육 등 다양한 카테고리에 걸쳐 콘텐츠 보유 수량이 구체적 수치로 제시됨",
          mid: "보유 콘텐츠는 있으나 카테고리 구성이나 수량 제시가 개략적임",
          low: "보유 콘텐츠 현황이 제시되지 않거나 특정 분야에 편중됨",
        }, "제안서 콘텐츠 목록"),
        ...criterionBlock("4-2", "콘텐츠 최신성 및 업데이트 주기 (법정필수교육 포함)", 5, {
          high: "콘텐츠 최신성 비율(예: 최근 2년 이내 제작 비중)과 법정필수교육 개정 반영 주기가 구체적으로 제시됨",
          mid: "업데이트 방침은 있으나 주기나 반영 절차가 개략적으로만 언급됨",
          low: "콘텐츠 최신성 관리 방안이 제시되지 않음",
        }, "제안서"),
        ...criterionBlock("4-3", "생성형 AI·데이터 리터러시 등 신기술 콘텐츠 보유/개발계획", 10, {
          high: "생성형 AI·데이터 리터러시 관련 콘텐츠를 이미 운영 중이며 향후 개발 로드맵이 구체적으로 제시됨",
          mid: "관련 콘텐츠 도입 계획은 있으나 운영 실적이 확인되지 않음",
          low: "신기술 콘텐츠 보유·개발계획이 제시되지 않음",
        }, "제안서"),
        ...criterionBlock("4-4", "자체 제작 콘텐츠 무상 탑재 및 운영 지원", 5, {
          high: "계약기간 중 무상 탑재 콘텐츠 수량 및 발주기관 맞춤 콘텐츠 제작 지원 조건이 구체적으로 명시됨",
          mid: "무상 지원 방침은 있으나 구체적 수량·조건이 불명확함",
          low: "무상 콘텐츠 지원 계획이 제시되지 않음",
        }, "제안서"),

        h1("5. 운영부문"),
        ...criterionBlock("5-1", "운영전략 및 추진계획의 타당성", 5, {
          high: "착수부터 안정화까지 단계별 추진 일정과 리스크 대응 방안이 구체적으로 제시됨",
          mid: "추진계획은 제시되었으나 일반적인 수준에 머무름",
          low: "추진계획이 개략적이거나 실현 가능성이 낮음",
        }, "제안서"),
        ...criterionBlock("5-2", "학습 참여 촉진 및 참여활성화 방안", 5, {
          high: "자동 알림, 포상, 게이미피케이션 등 구체적 방안과 함께 기대 효과(완주율 개선 등)가 수치로 제시됨",
          mid: "독려 방안은 있으나 구체적 실행 방식이나 기대효과 제시가 부족함",
          low: "학습 참여 촉진 방안이 제시되지 않음",
        }, "제안서"),
        ...criterionBlock("5-3", "학습자 관리 (콜센터 09~18시, VOC 대응) 체계", 5, {
          high: "콜센터 운영시간, 채널, VOC 응답·처리 목표시간(SLA)이 구체적으로 제시됨",
          mid: "학습자 관리 체계는 있으나 응답시간 등 구체적 SLA 제시가 없음",
          low: "학습자 관리·VOC 대응 체계가 제시되지 않음",
        }, "제안서"),
        ...criterionBlock("5-4", "교육결과 보고 및 사후관리 체계", 5, {
          high: "보고 주기(월간/분기/연간)와 보고 형식(대시보드 등)이 구체적으로 제시됨",
          mid: "보고 체계는 있으나 주기나 형식이 불명확함",
          low: "교육결과 보고 체계가 제시되지 않음",
        }, "제안서"),
        ...criterionBlock("5-5", "부가서비스 (부정수강 모니터링, 맞춤 추천 등)", 5, {
          high: "부정수강 탐지, 맞춤 콘텐츠 추천 등 복수의 부가서비스가 구체적으로 제시됨",
          mid: "부가서비스가 일부 제시되나 범위가 제한적임",
          low: "부가서비스 계획이 제시되지 않음",
        }, "제안서"),

        h1("6. 시스템부문"),
        ...criterionBlock("6-1", "웹/모바일 학습 플랫폼 사용 편의성", 5, {
          high: "반응형 웹과 모바일 앱을 함께 제공하며 사용성 지표(사용자 만족도 등)가 근거로 제시됨",
          mid: "플랫폼은 제공되나 사용성에 대한 구체적 근거가 부족함",
          low: "플랫폼 사용 편의성에 대한 설명이 미흡함",
        }, "제안서, 화면 예시"),
        ...criterionBlock("6-2", "해외법인 (인도네시아·캄보디아 등) 접속 지원 등 안정성", 5, {
          high: "해외 법인 대상 국가별 접속 안정성 대책(CDN 등)과 가용률·응답속도 수치가 제시됨",
          mid: "해외 접속 지원 계획은 있으나 구체적 대책이나 수치 근거가 부족함",
          low: "해외법인 접속 지원 방안이 제시되지 않음",
        }, "제안서"),
        ...criterionBlock("6-3", "정보보안 대책 (개인정보보호, DB보안)", 6, {
          high: "ISMS-P 등 정보보안 인증을 보유하고 있으며 DB 이중화, 접근 로그 관리 등 구체적 대책이 제시됨",
          mid: "기본적인 보안 대책은 있으나 인증이나 세부 대책이 구체적이지 않음",
          low: "정보보안 대책이 제시되지 않음",
        }, "정보보안 대책서 (또는 제안서 내 보안 관련 항목)"),
        ...criterionBlock("6-4", "장애대응 및 유지보수 체계", 4, {
          high: "24시간 모니터링 체계와 장애 대응·복구 목표시간(SLA)이 구체적 수치로 제시됨",
          mid: "장애대응 체계는 있으나 목표시간 등 구체적 SLA 제시가 없음",
          low: "장애대응 및 유지보수 체계가 제시되지 않음",
        }, "제안서"),

        h1("7. 가격평가"),
        h2("7-1. 입찰가격 환산 점수"),
        p("입찰가격은 아래 산식에 따라 환산하며, 별도의 정성평가 없이 산식에 따라 산정합니다.", { bold: true }),
        infoTable(
          [
            ["산식", "가격점수 = 20 × (최저입찰가 ÷ 해당업체 입찰가), 소수 둘째자리 반올림"],
            ["상한", "20점 (최저가 입찰업체가 만점)"],
            ["확인서류", "가격입찰서"],
          ],
          [2000, 7360]
        ),

        h1("8. 종합평가 및 협상적격자 선정 기준"),
        p("기술평가(80점) + 가격평가(20점) = 총점 100점을 기준으로 다음과 같이 협상적격자를 선정합니다."),
        infoTable(
          [
            ["협상적격 기준", "필수자격 Pass이고, 총점 85점 이상인 업체"],
            ["협상순서", "협상적격자 중 고득점순으로 협상 순서를 부여"],
            ["동점 처리", "총점이 동일할 경우 가격평가 점수가 높은 업체를 우선함"],
          ],
          [2000, 7360]
        ),

        h1("9. 제출 일정 및 유의사항"),
        infoTable(
          [
            ["입찰공고 게시", "2026.07.07"],
            ["입찰공고 마감", "~2026.07.16"],
            ["제안서 및 가격평가, 협상적격자 선정", "~2026.07.31"],
            ["계약서 날인", "~2026.08.29"],
          ],
          [3200, 6160]
        ),
        new Paragraph({ spacing: { before: 300, after: 120 }, children: [new TextRun({ text: "유의사항", bold: true, size: 22, color: DARK })] }),
        ...[
          "본 안내에 따른 제안서 제출이 계약 체결을 보장하지 않습니다.",
          "제안서 작성 비용은 참여 업체가 부담하며, 어떠한 경우에도 보상하지 않습니다.",
          "제출된 서류 및 제안 내용에 허위 기재 사실이 확인될 경우 평가에서 즉시 제외됩니다.",
          "제출 서류는 반환하지 않으며, 제출된 정보에 대해 비밀 유지 의무가 적용됩니다.",
          "세부 평가기준(배점 포함)은 발주기관이 수립한 기준이며, 발주기관의 사정에 따라 변경될 수 있습니다. 변경이 있는 경우 사전에 안내합니다.",
        ].map(
          (text) =>
            new Paragraph({
              numbering: { reference: "notes-numbers", level: 0 },
              spacing: { after: 120 },
              children: [new TextRun({ text, size: 21, color: DARK })],
            })
        ),

        new Paragraph({
          spacing: { before: 500 },
          border: { top: { style: BorderStyle.SINGLE, size: 6, color: "D9D9D9", space: 8 } },
          children: [new TextRun({ text: "OK금융그룹 인재개발팀 | OK학당 스마트러닝 위탁운영", size: 19, color: "595959" })],
        }),
        new Paragraph({
          children: [new TextRun({ text: "문의 및 제출: OK금융그룹 인재개발팀 박종현 사원 / jhyun.park@okfngroup.com / 02-3704-9791", size: 19, color: "595959" })],
        }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  const outPath = path.join(__dirname, process.argv[2] || "세부평가기준_안내.docx");
  fs.writeFileSync(outPath, buffer);
  console.log("done:", outPath);
});
